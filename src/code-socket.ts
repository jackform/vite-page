import { io, Socket } from 'socket.io-client';
import type {
  StudentIdentity,
  SessionInfo,
  RemoteExecutionResult,
  ServerToClientEvents,
  ClientToServerEvents,
  StudentCheckResult,
  StudentAuthResult,
  SavedCodeData,
  ClassroomStatusResponse,
} from '../shared/types';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

type EventHandler<K extends keyof ServerToClientEvents> =
  ServerToClientEvents[K] extends (...args: infer A) => void
    ? (...args: A) => void
    : never;

export class CodeSocket {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private handlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  /** REST: Check if a studentId exists. */
  static async checkStudentId(studentId: string): Promise<StudentCheckResult> {
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`);
    if (!res.ok) throw new Error('Failed to check student ID');
    return res.json();
  }

  /** REST: Register a new student account with PIN. */
  static async registerStudent(data: {
    studentId: string;
    name: string;
    pin: string;
  }): Promise<{ studentId: string; name: string }> {
    const res = await fetch('/api/students/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  }

  /** REST: Verify PIN for an existing student. */
  static async loginStudent(data: {
    studentId: string;
    pin: string;
  }): Promise<StudentAuthResult> {
    const res = await fetch('/api/students/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  }

  /** REST: Set PIN for a pre-registered student (first-time setup). */
  static async setPin(data: {
    studentId: string;
    pin: string;
  }): Promise<{ studentId: string; name: string }> {
    const res = await fetch('/api/students/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to set PIN' }));
      throw new Error(err.error || 'Failed to set PIN');
    }
    return res.json();
  }

  /** REST: Get saved code for a student + problem. */
  static async getSavedCode(studentId: string, problemId: string): Promise<SavedCodeData | null> {
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/code/${encodeURIComponent(problemId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to get saved code');
    return res.json();
  }

  /** REST: Save code for a student + problem. */
  static async saveCode(studentId: string, problemId: string, code: string): Promise<SavedCodeData> {
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/code/${encodeURIComponent(problemId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save code' }));
      throw new Error(err.error || 'Failed to save code');
    }
    return res.json();
  }

  /** REST: Poll classroom status for pending teacher pushes. */
  static async getClassroomStatus(studentId: string): Promise<ClassroomStatusResponse> {
    const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/classroom-status`);
    if (!res.ok) throw new Error('Failed to check classroom status');
    return res.json();
  }

  /** Connect to the server and register as a student (legacy, for direct socket registration). */
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

  /** Connect to the server and join as an already-authenticated student. */
  join(authResult: { studentId: string; name: string }, mode: 'free_practice' | 'classroom' = 'classroom'): Promise<SessionInfo> {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      const sock = this.socket;

      sock.on('connect', () => {
        sock.emit('student:join', {
          studentId: authResult.studentId,
          name: authResult.name,
          mode,
        });
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

  /** Expose the underlying socket for extension modules (e.g. chat). */
  getRawSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.handlers.clear();
  }
}
