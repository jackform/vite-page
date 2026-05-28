import type { ExecutionResult, ExecutionStatus } from './code-types';

/** Widget creation command sent from Python worker to main thread. */
export interface WidgetCommand {
  cmd: 'create' | 'destroy';
  id: number;
  type?: 'button' | 'label' | 'entry' | 'text';
  props?: Record<string, string>;
  layout?: {
    side?: string;
    fill?: string | null;
    padx?: number;
    pady?: number;
  };
}

/** Extended execution result that includes widget commands. */
export interface WidgetExecutionResult extends ExecutionResult {
  widgets?: WidgetCommand[];
}

/**
 * Manages Pyodide execution with webtkinter widget support.
 *
 * Unlike CodeExecutor (which only handles text output), this executor:
 * 1. Uses a custom worker that injects the webtkinter module
 * 2. Receives widget creation commands alongside execution results
 * 3. Renders widgets as real DOM elements in the output panel
 * 4. Handles widget events (clicks) by forwarding them back to Python callbacks
 */
export class CodeWidgetExecutor {
  private worker: Worker | null = null;
  private ready = false;
  private status: ExecutionStatus = 'idle';
  private statusMessage: string | null = null;
  private statusChangeHandlers: Array<(status: ExecutionStatus) => void> = [];
  private callbackHandler: ((result: ExecutionResult) => void) | null = null;

