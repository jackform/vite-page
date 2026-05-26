import { io, Socket } from 'socket.io-client';
import type {
  StudentIdentity,
  SessionInfo,
  RemoteExecutionResult,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../shared/types';

const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : 'http://localhost:3001';

type EventHandler<K extends keyof ServerToClientEvents> =
  ServerToClientEvents[K] extends (...args: infer A) => void
    ? (...args: A) => void
    : never;

export class CodeSocket {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private handlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  /** Connect to the server and register as a student. */
  register(identity: StudentIdentity): Promise<SessionInfo> {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      const sock = this.socket;

      sock.on('connect', () => {
        sock.emit('student:register', identity);
      });

      sock.on('session:registered', (info: SessionInfo) => {
        resolve(info);
      });

      sock.on('register:error', (data: { error: string }) => {
        reject(new Error(data.error));
      });

      sock.on('connect_error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });
    });
  }

  /** Send a code update to the server. */
  sendCodeUpdate(code: string): void {
    this.socket?.emit('code:update', { code, timestamp: Date.now() });
  }

  /** Send execution results to the server. */
  sendExecutionResult(data: {
    status: string;
    stdout: string;
    stderr: string;
    returnValue?: string;
    passedCount?: number;
    totalCount?: number;
    executionTime?: number;
  }): void {
    this.socket?.emit('execution:result', {
      ...data,
      timestamp: Date.now(),
    });
  }

  /** Check if socket is connected. */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Listen for disconnect events (built-in Socket.io). */
  onDisconnect(cb: () => void): void {
    this.socket?.on('disconnect', cb);
  }

  /** Listen for reconnect events (built-in Socket.io). */
  onConnect(cb: () => void): void {
    this.socket?.on('connect', cb);
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: EventHandler<K>
  ): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    this.socket?.on(event, handler as any);
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler: EventHandler<K>
  ): void {
    this.handlers.get(event)?.delete(handler);
    this.socket?.off(event, handler as any);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.handlers.clear();
  }
}
