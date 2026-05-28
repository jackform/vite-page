import type { ExecutionResult, ExecutionStatus } from './code-types';

/** Widget creation command sent from Python worker to main thread. */
export interface WidgetCommand {
  cmd: 'create' | 'destroy' | 'configure' | 'messagebox';
  id: number;
  type?: 'root' | 'toplevel' | 'frame' | 'labelframe' | 'button' | 'label' | 'entry' | 'text';
  parentId?: number;
  props?: Record<string, string>;
  layout?: {
    type?: 'pack' | 'grid';
    side?: string;
    fill?: string | null;
    padx?: number;
    pady?: number;
    row?: number;
    column?: number;
    [key: string]: unknown;
  };
  title?: string;
  message?: string;
  messageboxType?: 'showwarning' | 'showinfo';
}

/** Callback result that may include widget commands (e.g. Toplevel from show_rules). */
export interface CallbackResult extends ExecutionResult {
  widgetId?: number;
  widgets?: WidgetCommand[];
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
  private callbackHandler: ((result: CallbackResult) => void) | null = null;
  /** Registry of created widget elements by id, for configure/destroy/parent-child lookup. */
  private widgetElements: Map<number, HTMLElement> = new Map();
  /** Pending configure props for widgets not yet created (insert before pack). */
  private pendingConfigures: Map<number, Record<string, string>> = new Map();

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
   */
  renderWidgetOutput(container: HTMLElement, result: WidgetExecutionResult): void {
    container.innerHTML = '';
    this.widgetElements.clear();

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
        this.processWidgetCommand(w, widgetContainer);
      }

