import type { RosterEntry, RemoteExecutionResult, AssignedProblem } from '../../shared/types.js';

interface CodeSnapshot {
  code: string;
  timestamp: number;
}

interface StudentRecord {
  studentId: string;
  name: string;
  roomId: string;
  socketId: string;
  joinedAt: number;
  currentCode: CodeSnapshot | null;
  lastExecution: RemoteExecutionResult | null;
  assignedProblem: AssignedProblem | null;
  isLocked: boolean;
  mode: 'free_practice' | 'classroom';
}

export class RoomManager {
  private studentsBySocket: Map<string, StudentRecord> = new Map();
  private studentIdToSocket: Map<string, string> = new Map();
  /** Pending classroom pushes for students who are in free-practice mode (offline from socket). */
  private pendingClassroom: Map<string, AssignedProblem> = new Map();
  /** Last-seen timestamps for heartbeat tracking (free-practice students). */
  private studentLastSeen: Map<string, number> = new Map();
  /** Heartbeat threshold in ms: student is "online" if seen within this window. */
  private static readonly HEARTBEAT_WINDOW = 10000;

  /** Get the socket ID for a given studentId (for kick-on-relogin). */
  getSocketByStudentId(studentId: string): string | undefined {
    return this.studentIdToSocket.get(studentId);
  }

  /** Get the student record by studentId (not socketId). */
  getStudentByStudentId(studentId: string): StudentRecord | undefined {
    const socketId = this.studentIdToSocket.get(studentId);
    if (!socketId) return undefined;
    return this.studentsBySocket.get(socketId);
  }

  /** Register the studentId → socketId mapping. */
  setStudentSocket(studentId: string, socketId: string): void {
    this.studentIdToSocket.set(studentId, socketId);
  }

  /** Remove the studentId → socketId mapping. */
  removeStudentSocket(studentId: string): void {
    this.studentIdToSocket.delete(studentId);
  }

  addStudent(socketId: string, studentId: string, name: string, mode: 'free_practice' | 'classroom' = 'classroom'): StudentRecord {
    const roomId = `room-${studentId}`;
    const record: StudentRecord = {
      studentId,
      name,
      roomId,
      socketId,
      joinedAt: Date.now(),
      currentCode: null,
      lastExecution: null,
      assignedProblem: null,
      isLocked: false,
      mode,
    };
    this.studentsBySocket.set(socketId, record);
    this.studentIdToSocket.set(studentId, socketId);
    return record;
  }

  removeStudent(socketId: string): StudentRecord | undefined {
    const record = this.studentsBySocket.get(socketId);
    if (record) {
      this.studentsBySocket.delete(socketId);
      this.studentIdToSocket.delete(record.studentId);
    }
    return record;
  }

  getStudentBySocket(socketId: string): StudentRecord | undefined {
    return this.studentsBySocket.get(socketId);
  }

  getStudentByRoomId(roomId: string): StudentRecord | undefined {
    for (const record of this.studentsBySocket.values()) {
      if (record.roomId === roomId) return record;
    }
    return undefined;
  }

  updateCode(socketId: string, code: string, timestamp: number): void {
    const record = this.studentsBySocket.get(socketId);
    if (record) {
      record.currentCode = { code, timestamp };
    }
  }

  updateExecution(socketId: string, result: RemoteExecutionResult): void {
    const record = this.studentsBySocket.get(socketId);
    if (record) {
      record.lastExecution = result;
    }
  }

  assignProblem(socketId: string, problem: AssignedProblem): void {
    const record = this.studentsBySocket.get(socketId);
    if (record) {
      record.assignedProblem = problem;
    }
  }

  getAssignedProblem(socketId: string): AssignedProblem | null {
    return this.studentsBySocket.get(socketId)?.assignedProblem ?? null;
  }

  lockStudent(socketId: string): boolean {
    const record = this.studentsBySocket.get(socketId);
    if (!record) return false;
    record.isLocked = true;
    return true;
  }

  unlockStudent(socketId: string): boolean {
    const record = this.studentsBySocket.get(socketId);
    if (!record) return false;
    record.isLocked = false;
    return true;
  }

  isStudentLocked(socketId: string): boolean {
    return this.studentsBySocket.get(socketId)?.isLocked ?? false;
  }

  /** Pending guidance descriptions for offline (free-practice) students. */
  private pendingGuidance: Map<string, string> = new Map();

  /** Store a pending classroom push for an offline (free-practice) student. */
  setPendingClassroom(studentId: string, problem: AssignedProblem): void {
    this.pendingClassroom.set(studentId, problem);
  }

  /** Get and clear the pending classroom push for a student. */
  getPendingClassroom(studentId: string): AssignedProblem | undefined {
    const problem = this.pendingClassroom.get(studentId);
    if (problem) {
      this.pendingClassroom.delete(studentId);
    }
    return problem;
  }

  /** Check if a student has a pending classroom push. */
  hasPendingClassroom(studentId: string): boolean {
    return this.pendingClassroom.has(studentId);
  }

  /** Store pending guidance for an offline (free-practice) student. */
  setPendingGuidance(studentId: string, description: string): void {
    this.pendingGuidance.set(studentId, description);
  }

  /** Get and clear the pending guidance for a student. */
  getPendingGuidance(studentId: string): string | undefined {
    const desc = this.pendingGuidance.get(studentId);
    if (desc) {
      this.pendingGuidance.delete(studentId);
    }
    return desc;
  }

  /** Only classroom-mode students appear in the roster. */
  getRoster(): RosterEntry[] {
    const entries: RosterEntry[] = [];
    for (const record of this.studentsBySocket.values()) {
      if (record.mode !== 'classroom') continue;
      entries.push({
        studentId: record.studentId,
        name: record.name,
        roomId: record.roomId,
        connected: true,
        joinedAt: record.joinedAt,
        mode: record.mode,
      });
    }
    return entries;
  }

  /** Mark a student as recently seen (called on classroom-status poll heartbeat). */
  markStudentSeen(studentId: string): void {
    this.studentLastSeen.set(studentId, Date.now());
  }

  /** Check if a student is online (socket-connected or recent heartbeat). */
  isStudentOnline(studentId: string): boolean {
    // Socket-connected (classroom mode)
    if (this.getStudentByStudentId(studentId)) return true;
    // Free-practice with recent heartbeat
    const lastSeen = this.studentLastSeen.get(studentId);
    return lastSeen != null && Date.now() - lastSeen < RoomManager.HEARTBEAT_WINDOW;
  }

  getTeacherWatchers(roomId: string): string[] {
    return []; // no longer tracking teacher watchers explicitly
  }
}
