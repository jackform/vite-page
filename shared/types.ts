/** Socket.io event protocol types shared between client and server. */

export interface StudentIdentity {
  name: string;
  studentId: string;
}

export interface SessionInfo {
  roomId: string;
  userId: string;
  studentName: string;
  studentId: string;
}

export interface RosterEntry {
  studentId: string;
  name: string;
  roomId: string;
  connected: boolean;
  joinedAt: number;
}

export interface RemoteExecutionResult {
  roomId: string;
  status: string;
  stdout: string;
  stderr: string;
  returnValue?: string;
  passedCount?: number;
  totalCount?: number;
  executionTime?: number;
  timestamp: number;
}

export interface AuthRequest {
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

/** Events the server may emit to the client. */
export interface ServerToClientEvents {
  'session:registered': (info: SessionInfo) => void;
  'register:error': (data: { error: string }) => void;
  'auth:result': (result: AuthResult) => void;
  'roster:update': (data: { students: RosterEntry[] }) => void;
  'student:joined': (entry: RosterEntry) => void;
  'student:left': (data: { studentId: string }) => void;
  'code:broadcast': (data: {
    roomId: string;
    code: string;
    studentName: string;
    timestamp: number;
  }) => void;
  'execution:broadcast': (data: RemoteExecutionResult) => void;
}

/** Events the client may emit to the server. */
export interface ClientToServerEvents {
  'student:register': (identity: StudentIdentity) => void;
  'code:update': (data: { code: string; timestamp: number }) => void;
  'execution:result': (data: {
    status: string;
    stdout: string;
    stderr: string;
    returnValue?: string;
    passedCount?: number;
    totalCount?: number;
    executionTime?: number;
    timestamp: number;
  }) => void;
  'teacher:auth': (data: AuthRequest) => void;
  'room:subscribe': (data: { roomId: string }) => void;
  'room:unsubscribe': (data: { roomId: string }) => void;
}