  /** Start loading Pyodide + packages + webtkinter in the worker. */
  async load(): Promise<void> {
    if (this.ready) return;
    if (this.status === 'loading') {
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
        reject(new Error('Pyodide load timed out after 60 seconds'));
        this.setStatus('error');
      }, 60000);

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
          this.updateStatusMessage('Loading packages...');
        }
      };

      this.worker.addEventListener('message', handler, { once: false });
    });
  }

  /** Whether the executor is ready to run code. */
  isReady(): boolean {
    return this.ready;
  }

  /** Get the current executor status. */
  getStatus(): ExecutionStatus {
    return this.status;
  }

  /** Get a human-readable status message. */
  getStatusMessage(): string | null {
    return this.statusMessage;
  }

  /** Listen for status changes. */
  onStatusChange(handler: (status: ExecutionStatus) => void): void {
    this.statusChangeHandlers.push(handler);
  }

  /**
   * Execute Python code with widget support.
   * Returns widget commands alongside normal output.
   */
  async execute(code: string, timeoutMs = 30000): Promise<WidgetExecutionResult> {
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
        this.terminateWorker();
        this.ready = false;
        this.setStatus('ready');
        this.createWorker();
        this.load().catch(() => {});

        resolve({
          status: 'timeout',
          stdout: '',
          stderr: `Execution timed out after ${timeoutMs / 1000} seconds.`,
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
          executionTime: e.data.executionTime,
          widgets: e.data.widgets || [],
        });
      };

      this.worker!.addEventListener('message', handler, { once: true });
      this.worker!.postMessage({ type: 'run', code });
    });
  }

  /**
   * Render widget output into a container element.
   *
   * Creates real DOM elements for each widget and attaches event
   * listeners that forward clicks back to the worker. Stdout/stderr
   * text is rendered above the widgets.
   */
  renderWidgetOutput(container: HTMLElement, result: WidgetExecutionResult): void {
    container.innerHTML = '';

    // Stdout text
    if (result.stdout.trim()) {
      const outDiv = document.createElement('div');
      outDiv.className = 'output-stdout';
      outDiv.textContent = result.stdout.trim();
      container.appendChild(outDiv);
    }

    // Stderr text
    if (result.stderr.trim()) {
      const errDiv = document.createElement('div');
      errDiv.className = 'output-stderr';
      errDiv.textContent = result.stderr.trim();
      container.appendChild(errDiv);
    }

    // Execution time
    if (result.executionTime !== undefined) {
      const meta = document.createElement('div');
      meta.className = 'output-meta';
      meta.textContent = `Execution time: ${result.executionTime}ms`;
      container.appendChild(meta);
    }

    // Timeout message
    if (result.status === 'timeout') {
      const timeoutDiv = document.createElement('div');
      timeoutDiv.className = 'output-stderr';
      timeoutDiv.textContent = '⏱ ' + result.stderr;
      container.appendChild(timeoutDiv);
      return;
    }

    // Widgets
    const widgets = result.widgets || [];
    if (widgets.length > 0) {
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'widget-container';

      for (const w of widgets) {
        if (w.cmd === 'create') {
          const el = this.createWidgetElement(w);
          if (el) widgetContainer.appendChild(el);
        }
      }

      container.appendChild(widgetContainer);
    }

    // Placeholder for callback results (button clicks, etc.)
    const cbOutput = document.createElement('div');
    cbOutput.id = 'widget-callback-output';
    container.appendChild(cbOutput);
  }

  /** Register a handler to receive callback results from widget clicks. */
  onCallbackResult(handler: (result: ExecutionResult) => void): void {
    this.callbackHandler = handler;

    if (!this.worker) return;

    const listener = (e: MessageEvent) => {
      if (e.data.type === 'callback:result') {
        handler({
          status: e.data.status,
          stdout: e.data.stdout || '',
          stderr: e.data.stderr || '',
        });
      }
    };

    this.worker.addEventListener('message', listener);
  }

  /** Clean up the worker. */
  destroy(): void {
    this.terminateWorker();
    this.ready = false;
    this.setStatus('idle');
  }

  // ---- Private helpers ----

  private createWorker(): void {
    this.worker = new Worker(
      `${import.meta.env.BASE_URL}code-widget-worker.js`
    );

    // Re-attach callback handler if one was registered before the worker existed
    if (this.callbackHandler && this.worker) {
      const handler = this.callbackHandler;
      const listener = (e: MessageEvent) => {
        if (e.data.type === 'callback:result') {
          handler({
            status: e.data.status,
            stdout: e.data.stdout || '',
            stderr: e.data.stderr || '',
          });
        }
      };
      this.worker.addEventListener('message', listener);
    }
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private setStatus(status: ExecutionStatus): void {
    this.status = status;
    this.statusMessage = null;
    this.statusChangeHandlers.forEach((h) => h(status));
  }

  private updateStatusMessage(message: string): void {
    this.statusMessage = message;
    this.statusChangeHandlers.forEach((h) => h(this.status));
  }

  private createWidgetElement(w: WidgetCommand): HTMLElement | null {
    const props = w.props || {};
    const layout = w.layout || {};
    let el: HTMLElement;

    switch (w.type) {
      case 'button': {
        el = document.createElement('button');
        el.className = 'widget-button';
        el.textContent = props['text'] || '';
        el.addEventListener('click', () => {
          if (this.worker) {
            this.worker.postMessage({
              type: 'widget:event',
              widgetId: w.id,
              event: 'click',
            });
          }
        });
        break;
      }
      case 'label': {
        el = document.createElement('span');
        el.className = 'widget-label';
        el.textContent = props['text'] || '';
        break;
      }
      case 'entry': {
        el = document.createElement('input');
        el.className = 'widget-entry';
        el.setAttribute('type', 'text');
        el.setAttribute('placeholder', props['placeholder'] || '');
        el.setAttribute('id', 'widget-' + w.id);
        break;
      }
      case 'text': {
        el = document.createElement('pre');
        el.className = 'widget-text';
        el.textContent = props['text'] || '';
        break;
      }
      default:
        return null;
    }

    // Apply layout: wrap in a div that respects pack() options
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-wrapper';
    wrapper.style.display = 'inline-block';
    wrapper.style.padding = `${layout.pady || 2}px ${layout.padx || 4}px`;

    if (layout.fill === 'x') {
      wrapper.style.display = 'block';
      (el as HTMLElement).style.width = '100%';
    } else if (layout.fill === 'both') {
      wrapper.style.display = 'block';
      (el as HTMLElement).style.width = '100%';
      el.style.height = '100%';
    }

    wrapper.appendChild(el);
    return wrapper;
  }
}
