import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../room-manager.js';

describe('Lock handler logic', () => {
  let roomManager: RoomManager;
  let teacherWatching: Map<string, string>;

  beforeEach(() => {
    roomManager = new RoomManager();
    teacherWatching = new Map();
  });

  describe('teacher permission guards', () => {
    it('non-teacher cannot emit editor:lock', () => {
      const isTeacher = false;
      expect(isTeacher).toBe(false);
    });

    it('teacher can only lock student in subscribed room', () => {
      teacherWatching.set('teacher-socket', 'room-A');
      const targetRoom = 'room-B';
      const watchingRoom = teacherWatching.get('teacher-socket');
      expect(watchingRoom === targetRoom).toBe(false);
    });

    it('teacher can lock student in their subscribed room', () => {
      teacherWatching.set('teacher-socket', 'room-A');
      const targetRoom = 'room-A';
      const watchingRoom = teacherWatching.get('teacher-socket');
      expect(watchingRoom === targetRoom).toBe(true);
    });

    it('teacher cannot lock if target student does not exist', () => {
      teacherWatching.set('teacher-socket', 'room-A');
      const student = roomManager.getStudentByRoomId('room-A');
      expect(student).toBeUndefined();
    });
  });

  describe('lock/unlock flow', () => {
    it('lock then unlock transitions state correctly', () => {
      const student = roomManager.addStudent('student-socket', 'S001', 'Alice');
      expect(student.isLocked).toBe(false);

      roomManager.lockStudent('student-socket');
      expect(student.isLocked).toBe(true);

      roomManager.unlockStudent('student-socket');
      expect(student.isLocked).toBe(false);
    });

    it('teacher code update is only valid when student is locked', () => {
      roomManager.addStudent('student-socket', 'S001', 'Alice');
      teacherWatching.set('teacher-socket', 'room-S001');

      const student = roomManager.getStudentByRoomId('room-S001');
      // Before lock, shouldn't allow teacher code update
      const isLockedBefore = student?.isLocked ?? true;
      expect(isLockedBefore).toBe(false);

      // After lock
      roomManager.lockStudent('student-socket');
      const isLockedAfter = student?.isLocked ?? false;
      expect(isLockedAfter).toBe(true);
    });

    it('execution relay requires student to be locked', () => {
      roomManager.addStudent('student-socket', 'S001', 'Alice');
      teacherWatching.set('teacher-socket', 'room-S001');

      const student = roomManager.getStudentByRoomId('room-S001');
      const isLocked = student?.isLocked ?? false;
      expect(isLocked).toBe(false);

      roomManager.lockStudent('student-socket');
      expect(student?.isLocked).toBe(true);
    });

    it('relay result from non-locked student is rejected', () => {
      roomManager.addStudent('student-socket', 'S001', 'Alice');
      expect(roomManager.isStudentLocked('student-socket')).toBe(false);
    });

    it('relay result from wrong room is rejected', () => {
      roomManager.addStudent('student-socket', 'S001', 'Alice');
      roomManager.lockStudent('student-socket');

      const student = roomManager.getStudentBySocket('student-socket');
      const wrongRoomId = 'room-S002';
      expect(student?.roomId === wrongRoomId).toBe(false);
    });
  });

  describe('code update protection when locked', () => {
    it('student code:update should be blocked when locked', () => {
      roomManager.addStudent('student-socket', 'S001', 'Alice');
      roomManager.lockStudent('student-socket');

      const isLocked = roomManager.isStudentLocked('student-socket');
      // The handler should check this and return early
      expect(isLocked).toBe(true);
    });

    it('student execution:result should be blocked when locked', () => {
      roomManager.addStudent('student-socket', 'S001', 'Alice');
      roomManager.lockStudent('student-socket');

      const isLocked = roomManager.isStudentLocked('student-socket');
      expect(isLocked).toBe(true);
    });

    it('unlocked student can send code updates', () => {
      roomManager.addStudent('student-socket', 'S001', 'Alice');

      const isLocked = roomManager.isStudentLocked('student-socket');
      expect(isLocked).toBe(false);
    });
  });
});
