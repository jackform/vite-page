import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.js';
import { RoomManager } from './room-manager.js';

export function registerLockHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  teacherWatching: Map<string, string>,
  roomManager: RoomManager
): void {
  socket.on('editor:lock', (data: { roomId: string }) => {
    if (!socket.data.isTeacher) return;
    const watchingRoom = teacherWatching.get(socket.id);
    if (watchingRoom !== data.roomId) return;

    const student = roomManager.getStudentByRoomId(data.roomId);
    if (!student) return;

    roomManager.lockStudent(student.socketId);
    io.to(data.roomId).emit('editor:locked', { roomId: data.roomId, isLocked: true });
  });

  socket.on('editor:unlock', (data: { roomId: string }) => {
    if (!socket.data.isTeacher) return;
    const watchingRoom = teacherWatching.get(socket.id);
    if (watchingRoom !== data.roomId) return;

    const student = roomManager.getStudentByRoomId(data.roomId);
    if (!student) return;

    roomManager.unlockStudent(student.socketId);
    io.to(data.roomId).emit('editor:unlocked', { roomId: data.roomId, isLocked: false });
  });

  socket.on('code:teacher-update', (data) => {
    if (!socket.data.isTeacher) return;
    const watchingRoom = teacherWatching.get(socket.id);
    if (watchingRoom !== data.roomId) return;

    const student = roomManager.getStudentByRoomId(data.roomId);
    if (!student || !student.isLocked) return;

    // Store teacher's code as the student's current code
    roomManager.updateCode(student.socketId, data.code, data.timestamp);

    io.to(data.roomId).emit('code:teacher-broadcast', {
      roomId: data.roomId,
      code: data.code,
      timestamp: data.timestamp,
    });
  });

  socket.on('execution:request', (data) => {
    if (!socket.data.isTeacher) return;
    const watchingRoom = teacherWatching.get(socket.id);
    if (watchingRoom !== data.roomId) return;

    const student = roomManager.getStudentByRoomId(data.roomId);
    if (!student || !student.isLocked) return;

    io.to(data.roomId).emit('execution:relay', {
      roomId: data.roomId,
      code: data.code,
    });
  });

  socket.on('execution:relay-result', (data) => {
    const student = roomManager.getStudentBySocket(socket.id);
    if (!student || !student.isLocked) return;
    if (data.roomId !== student.roomId) return;

    io.to(data.roomId).emit('execution:relay-broadcast', {
      roomId: data.roomId,
      status: data.status,
      stdout: data.stdout,
      stderr: data.stderr,
      returnValue: data.returnValue,
      executionTime: data.executionTime,
      timestamp: data.timestamp,
    });
  });
}
