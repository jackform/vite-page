import type { Server, Socket } from 'socket.io';
import type {
  StudentIdentity,
  AuthRequest,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types';
import { RoomManager } from './room-manager';
import { validateTeacherPassword } from './auth';

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

    // Notify all teachers
    io.emit('roster:update', { students: roomManager.getRoster() });
  });

  socket.on('code:update', (data: { code: string; timestamp: number }) => {
    const student = roomManager.getStudentBySocket(socket.id);
    if (!student) return;

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

    socket.to(student.roomId).emit('execution:broadcast', {
      roomId: student.roomId,
      status: data.status,
      stdout: data.stdout,
      stderr: data.stderr,
      returnValue: data.returnValue,
      passedCount: data.passedCount,
      totalCount: data.totalCount,
      executionTime: data.executionTime,
      timestamp: data.timestamp,
    });
  });

  // ---- Teacher Events ----

  socket.on('teacher:auth', (data: AuthRequest) => {
    if (validateTeacherPassword(data.password)) {
      socket.data.isTeacher = true;
      socket.emit('auth:result', { success: true });
      // Send current full roster
      socket.emit('roster:update', { students: roomManager.getRoster() });
    } else {
      socket.emit('auth:result', { success: false, error: 'Invalid password' });
    }
  });

  socket.on('room:subscribe', (data: { roomId: string }) => {
    if (!socket.data.isTeacher) return;

    // Leave previously subscribed rooms (teacher watches one at a time)
    for (const room of socket.rooms) {
      if (room !== socket.id && room.startsWith('room-')) {
        socket.leave(room);
        roomManager.unsubscribeTeacher(socket.id, room);
      }
    }

    socket.join(data.roomId);
    roomManager.subscribeTeacher(socket.id, data.roomId);
  });

  socket.on('room:unsubscribe', (data: { roomId: string }) => {
    socket.leave(data.roomId);
    roomManager.unsubscribeTeacher(socket.id, data.roomId);
  });

  // ---- Disconnect ----

  socket.on('disconnect', () => {
    if (socket.data.isTeacher) {
      roomManager.removeTeacher(socket.id);
    } else {
      const student = roomManager.removeStudent(socket.id);
      if (student) {
        io.emit('roster:update', { students: roomManager.getRoster() });
      }
    }
  });
}
