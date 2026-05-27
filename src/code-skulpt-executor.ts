import Sk from 'skulpt';
import type { ExecutionResult, TestCase, TestRunResult, ExecutionStatus } from './code-types';

/**
 * Skulpt-based Python executor.
 *
 * Runs Python (mostly 2.x with some 3.x features via __future__.python3)
 * directly in the main thread. Built-in turtle graphics support via
 * Sk.TurtleGraphics — Python code can `import turtle` and draw to a Canvas.
 *
 * Unlike Pyodide, Skulpt does NOT run in a Web Worker, so infinite loops
 * cannot be preemptively killed with worker.terminate(). Skulpt has a
 * built-in execLimit that suspends after N ms, but it is not a true timeout.
 */
export class SkulptExecutor {
  private ready = false;
  private status: ExecutionStatus = 'idle';
  private statusChangeHandlers: Array<(status: ExecutionStatus) => void> = [];
  private canvasId = '';

  constructor(canvasId: string) {
    this.canvasId = canvasId;
  }

  /** No async loading needed — Skulpt is already available via the npm package. */
  async load(): Promise<void> {
    if (this.ready) return;
    this.setStatus('loading');

    // Skulpt is bundled, so we're ready immediately.
    this.ready = true;
    this.setStatus('ready');
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): ExecutionStatus {
    return this.status;
  }

  onStatusChange(handler: (status: ExecutionStatus) => void): void {
    this.statusChangeHandlers.push(handler);
  }

  /**
   * Execute Python code.
   *
   * Skulpt runs in the main thread. The turtle module buffers drawing frames
   * in a FrameManager. With animate=true (default) and bufferSize=1, each
   * drawing operation triggers a requestAnimationFrame → Promise → Suspension.
   * We handle Suspensions by awaiting the underlying Promise before resuming.
   *
   * After execution we inject a flush call to hide the turtle and paint any
   * remaining buffered frames.
   */
  async execute(code: string, timeoutMs = 8000): Promise<ExecutionResult> {
    if (!this.ready) await this.load();

    // turtle.done() / mainloop() / exitonclick() are no-ops in Skulpt,
    // but we strip them anyway to avoid potential async issues.
    // Inject a flush call after the user code so the turtle cursor is
    // hidden and any remaining buffered frames get rendered.
    const sanitized = code
      .replace(/\bturtle\s*\.\s*done\s*\(\s*\)/g, '# turtle.done()')
      .replace(/\bturtle\s*\.\s*mainloop\s*\(\s*\)/g, '# turtle.mainloop()')
      .replace(/\bturtle\s*\.\s*exitonclick\s*\(\s*\)/g, '# turtle.exitonclick()')
      + '\n# Flush turtle frame buffer\ntry:\n import turtle as _t_\n _t_.hideturtle()\n _t_.Screen().update()\nexcept:\n pass\n';

    this.setStatus('running');

    let capturedOutput = '';
    let capturedError = '';

    // Properly reset turtle module internal state (FrameManager, Screen,
    // turtle instances) so each run starts fresh. This also clears the canvas.
    this.resetTurtle();

    Sk.configure({
      output: (text: string) => {
        capturedOutput += text;
      },
      read: (path: string) => {
        const files = (Sk as any).builtinFiles?.files;
        if (files && files[path]) {
          return files[path];
        }
        throw new Error('File not found: ' + path);
      },
      __future__: (Sk as any).python3,
      execLimit: timeoutMs,
    });

    const startTime = performance.now();
    try {
      // canSuspend=true so that Suspensions are returned instead of thrown
      let result = Sk.importMainWithBody('<stdin>', false, sanitized, true);

      // Handle Suspensions from turtle drawing operations. Each forward/right
      // with animate=true & bufferSize=1 creates a Suspension wrapping an rAF
      // Promise. We must await the Promise before resume() so the canvas is
      // painted and Skulpt's internal state is properly advanced.
      const Suspension = (Sk as any).misceval?.Suspension;
      let suspensionCount = 0;
      while (Suspension && result instanceof Suspension) {
        if (result.data?.type === 'Sk.promise' && result.data.promise instanceof Promise) {
          await result.data.promise;
        }
        result = result.resume();
        suspensionCount++;
        // Safety valve: prevent infinite loops if Suspensions keep coming
        if (suspensionCount > 10000) {
          throw new Error('Too many Suspensions — possible infinite loop in user code');
        }
      }

      const execTime = Math.round(performance.now() - startTime);

      this.setStatus('ready');
      return {
        status: 'success',
        stdout: capturedOutput,
        stderr: capturedError,
        executionTime: execTime,
      };
    } catch (err: any) {
      const execTime = Math.round(performance.now() - startTime);

      const msg = err?.message || String(err);
      const isTimeout =
        /time.?out|execlimit|suspension/i.test(msg);

      this.setStatus('ready');
      return {
        status: isTimeout ? 'timeout' : 'error',
        stdout: capturedOutput,
        stderr: capturedError || err.message || String(err),
        executionTime: execTime,
      };
    }
  }

