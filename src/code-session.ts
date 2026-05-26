import type { EditorState, SessionConfig } from './code-types';
import type { CodeSocket } from './code-socket';

/**
 * Session abstraction for managing code state.
 *
 * Stores code locally and optionally syncs to the server via CodeSocket.
 * When Yjs is added later, this class wraps ydoc.getText('code')
 * and the WebsocketProvider — the rest of the app does not change.
 */
export class CodeSession {
  private state: EditorState;
  private config: SessionConfig;
  private remoteChangeHandlers: Array<(code: string) => void> = [];
  private socket: CodeSocket | null = null;

  constructor(config: SessionConfig, initialCode = '', socket?: CodeSocket) {
    this.config = config;
    this.state = {
      code: initialCode,
      language: 'python',
      lastModified: Date.now(),
    };
    if (socket) {
      this.bindSocket(socket);
    }
  }

  getCode(): string {
    return this.state.code;
  }

  updateCode(code: string): void {
    this.state.code = code;
    this.state.lastModified = Date.now();
    this.socket?.sendCodeUpdate(code);
  }

  onRemoteChange(handler: (code: string) => void): void {
    this.remoteChangeHandlers.push(handler);
  }

  applyRemoteCode(code: string): void {
    this.state.code = code;
    this.state.lastModified = Date.now();
    this.remoteChangeHandlers.forEach((h) => h(code));
  }

  getConfig(): SessionConfig {
    return { ...this.config };
  }

  getSocket(): CodeSocket | null {
    return this.socket;
  }

  /** Start listening for remote code changes from the server. */
  bindSocket(socket: CodeSocket): void {
    this.socket = socket;
    socket.on('code:broadcast', (data) => {
      this.applyRemoteCode(data.code);
    });
  }
}
