import type { Server, Socket } from 'socket.io';
import type {
  StudentIdentity,
  AuthRequest,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types';
import { RoomManager } from './room-manager';
import { validateTeacherPassword } from './auth';

// Track which student room each teacher is currently watching
const teacherWatching: Map<string, string> = new Map();

export function registerHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  // ---- Student Events ----

  socket.on('student:register', (identity: StudentIdentity) => {
    const { name, studentId } = identity;

    if (!name || !name.trim()) {
      socket.emit('register:error', { error: 'Name is required' });
      return;
    }
    if (!studentId || !studentId.trim()) {
      socket.emit('register:error', { error: 'Student ID is required' });
      return;
    }

    const record = roomManager.addStudent(socket.id, studentId.trim(), name.trim());
    socket.join(record.roomId);

    socket.emit('session:registered', {
      roomId: record.roomId,
      userId: socket.id,
      studentName: record.name,
      studentId: record.studentId,
    });

    io.emit('roster:update', { students: roomManager.getRoster() });
  });

  socket.on('code:update', (data: { code: string; timestamp: number }) => {
    const student = roomManager.getStudentBySocket(socket.id);
    if (!student) return;

    // Store latest code state on server
    roomManager.updateCode(socket.id, data.code, data.timestamp);

    // Broadcast to all watchers EXCEPT the sender
    socket.to(student.roomId).emit('code:broadcast', {
      roomId: student.roomId,
      code: data.code,
      studentName: student.name,
      timestamp: data.timestamp,
    });
  });

  socket.on('execution:result', (data) => {
    const student = roomManager.getStudentBySocket(socket.id);
    if (!student) return;

    const result = {
      roomId: student.roomId,
      status: data.status,
      stdout: data.stdout,
      stderr: data.stderr,
      returnValue: data.returnValue,
      passedCount: data.passedCount,
      totalCount: data.totalCount,
      executionTime: data.executionTime,
      timestamp: data.timestamp,
    };

    // Store latest execution result on server
    roomManager.updateExecution(socket.id, result);

    socket.to(student.roomId).emit('execution:broadcast', result);
  });

  // ---- Teacher Events ----

  socket.on('teacher:auth', (data: AuthRequest) => {
    if (validateTeacherPassword(data.password)) {
      socket.data.isTeacher = true;
      socket.emit('auth:result', { success: true });
      socket.emit('roster:update', { students: roomManager.getRoster() });
    } else {
      socket.emit('auth:result', { success: false, error: 'Invalid password' });
    }
  });

  socket.on('room:subscribe', (data: { roomId: string }) => {
    if (!socket.data.isTeacher) return;

    // Leave previously watched room
    const prevRoom = teacherWatching.get(socket.id);
    if (prevRoom) {
      socket.leave(prevRoom);
    }

    // Join new room
    socket.join(data.roomId);
    teacherWatching.set(socket.id, data.roomId);

    // Send the student's current code and execution state immediately
    const student = roomManager.getStudentByRoomId(data.roomId);
    if (student?.currentCode) {
      socket.emit('code:broadcast', {
        roomId: student.roomId,
        code: student.currentCode.code,
        studentName: student.name,
        timestamp: student.currentCode.timestamp,
      });
    }
    if (student?.lastExecution) {
      socket.emit('execution:broadcast', student.lastExecution);
    }
  });

  socket.on('room:unsubscribe', (data: { roomId: string }) => {
    socket.leave(data.roomId);
    teacherWatching.delete(socket.id);
  });

  // ---- Disconnect ----

  socket.on('disconnect', () => {
    teacherWatching.delete(socket.id);

    if (!socket.data.isTeacher) {
      const student = roomManager.removeStudent(socket.id);
      if (student) {
        io.emit('roster:update', { students: roomManager.getRoster() });
      }
    }
  });
}
