import type { RosterEntry, RemoteExecutionResult } from '../../shared/types.js';

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
}

export class RoomManager {
  private studentsBySocket: Map<string, StudentRecord> = new Map();

  addStudent(socketId: string, studentId: string, name: string): StudentRecord {
    const roomId = `room-${studentId}`;
    const record: StudentRecord = {
      studentId,
      name,
      roomId,
      socketId,
      joinedAt: Date.now(),
      currentCode: null,
      lastExecution: null,
    };
    this.studentsBySocket.set(socketId, record);
    return record;
  }

  removeStudent(socketId: string): StudentRecord | undefined {
    const record = this.studentsBySocket.get(socketId);
    if (record) {
      this.studentsBySocket.delete(socketId);
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

  getRoster(): RosterEntry[] {
    const entries: RosterEntry[] = [];
    for (const record of this.studentsBySocket.values()) {
      entries.push({
        studentId: record.studentId,
        name: record.name,
        roomId: record.roomId,
        connected: true,
        joinedAt: record.joinedAt,
      });
    }
    return entries;
  }

  getTeacherWatchers(roomId: string): string[] {
    return []; // no longer tracking teacher watchers explicitly
  }
}