      container.appendChild(widgetContainer);
    }

    // Placeholder for callback results (button clicks, etc.)
    const cbOutput = document.createElement('div');
    cbOutput.id = 'widget-callback-output';
    container.appendChild(cbOutput);
  }

  /**
   * Render widgets that arrive during a callback (e.g. Toplevel created by show_rules,
   * configure commands from Text.insert/delete, messagebox commands).
   *
   * Toplevels render at document body level as fixed dialogs. Their child widgets
   * are rendered inside the Toplevel content area. Messagebox commands trigger
   * window.alert(). Configure commands update existing elements.
   */
  renderCallbackWidgets(widgets: WidgetCommand[]): void {
    if (!widgets.length) return;

    // Group: find Toplevel ids first, then assign children to them
    const toplevelIds = new Set<number>();
    const toplevelWidgets: WidgetCommand[] = [];
    const messageboxWidgets: WidgetCommand[] = [];
    const remaining: WidgetCommand[] = [];

    for (const w of widgets) {
      if (w.type === 'toplevel' && w.cmd === 'create') {
        toplevelIds.add(w.id);
        toplevelWidgets.push(w);
      } else if (w.cmd === 'messagebox') {
        messageboxWidgets.push(w);
      } else {
        remaining.push(w);
      }
    }

    // Render each Toplevel as a document-level overlay
    const toplevelContentDivs = new Map<number, HTMLElement>();
    for (const w of toplevelWidgets) {
      const overlay = this.createWidgetElement(w, document.body);
      if (overlay) {
        this.widgetElements.set(w.id, overlay);
        document.body.appendChild(overlay);
        // Find the content div for child appending
        const content = overlay.querySelector('.widget-toplevel-content') as HTMLElement;
        if (content) toplevelContentDivs.set(w.id, content);
      }
    }

    // Process remaining widgets: children of Toplevel go to its content div,
    // standalone widgets go to output panel.
    for (const w of remaining) {
      if (w.cmd === 'create' && w.parentId !== undefined && toplevelContentDivs.has(w.parentId)) {
        // Child of a Toplevel — render directly into the content div
        const el = this.createWidgetElement(w, toplevelContentDivs.get(w.parentId)!);
        if (el) {
          this.widgetElements.set(w.id, el);
          toplevelContentDivs.get(w.parentId)!.appendChild(el);
        }
      } else {
        // Standalone configure or other widget
        this.processWidgetCommand(w, document.getElementById('output-panel')!);
      }
    }

    // Messagebox widgets
    for (const w of messageboxWidgets) {
      this.processWidgetCommand(w, document.body);
    }
  }

  /** Register a handler to receive callback results from widget clicks. */
  onCallbackResult(handler: (result: CallbackResult) => void): void {
    this.callbackHandler = handler;

    if (!this.worker) return;

    const listener = (e: MessageEvent) => {
      if (e.data.type === 'callback:result') {
        handler({
          status: e.data.status,
          stdout: e.data.stdout || '',
          stderr: e.data.stderr || '',
          widgetId: e.data.widgetId,
          widgets: e.data.widgets || [],
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
    this.widgetElements.clear();
  }

  // ---- Private helpers ----

  private createWorker(): void {
    this.worker = new Worker(
      `${import.meta.env.BASE_URL}code-widget-worker.js?v=${Date.now()}`
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
            widgetId: e.data.widgetId,
            widgets: e.data.widgets || [],
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

  /**
   * Process a widget command — create, configure, messagebox, or destroy.
   * Returns the created element for 'create', or null for other commands.
   */
  private processWidgetCommand(w: WidgetCommand, defaultParent: HTMLElement, ignoreParent = false): HTMLElement | null {
    switch (w.cmd) {
      case 'create': {
        const el = this.createWidgetElement(w, defaultParent);
        if (el) {
          this.widgetElements.set(w.id, el);
          // Resolve parent: use parentId if present, otherwise append to defaultParent.
          // ignoreParent=true means always use defaultParent (for Toplevel overlays).
          if (!ignoreParent && w.parentId !== undefined && this.widgetElements.has(w.parentId)) {
            const parentEl = this.widgetElements.get(w.parentId)!;
            // For containers with a dedicated content area (root, toplevel),
            // append children to the content div, not the outer wrapper.
            const contentArea = parentEl.querySelector('.widget-root-content, .widget-toplevel-content') as HTMLElement;
            (contentArea || parentEl).appendChild(el);
          } else {
            defaultParent.appendChild(el);
          }
          // Apply any pending configure props (e.g. Entry.insert before pack)
          const pending = this.pendingConfigures.get(w.id);
          if (pending) {
            this.applyPropsToElement(el, pending);
            this.applySpecialProps(el, pending);
            this.pendingConfigures.delete(w.id);
          }
        }
        return el;
      }
      case 'configure': {
        const existing = this.widgetElements.get(w.id);
        if (existing && w.props) {
          this.applyPropsToElement(existing, w.props);
          this.applySpecialProps(existing, w.props);
        } else if (w.props) {
          // Widget not created yet — store props for when create arrives
          const pending = this.pendingConfigures.get(w.id) || {};
          Object.assign(pending, w.props);
          this.pendingConfigures.set(w.id, pending);
        }
        return null;
      }
      case 'messagebox': {
        const title = w.title || 'Message';
        const message = w.message || '';
        if (w.messageboxType === 'showwarning') {
          alert('⚠ ' + title + '\n\n' + message);
        } else if (w.messageboxType === 'showinfo') {
          alert('ℹ ' + title + '\n\n' + message);
        }
        return null;
      }
      case 'destroy': {
        const el = this.widgetElements.get(w.id);
        if (el) {
          el.remove();
          this.widgetElements.delete(w.id);
        }
        return null;
      }
      default:
        return null;
    }
  }

  private createWidgetElement(w: WidgetCommand, defaultParent: HTMLElement): HTMLElement | null {
    const props = w.props || {};
    const layout = w.layout || {};

    switch (w.type) {
      case 'root': {
        const root = document.createElement('div');
        root.className = 'widget-root';
        root.id = 'widget-root';

        // Title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'widget-titlebar';
        titleBar.textContent = props['title'] || '';
        root.appendChild(titleBar);

        // Content area (children will be appended here)
        const content = document.createElement('div');
        content.className = 'widget-root-content';
        root.appendChild(content);

        // Apply bg / geometry
        if (props['bg']) root.style.backgroundColor = props['bg'];
        const geom = props['geometry'];
        if (geom) {
          const m = geom.match(/(\d+)x(\d+)/);
          if (m) {
            root.style.width = m[1] + 'px';
            root.style.minHeight = m[2] + 'px';
          }
        }
        return root;
      }

      case 'toplevel': {
        const overlay = document.createElement('div');
        overlay.className = 'widget-toplevel-overlay';
        overlay.id = 'widget-toplevel-overlay-' + w.id;

        const top = document.createElement('div');
        top.className = 'widget-toplevel';
        if (props['bg']) top.style.backgroundColor = props['bg'];
        const geom = props['geometry'];
        if (geom) {
          const m = geom.match(/(\d+)x(\d+)/);
          if (m) {
            top.style.width = m[1] + 'px';
            top.style.minHeight = m[2] + 'px';
          }
        }

        // Title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'widget-toplevel-titlebar';
        const titleText = document.createElement('span');
        titleText.textContent = props['title'] || '';
        titleBar.appendChild(titleText);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'widget-toplevel-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => overlay.remove());
        titleBar.appendChild(closeBtn);
        top.appendChild(titleBar);

        // Content area
        const content = document.createElement('div');
        content.className = 'widget-toplevel-content';
        top.appendChild(content);
        overlay.appendChild(top);

        return overlay;
      }

      case 'frame': {
        const frame = document.createElement('div');
        frame.className = 'widget-frame';
        if (props['bg']) frame.style.backgroundColor = props['bg'];
        if (layout.type === 'grid') {
          frame.classList.add('widget-frame-grid');
        }
        return frame;
      }

      case 'labelframe': {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'widget-fieldset';
        if (props['bg']) fieldset.style.backgroundColor = props['bg'];

        const legend = document.createElement('legend');
        legend.className = 'widget-legend';
        legend.textContent = props['text'] || '';
        fieldset.appendChild(legend);
        return fieldset;
      }

      case 'button': {
        const btn = document.createElement('button');
        btn.className = 'widget-button';
        btn.textContent = props['text'] || '';
        this.applyPropsToElement(btn, props);
        this.attachEventForwarders(btn, w.id);
        return this.wrapWithLayout(btn, layout);
      }

      case 'label': {
        const lbl = document.createElement('span');
        lbl.className = 'widget-label';
        lbl.textContent = props['text'] || '';
        // Make label look clickable if it has event bindings
        lbl.style.cursor = 'pointer';
        this.applyPropsToElement(lbl, props);
        this.attachEventForwarders(lbl, w.id);
        return this.wrapWithLayout(lbl, layout);
      }

      case 'entry': {
        const input = document.createElement('input');
        input.className = 'widget-entry';
        input.setAttribute('type', 'text');
        input.setAttribute('placeholder', props['placeholder'] || '');
        input.setAttribute('id', 'widget-' + w.id);
        if (props['value']) input.value = props['value'];
        this.applyPropsToElement(input, props);
        return this.wrapWithLayout(input, layout);
      }

      case 'text': {
        const ta = document.createElement('textarea');
        ta.className = 'widget-text';
        ta.value = props['text'] || '';
        ta.setAttribute('id', 'widget-' + w.id);
        this.applyPropsToElement(ta, props);
        return this.wrapWithLayout(ta, layout);
      }

      default:
        return null;
    }
  }

  /** Apply special props that aren't CSS (title, value, etc.). */
  private applySpecialProps(el: HTMLElement, props: Record<string, string>): void {
    // Handle title prop: update titlebar text for root/toplevel
    if (props['title'] !== undefined) {
      const titleBar = el.querySelector('.widget-titlebar, .widget-toplevel-titlebar') as HTMLElement;
      if (titleBar) {
        const span = titleBar.querySelector('span');
        if (span) {
          span.textContent = props['title'];
        } else {
          const textNode = Array.from(titleBar.childNodes).find(n => n.nodeType === 3);
          if (textNode) textNode.textContent = props['title'];
        }
      }
    }
    // Handle value prop: find input/textarea within element (may be wrapped)
    if (props['value'] !== undefined) {
      const input = el.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
      if (input) input.value = props['value'];
    }
    // Handle text prop: find textarea within element
    if (props['text'] !== undefined) {
      const ta = el.querySelector('textarea') as HTMLTextAreaElement | null;
      if (ta) ta.value = props['text'];
    }
  }

  /** Attach event forwarders for user interactions. */
  private attachEventForwarders(el: HTMLElement, widgetId: number): void {
    const events = ['click', 'mouseenter', 'mouseleave'];
    for (const evt of events) {
      el.addEventListener(evt, () => {
        if (this.worker) {
          this.worker.postMessage({
            type: 'widget:event',
            widgetId: widgetId,
            event: evt,
            inputValues: this.collectInputValues(),
          });
        }
      });
    }
  }

  /** Collect current values of all Entry and Text widgets for the worker. */
  private collectInputValues(): Record<string, string> {
    const values: Record<string, string> = {};
    document.querySelectorAll('.widget-entry[id], .widget-text[id]').forEach((el) => {
      const id = el.id;
      if (id && id.startsWith('widget-')) {
        values[id.replace('widget-', '')] = (el as HTMLInputElement | HTMLTextAreaElement).value;
      }
    });
    return values;
  }

  /** Wrap an element in a layout div respecting pack()/grid() options. */
  private wrapWithLayout(el: HTMLElement, layout: WidgetCommand['layout']): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-wrapper';

    const type = layout?.type || 'pack';

    if (type === 'grid') {
      wrapper.style.display = 'inline-grid';
      if (layout?.row !== undefined) wrapper.style.gridRow = String(layout.row + 1);
      if (layout?.column !== undefined) wrapper.style.gridColumn = String(layout.column + 1);
      wrapper.style.padding = `${layout?.pady || 2}px ${layout?.padx || 4}px`;
    } else {
      wrapper.style.display = 'inline-block';
      wrapper.style.padding = `${layout?.pady || 2}px ${layout?.padx || 4}px`;

      const fill = layout?.fill;
      if (fill === 'x') {
        wrapper.style.display = 'block';
        el.style.width = '100%';
      } else if (fill === 'both') {
        wrapper.style.display = 'block';
        el.style.width = '100%';
        el.style.height = '100%';
      }
    }

    wrapper.appendChild(el);
    return wrapper;
  }

  /**
   * Apply tkinter props to a DOM element as CSS.
   * Supported: font, bg, fg, width, height, justify, state.
   * Unsupported props are silently ignored.
   */
  private applyPropsToElement(el: HTMLElement, props: Record<string, string>): void {
    if (props['bg']) el.style.backgroundColor = props['bg'];
    if (props['fg']) el.style.color = props['fg'];
    if (props['font']) el.style.font = this.parseFont(props['font']);
    if (props['width']) {
      const w = parseInt(props['width'], 10);
      if (!isNaN(w)) {
        if (el instanceof HTMLInputElement) el.style.width = (w * 1.2) + 'ch';
        else el.style.width = w + 'ch';
      }
    }
    if (props['height']) {
      const h = parseInt(props['height'], 10);
      if (!isNaN(h)) el.style.height = (h * 1.5) + 'em';
    }
    if (props['justify']) {
      const j = props['justify'];
      if (j === 'left' || j === 'center' || j === 'right') {
        el.style.textAlign = j;
      }
    }
    if (props['state'] === 'disabled') {
      const input = el.querySelector('input, textarea') || el;
      if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
        input.readOnly = true;
      }
      el.classList.add('widget-text-disabled');
    }
    if (props['value'] !== undefined) {
      const input = el.querySelector('input') as HTMLInputElement | null;
      if (input) input.value = props['value'];
    }
    if (props['text'] !== undefined) {
      const ta = el.querySelector('textarea') as HTMLTextAreaElement | null;
      if (ta) ta.value = props['text'];
    }
  }

  /** Convert a tkinter font spec to a CSS font shorthand string. */
  private parseFont(fontSpec: string): string {
    // Already a CSS string
    if (/^\d+px/.test(fontSpec) || /^(normal|bold|italic)/.test(fontSpec)) {
      return fontSpec;
    }
    // Try parsing Python tuple-like string: "('微软雅黑', 20, 'bold')"
    const m = fontSpec.match(/^['"](.+)['"],\s*(\d+)(?:,\s*['"](.+)['"])?/);
    if (m) {
      const family = m[1];
      const size = m[2] + 'px';
      const weight = m[3] || 'normal';
      return `${weight} ${size} '${family}'`;
    }
    return fontSpec;
  }
}
