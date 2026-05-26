import type { EditorState, SessionConfig } from './code-types';

/**
 * Session abstraction for managing code state.
 *
 * Currently stores code in a plain local object.
 * When Yjs is added later, this class wraps ydoc.getText('code')
 * and the WebsocketProvider — the rest of the app does not change.
 */
export class CodeSession {
  private state: EditorState;
  private config: SessionConfig;
  private remoteChangeHandlers: Array<(code: string) => void> = [];

  constructor(config: SessionConfig, initialCode = '') {
    this.config = config;
    this.state = {
      code: initialCode,
      language: 'python',
      lastModified: Date.now(),
    };
  }

  /** Get the current code text. */
  getCode(): string {
    return this.state.code;
  }

  /**
   * Update code locally (called on every editor change).
   * In Yjs future: this broadcasts to other peers via the provider.
   */
  updateCode(code: string): void {
    this.state.code = code;
    this.state.lastModified = Date.now();
  }

  /**
   * Called when code arrives from a remote peer (teacher or student).
   * In Yjs future: triggered by ydoc.getText('code').observe().
   * Currently unused but establishes the callback pattern for the UI to react.
   */
  onRemoteChange(handler: (code: string) => void): void {
    this.remoteChangeHandlers.push(handler);
  }

  /**
   * Simulate a remote code update (for future use by teacher monitoring).
   * In Yjs future: this method is replaced by the Y.Text observer callback.
   */
  applyRemoteCode(code: string): void {
    this.state.code = code;
    this.state.lastModified = Date.now();
    this.remoteChangeHandlers.forEach((h) => h(code));
  }

  /** Get the current session configuration. */
  getConfig(): SessionConfig {
    return { ...this.config };
  }
}
