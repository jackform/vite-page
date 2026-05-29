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

  // ---- Guidance Push ----

  socket.on('guidance:push', (data: { roomId: string; description: string }) => {
    if (!socket.data.isTeacher) return;

    if (!data.roomId || typeof data.description !== 'string') return;

    // Validate: description max 5_000_000 chars (~5MB, accommodates embedded images)
    if (data.description.length > 5_000_000) return;

    // Validate: no individual data URL exceeds 3M chars
    const dataUrls = data.description.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
    if (dataUrls) {
      for (const url of dataUrls) {
        if (url.length > 3_000_000) return;
      }
    }

    // Forward to the room
    io.to(data.roomId).emit('guidance:update', { description: data.description });
  });

  // ---- Chat ----

  registerChatHandlers(io, socket, chatStore, teacherWatching, roomManager);

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