  /**
   * Run test cases — builds the same test harness pattern as the Pyodide executor.
   */
  async runTests(code: string, testCases: TestCase[], timeoutMs = 8000): Promise<TestRunResult> {
    const functionName = this.extractFunctionName(code);
    if (!functionName) {
      return {
        status: 'error',
        stdout: '',
        stderr:
          'Could not detect a function definition in your code. ' +
          'Make sure you define a function with "def function_name(...):".',
      };
    }

    const testCode = this.buildTestHarness(code, functionName, testCases);
    const result = await this.execute(testCode, timeoutMs);

    if (result.status === 'success') {
      return this.parseTestOutput(result, testCases);
    }

    return { ...result, testResults: [] };
  }

  destroy(): void {
    this.ready = false;
    this.setStatus('idle');
    // Properly reset turtle internal state and clear canvases
    this.resetTurtle();
  }

  // ---- Private helpers ----

  /**
   * Reset turtle module internal state so each run starts fresh.
   *
   * Sk.TurtleGraphics.reset() cancels pending animation frames, resets the
   * Screen and FrameManager, clears canvases, and resets _screenInstance /
   * _anonymousTurtle / TURTLE_COUNT. This is the only correct way to reset
   * between runs — clearing DOM elements by hand leaves stale internal state
   * that causes hangs on subsequent executions.
   */
  private resetTurtle(): void {
    try {
      (Sk as any).TurtleGraphics?.reset?.();
    } catch {
      // Turtle module may not have been imported yet — fall back to DOM cleanup
    }

    // Also clear the canvas container directly, in case the turtle module
    // hasn't been loaded yet and the above reset was a no-op.
    const container = document.getElementById(this.canvasId);
    if (container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }
  }

  private setStatus(status: ExecutionStatus): void {
    this.status = status;
    this.statusChangeHandlers.forEach((h) => h(status));
  }

  private extractFunctionName(code: string): string | null {
    const match = code.match(/^\s*def\s+(\w+)\s*\(/m);
    return match ? match[1] : null;
  }

  private buildTestHarness(userCode: string, functionName: string, testCases: TestCase[]): string {
    const lines: string[] = [];

    lines.push('import json');
    lines.push('');
    lines.push('# User code');
    lines.push(userCode);
    lines.push('');
    lines.push('# Test runner');
    lines.push('_test_cases = ' + JSON.stringify(testCases.map((tc) => [tc.input, tc.expected])));
    lines.push('_fn = ' + functionName);
    lines.push('');
    lines.push('for _idx, (_input, _expected) in enumerate(_test_cases):');
    lines.push('    try:');
    lines.push('        # Parse input (split by newline, each line is a Python literal)');
    lines.push('        _args = []');
    lines.push('        for _line in _input.strip().split("\\n"):');
    lines.push('            _line = _line.strip()');
    lines.push('            if _line:');
    lines.push('                _args.append(eval(_line))');
    lines.push('');
    lines.push('        # Call the user function');
    lines.push('        if len(_args) == 1:');
    lines.push('            _actual = _fn(_args[0])');
    lines.push('        else:');
    lines.push('            _actual = _fn(*_args)');
    lines.push('');
    lines.push('        # Print result as a JSON line (marker: TEST_RESULT)');
    lines.push('        print("TEST_RESULT:" + json.dumps({');
    lines.push('            "index": _idx,');
    lines.push('            "passed": str(_actual) == str(_expected),');
    lines.push('            "input": _input,');
    lines.push('            "expected": _expected,');
    lines.push('            "actual": str(_actual)');
    lines.push('        }))');
    lines.push('    except Exception as _e:');
    lines.push('        print("TEST_RESULT:" + json.dumps({');
    lines.push('            "index": _idx,');
    lines.push('            "passed": False,');
    lines.push('            "input": _input,');
    lines.push('            "expected": _expected,');
    lines.push('            "actual": "Error: " + str(_e)');
    lines.push('        }))');

    return lines.join('\n');
  }

  private parseTestOutput(result: ExecutionResult, testCases: TestCase[]): TestRunResult {
    const testResults = [];
    let passedCount = 0;

    for (const line of result.stdout.split('\n')) {
      if (line.startsWith('TEST_RESULT:')) {
        try {
          const data = JSON.parse(line.slice('TEST_RESULT:'.length));
          testResults.push({
            passed: data.passed,
            input: data.input,
            expected: data.expected,
            actual: data.actual,
            index: data.index,
          });
          if (data.passed) passedCount++;
        } catch {
          // Malformed test result line — skip
        }
      }
    }

    if (testResults.length === 0) {
      const trimmed = result.stdout.trim();
      for (let i = 0; i < testCases.length; i++) {
        testResults.push({
          passed: false,
          input: testCases[i].input,
          expected: testCases[i].expected,
          actual: trimmed || '(no output)',
          index: i,
        });
      }
    }

    return {
      ...result,
      testResults,
      passedCount,
      totalCount: testCases.length,
    };
  }
}
