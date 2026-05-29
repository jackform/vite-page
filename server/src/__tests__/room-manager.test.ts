import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../room-manager.js';

describe('RoomManager lock state', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it('new student is not locked by default', () => {
    const student = roomManager.addStudent('socket-1', 'S001', 'Alice');
    expect(student.isLocked).toBe(false);
    expect(roomManager.isStudentLocked('socket-1')).toBe(false);
  });

  it('lockStudent sets isLocked to true', () => {
    roomManager.addStudent('socket-1', 'S001', 'Alice');
    const result = roomManager.lockStudent('socket-1');
    expect(result).toBe(true);
    expect(roomManager.isStudentLocked('socket-1')).toBe(true);
  });

  it('unlockStudent sets isLocked to false', () => {
    roomManager.addStudent('socket-1', 'S001', 'Alice');
    roomManager.lockStudent('socket-1');
    const result = roomManager.unlockStudent('socket-1');
    expect(result).toBe(true);
    expect(roomManager.isStudentLocked('socket-1')).toBe(false);
  });

  it('lockStudent returns false for unknown socket', () => {
    expect(roomManager.lockStudent('unknown')).toBe(false);
  });

  it('unlockStudent returns false for unknown socket', () => {
    expect(roomManager.unlockStudent('unknown')).toBe(false);
  });

  it('isStudentLocked returns false for unknown socket', () => {
    expect(roomManager.isStudentLocked('unknown')).toBe(false);
  });

  it('lock state persists after lock and is independent per student', () => {
    roomManager.addStudent('socket-1', 'S001', 'Alice');
    roomManager.addStudent('socket-2', 'S002', 'Bob');

    roomManager.lockStudent('socket-1');
    expect(roomManager.isStudentLocked('socket-1')).toBe(true);
    expect(roomManager.isStudentLocked('socket-2')).toBe(false);
  });

  it('lock does not affect code update and retrieval', () => {
    const student = roomManager.addStudent('socket-1', 'S001', 'Alice');
    roomManager.lockStudent('socket-1');

    roomManager.updateCode('socket-1', 'print("hello")', Date.now());
    expect(student.currentCode?.code).toBe('print("hello")');

    roomManager.unlockStudent('socket-1');
    expect(student.currentCode?.code).toBe('print("hello")');
  });

  it('removeStudent clears lock state along with student', () => {
    roomManager.addStudent('socket-1', 'S001', 'Alice');
    roomManager.lockStudent('socket-1');

    roomManager.removeStudent('socket-1');
    expect(roomManager.isStudentLocked('socket-1')).toBe(false);
  });
});
