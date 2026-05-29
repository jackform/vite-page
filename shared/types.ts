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
  'problem:assigned': (data: { problem: AssignedProblem }) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (data: { roomId: string; messages: ChatMessage[] }) => void;
  'editor:locked': (data: LockState) => void;
  'editor:unlocked': (data: LockState) => void;
  'code:teacher-broadcast': (data: TeacherCodeUpdate) => void;
  'execution:relay': (data: ExecutionRelayRequest) => void;
  'execution:relay-broadcast': (data: RelayExecutionResult) => void;
}

/** Lock state for teacher lock-and-push workflow. */
export interface LockState {
  roomId: string;
  isLocked: boolean;
}

/** Teacher code update relayed to student during lock. */
export interface TeacherCodeUpdate {
  roomId: string;
  code: string;
  timestamp: number;
}

/** Teacher requests execution relay through student's Pyodide. */
export interface ExecutionRelayRequest {
  roomId: string;
  code: string;
}

/** Student's relayed execution result sent back to teacher. */
export interface RelayExecutionResult {
  roomId: string;
  status: string;
  stdout: string;
  stderr: string;
  returnValue?: string;
  executionTime?: number;
  timestamp: number;
}

/** Chat message exchanged between teacher and student. */
export interface ChatMessage {
  id: string;
  roomId: string;
  sender: 'student' | 'teacher';
  text?: string;
  imageUrl?: string;
  timestamp: number;
}

/** A problem as sent to the student (without teacher-only fields). */
export interface AssignedProblem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: string;
  testCases: { input: string; expected: string }[];
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
  'problem:push': (data: { roomId: string; problem: AssignedProblem }) => void;
  'problem:push-all': (data: { problem: AssignedProblem }) => void;
  'chat:send': (data: { roomId: string; sender: 'student' | 'teacher'; text?: string; imageUrl?: string }) => void;
  'editor:lock': (data: { roomId: string }) => void;
  'editor:unlock': (data: { roomId: string }) => void;
  'code:teacher-update': (data: TeacherCodeUpdate) => void;
  'execution:request': (data: ExecutionRelayRequest) => void;
  'execution:relay-result': (data: RelayExecutionResult) => void;
}
