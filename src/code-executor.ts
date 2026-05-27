import type { ExecutionResult, TestCase, TestRunResult, ExecutionStatus } from './code-types';

/**
 * Manages Pyodide execution inside a Web Worker.
 *
 * Key responsibilities:
 * 1. Load Pyodide via a classic Web Worker (public/code-worker.js)
 * 2. Execute arbitrary Python code with stdout/stderr capture
 * 3. Enforce execution timeout by terminating the worker
 * 4. Run test cases against student code and report per-case results
 * 5. Auto-recreate the worker after a timeout termination
 */
export class CodeExecutor {
  private worker: Worker | null = null;
  private ready = false;
  private status: ExecutionStatus = 'idle';
  private statusMessage: string | null = null;
  private statusChangeHandlers: Array<(status: ExecutionStatus) => void> = [];

  /** Start loading Pyodide in the worker. Returns a promise that resolves when ready. */
  async load(): Promise<void> {
    if (this.ready) return;
    if (this.status === 'loading') {
      // Already loading — wait for it
      return new Promise((resolve) => {
        const check = () => {
          if (this.ready) resolve();
          else setTimeout(check, 100);
        };
        check();
      });
    }

    this.setStatus('loading');
    this.createWorker();

    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error('Failed to create worker'));

      const timeout = setTimeout(() => {
        reject(new Error('Pyodide load timed out after 30 seconds'));
        this.setStatus('error');
      }, 30000);

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'ready') {
          clearTimeout(timeout);
          this.ready = true;
          this.setStatus('ready');
          resolve();
        } else if (e.data.type === 'init-error') {
          clearTimeout(timeout);
          this.setStatus('error');
          reject(new Error(e.data.error));
        } else if (e.data.type === 'progress') {
          // Packages are being downloaded — keep loading but update message
          this.updateStatusMessage('Loading packages...');
        }
      };

      this.worker.addEventListener('message', handler, { once: false });
    });
  }

  /** Whether Pyodide is loaded and ready. */
  isReady(): boolean {
    return this.ready;
  }

  /** Get the current executor status. */
  getStatus(): ExecutionStatus {
    return this.status;
  }

  /** Get a human-readable status message (e.g. "Loading packages..."). */
  getStatusMessage(): string | null {
    return this.statusMessage;
  }

  /** Listen for status changes (for UI updates). */
  onStatusChange(handler: (status: ExecutionStatus) => void): void {
    this.statusChangeHandlers.push(handler);
  }

  /**
   * Execute Python code with a timeout.
   *
   * If execution exceeds timeoutMs, the worker is terminated and recreated.
   * A fresh Pyodide load happens automatically in the new worker.
   */
  async execute(code: string, timeoutMs = 5000): Promise<ExecutionResult> {
    if (!this.ready || !this.worker) {
      await this.load();
    }
    if (!this.worker) {
      return {
        status: 'error',
        stdout: '',
        stderr: 'Executor is not available',
      };
    }

    this.setStatus('running');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Infinite loop detected — kill the worker
        this.terminateWorker();
        this.ready = false;
        this.setStatus('ready'); // Editor stays functional
        // Re-create worker in background
        this.createWorker();
        this.load().catch(() => {});

        resolve({
          status: 'timeout',
          stdout: '',
          stderr: `Execution timed out after ${timeoutMs / 1000} seconds. ` +
            'The Python environment has been restarted.',
          executionTime: timeoutMs,
        });
      }, timeoutMs);

      const handler = (e: MessageEvent) => {
        if (e.data.type !== 'result') return;
        clearTimeout(timeout);
        this.setStatus('ready');

        resolve({
          status: e.data.status,
          stdout: e.data.stdout || '',
          stderr: e.data.stderr || (e.data.status === 'error' ? e.data.error || '' : ''),
          returnValue: e.data.returnValue,
          executionTime: e.data.executionTime,
        });
      };

      this.worker!.addEventListener('message', handler, { once: true });
      this.worker!.postMessage({ type: 'run', code });
    });
  }

  /**
   * Run all test cases against the user's code.
   *
   * Generates a test harness that:
   * 1. Executes the user's function definition
   * 2. Iterates over test cases, calling the function with parsed input
   * 3. Prints results in a structured format for parsing
   */
  async runTests(code: string, testCases: TestCase[], timeoutMs = 8000): Promise<TestRunResult> {
    const functionName = this.extractFunctionName(code);
    if (!functionName) {
      return {
        status: 'error',
        stdout: '',
        stderr: 'Could not detect a function definition in your code. ' +
          'Make sure you define a function with "def function_name(...):".',
      };
    }

    // Build a test harness that imports json and runs all cases
    const testCode = this.buildTestHarness(code, functionName, testCases);

    const result = await this.execute(testCode, timeoutMs);

    // Parse test results from stdout
    if (result.status === 'success') {
      return this.parseTestOutput(result, testCases);
    }

    return { ...result, testResults: [] };
  }

  /** Remove the current worker completely. */
  destroy(): void {
    this.terminateWorker();
    this.ready = false;
    this.setStatus('idle');
  }

  // ---- Private helpers ----

  private createWorker(): void {
    this.worker = new Worker(
      `${import.meta.env.BASE_URL}code-worker.js`
    );
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private setStatus(status: ExecutionStatus): void {
    this.status = status;
    this.statusMessage = null; // clear transient messages
    this.statusChangeHandlers.forEach((h) => h(status));
  }

  private updateStatusMessage(message: string): void {
    this.statusMessage = message;
    // Also notify handlers so the UI can re-render
    this.statusChangeHandlers.forEach((h) => h(this.status));
  }

  /**
   * Extract the first function name from user code.
   * Matches patterns like "def function_name(...):"
   */
  private extractFunctionName(code: string): string | null {
    const match = code.match(/^\s*def\s+(\w+)\s*\(/m);
    return match ? match[1] : null;
  }

  /**
   * Build a Python script that:
   * 1. Includes the user's code (function definition)
   * 2. Iterates through test cases
   * 3. For each case: parses input, calls the function, prints JSON result line
   *
   * Input format per test case: first line is the first argument (as Python literal),
   * subsequent lines are additional arguments. Output is compared as Python literals.
   */
  private buildTestHarness(userCode: string, functionName: string, testCases: TestCase[]): string {
    const lines: string[] = [];

    lines.push('import json');
    lines.push('import sys');
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

  /** Parse TEST_RESULT lines from stdout into structured test results. */
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

    // If no structured results were found, check if tests passed via simple comparison
    if (testResults.length === 0) {
      // Fallback: assume the output is the direct result
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
