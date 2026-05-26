import type { RosterEntry } from '../../shared/types';

interface StudentRecord {
  studentId: string;
  name: string;
  roomId: string;
  socketId: string;
  joinedAt: number;
}

export class RoomManager {
  private studentsBySocket: Map<string, StudentRecord> = new Map();
  private teacherWatchers: Map<string, Set<string>> = new Map();

  addStudent(socketId: string, studentId: string, name: string): StudentRecord {
    const roomId = `room-${studentId}`;
    const record: StudentRecord = {
      studentId,
      name,
      roomId,
      socketId,
      joinedAt: Date.now(),
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

  subscribeTeacher(teacherSocketId: string, roomId: string): void {
    let watchers = this.teacherWatchers.get(roomId);
    if (!watchers) {
      watchers = new Set();
      this.teacherWatchers.set(roomId, watchers);
    }
    watchers.add(teacherSocketId);
  }

  unsubscribeTeacher(teacherSocketId: string, roomId: string): void {
    const watchers = this.teacherWatchers.get(roomId);
    if (watchers) {
      watchers.delete(teacherSocketId);
      if (watchers.size === 0) {
        this.teacherWatchers.delete(roomId);
      }
    }
  }

  removeTeacher(teacherSocketId: string): void {
    for (const [roomId, watchers] of this.teacherWatchers) {
      watchers.delete(teacherSocketId);
      if (watchers.size === 0) {
        this.teacherWatchers.delete(roomId);
      }
    }
  }

  getTeacherWatchers(roomId: string): string[] {
    const watchers = this.teacherWatchers.get(roomId);
    return watchers ? Array.from(watchers) : [];
  }
}
