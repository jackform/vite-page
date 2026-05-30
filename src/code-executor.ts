import type { ExecutionResult, TestCase, TestRunResult, ExecutionStatus } from './code-types';
import { extractFunctionName, buildTestHarness, parseTestOutput } from './code-test-utils.js';

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
  async execute(code: string, timeoutMs = 30000): Promise<ExecutionResult> {
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
  async runTests(code: string, testCases: TestCase[], timeoutMs = 30000): Promise<TestRunResult> {
    const functionName = extractFunctionName(code);
    if (!functionName) {
      return {
        status: 'error',
        stdout: '',
        stderr: 'Could not detect a function definition in your code. ' +
          'Make sure you define a function with "def function_name(...):".',
      };
    }

    // Build a test harness that imports json and runs all cases
    const testCode = buildTestHarness(code, functionName, testCases);

    const result = await this.execute(testCode, timeoutMs);

    // Parse test results from stdout
    if (result.status === 'success') {
      return parseTestOutput(result, testCases);
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
}
