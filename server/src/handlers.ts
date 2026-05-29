import type { Server, Socket } from 'socket.io';
import type {
  StudentIdentity,
  AuthRequest,
  AssignedProblem,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types.js';
import { RoomManager } from './room-manager.js';
import { ChatStore } from './chat-store.js';
import { registerChatHandlers } from './chat-handlers.js';
import { registerLockHandlers } from './lock-handlers.js';
import { validateTeacherPassword } from './auth.js';

// Track which student room each teacher is currently watching
const teacherWatching: Map<string, string> = new Map();

export function registerHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager,
  chatStore: ChatStore
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

    // Send existing chat history to the newly registered student
    const chatHistory = chatStore.getHistory(record.roomId);
    if (chatHistory.length > 0) {
      socket.emit('chat:history', { roomId: record.roomId, messages: chatHistory });
    }

    // If the student was previously locked, re-notify
    if (record.isLocked) {
      socket.emit('editor:locked', { roomId: record.roomId, isLocked: true });
    }

    io.emit('roster:update', { students: roomManager.getRoster() });
  });

  socket.on('code:update', (data: { code: string; timestamp: number }) => {
    const student = roomManager.getStudentBySocket(socket.id);
    if (!student) return;

    // Block student-initiated updates when locked by teacher
    if (student.isLocked) return;

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

    // Block student-initiated executions when locked by teacher
    if (student.isLocked) return;

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
    if (student?.assignedProblem) {
      socket.emit('problem:assigned', { problem: student.assignedProblem });
    }
    // Send chat history to the subscribing teacher
    const chatHistory = chatStore.getHistory(data.roomId);
    if (chatHistory.length > 0) {
      socket.emit('chat:history', { roomId: data.roomId, messages: chatHistory });
    }
  });

  socket.on('room:unsubscribe', (data: { roomId: string }) => {
    socket.leave(data.roomId);
    teacherWatching.delete(socket.id);
  });

  socket.on('problem:push', (data: { roomId: string; problem: AssignedProblem }) => {
    if (!socket.data.isTeacher) return;

    const student = roomManager.getStudentByRoomId(data.roomId);
    if (!student) return;

    roomManager.assignProblem(student.socketId, data.problem);
    io.to(data.roomId).emit('problem:assigned', { problem: data.problem });
  });

  socket.on('problem:push-all', (data: { problem: AssignedProblem }) => {
    if (!socket.data.isTeacher) return;

    const roster = roomManager.getRoster();
    for (const entry of roster) {
      const student = roomManager.getStudentByRoomId(entry.roomId);
      if (student) {
        roomManager.assignProblem(student.socketId, data.problem);
        io.to(entry.roomId).emit('problem:assigned', { problem: data.problem });
      }
    }
  });

  // ---- Chat ----

  registerChatHandlers(io, socket, chatStore, teacherWatching, roomManager);

  // ---- Lock & Push ----

  registerLockHandlers(io, socket, teacherWatching, roomManager);

  // ---- Disconnect ----

  socket.on('disconnect', () => {
    // Auto-unlock: if teacher disconnects, unlock the student they were watching
    const watchingRoom = teacherWatching.get(socket.id);
    if (socket.data.isTeacher && watchingRoom) {
      const student = roomManager.getStudentByRoomId(watchingRoom);
      if (student && student.isLocked) {
        roomManager.unlockStudent(student.socketId);
        io.to(watchingRoom).emit('editor:unlocked', { roomId: watchingRoom, isLocked: false });
      }
    }

    teacherWatching.delete(socket.id);

    if (!socket.data.isTeacher) {
      const student = roomManager.removeStudent(socket.id);
      if (student) {
        // Notify subscribed teachers that the locked student disconnected
        if (student.isLocked) {
          io.to(student.roomId).emit('editor:unlocked', { roomId: student.roomId, isLocked: false });
        }
        io.emit('roster:update', { students: roomManager.getRoster() });
      }
    }
  });
}
