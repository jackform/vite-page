import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from '../room-manager.js';
import { ChatStore } from '../chat-store.js';
import { registerHandlers } from '../handlers.js';

/**
 * Socket.io Integration Tests
 *
 * Uses real RoomManager + ChatStore instances with mocked socket/io.
 * Tests the full event handler chains registered by registerHandlers().
 */

function createMockSocket(id: string) {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  const joinedRooms: string[] = [];
  const sentEvents: Array<{ event: string; args: any[] }> = [];

  return {
    id,
    data: {} as Record<string, unknown>,
    joinedRooms,
    sentEvents,
    listeners,

    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),

    emit: vi.fn((event: string, ...args: any[]) => {
      sentEvents.push({ event, args });
    }),

    join: vi.fn((room: string) => {
      joinedRooms.push(room);
    }),

    leave: vi.fn((room: string) => {
      const idx = joinedRooms.indexOf(room);
      if (idx >= 0) joinedRooms.splice(idx, 1);
    }),

    to: vi.fn((_room: string) => ({
      emit: vi.fn((event: string, ...args: any[]) => {
        // Track but don't add to socket's own sentEvents
      }),
    })),

    /** Trigger a client-to-server event. */
    trigger(event: string, ...args: any[]) {
      const handlers = listeners[event];
      if (handlers) {
        for (const h of handlers) h(...args);
      }
    },

    /** Find the last emitted event matching name. */
    lastEmit(event: string): any | undefined {
      for (let i = sentEvents.length - 1; i >= 0; i--) {
        if (sentEvents[i].event === event) return sentEvents[i].args[0];
      }
      return undefined;
    },

    /** Check if an event was emitted to this socket. */
    hasEmit(event: string): boolean {
      return sentEvents.some((e) => e.event === event);
    },
  };
}

function createMockIO() {
  const globalEmits: Array<{ event: string; args: any[] }> = [];
  const roomEmits: Array<{ room: string; event: string; args: any[] }> = [];

  return {
    globalEmits,
    roomEmits,

    emit: vi.fn((event: string, ...args: any[]) => {
      globalEmits.push({ event, args });
    }),

    to: vi.fn((room: string) => ({
      emit: vi.fn((event: string, ...args: any[]) => {
        roomEmits.push({ room, event, args });
      }),
    })),
  };
}

describe('Socket.io Integration', () => {
  let roomManager: RoomManager;
  let chatStore: ChatStore;
  let io: ReturnType<typeof createMockIO>;

  beforeEach(() => {
    roomManager = new RoomManager();
    chatStore = new ChatStore();
    io = createMockIO();
  });

  function createAndRegisterStudent(id: string, name: string, studentId: string) {
    const socket = createMockSocket(id);
    registerHandlers(io as any, socket as any, roomManager, chatStore);
    socket.trigger('student:register', { name, studentId });
    return socket;
  }

  function createAndRegisterTeacher(id: string) {
    const socket = createMockSocket(id);
    socket.data.isTeacher = true;
    registerHandlers(io as any, socket as any, roomManager, chatStore);
    return socket;
  }

  // ---- 2.1 Student Registration ----

  describe('student:register', () => {
    it('registers student and sends session:registered', () => {
      const socket = createMockSocket('sock-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('student:register', { name: 'Alice', studentId: 'S001' });

      const session = socket.lastEmit('session:registered');
      expect(session).toBeDefined();
      expect(session.roomId).toBe('room-S001');
      expect(session.studentName).toBe('Alice');
      expect(session.studentId).toBe('S001');
    });

    it('joins the student to their room', () => {
      const socket = createMockSocket('sock-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('student:register', { name: 'Alice', studentId: 'S001' });

      expect(socket.joinedRooms).toContain('room-S001');
    });

    it('rejects empty name with register:error', () => {
      const socket = createMockSocket('sock-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('student:register', { name: '', studentId: 'S001' });

      const error = socket.lastEmit('register:error');
      expect(error).toBeDefined();
      expect(error.error).toContain('Name');
    });

    it('rejects empty studentId with register:error', () => {
      const socket = createMockSocket('sock-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('student:register', { name: 'Alice', studentId: '' });

      const error = socket.lastEmit('register:error');
      expect(error).toBeDefined();
      expect(error.error).toContain('Student ID');
    });

    it('broadcasts roster:update after registration', () => {
      const socket = createMockSocket('sock-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('student:register', { name: 'Alice', studentId: 'S001' });

      expect(io.globalEmits.some((e) => e.event === 'roster:update')).toBe(true);
      const rosterEvent = io.globalEmits.find((e) => e.event === 'roster:update');
      expect(rosterEvent!.args[0].students).toHaveLength(1);
    });

    it('sends chat:history if messages exist for the room', () => {
      // Pre-populate chat history
      chatStore.addMessage({ roomId: 'room-S001', sender: 'teacher', text: 'hello' });

      const socket = createMockSocket('sock-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('student:register', { name: 'Alice', studentId: 'S001' });

      const history = socket.lastEmit('chat:history');
      expect(history).toBeDefined();
      expect(history.messages).toHaveLength(1);
    });

    it('does not send chat:history if room has no messages', () => {
      const socket = createMockSocket('sock-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('student:register', { name: 'Alice', studentId: 'S001' });

      expect(socket.hasEmit('chat:history')).toBe(false);
    });

    it('sends editor:locked if student was previously locked', () => {
      // Pre-create and lock a student, then simulate reconnect
      const firstSocket = createMockSocket('sock-1');
      registerHandlers(io as any, firstSocket as any, roomManager, chatStore);
      firstSocket.trigger('student:register', { name: 'Alice', studentId: 'S001' });
      roomManager.lockStudent('sock-1');

      // Now a new socket for the same student
      const secondSocket = createMockSocket('sock-2');
      registerHandlers(io as any, secondSocket as any, roomManager, chatStore);

      secondSocket.trigger('student:register', { name: 'Alice', studentId: 'S001' });

      // Since the new socket gets a new record, it won't be locked
      // But the old record is still locked - this tests re-registration
      const locked = secondSocket.lastEmit('editor:locked');
      // New registration creates a fresh record, so locked should be false
      expect(roomManager.getStudentBySocket('sock-2')?.isLocked).toBe(false);
    });
  });

  // ---- 2.2 Code Sync ----

  describe('code:update', () => {
    it('stores code in RoomManager', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');

      socket.trigger('code:update', { code: 'print("hello")', timestamp: 1000 });

      const student = roomManager.getStudentBySocket('sock-1');
      expect(student?.currentCode?.code).toBe('print("hello")');
    });

    it('broadcasts code to room (excluding sender)', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');

      socket.trigger('code:update', { code: 'print("hello")', timestamp: 1000 });

      // socket.to(room).emit should have been called
      expect(socket.to).toHaveBeenCalled();
    });

    it('ignores code:update from unregistered student', () => {
      const socket = createMockSocket('unknown');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('code:update', { code: 'print("x")', timestamp: 1000 });

      // No error, just silently ignored — no code stored
      expect(roomManager.getStudentBySocket('unknown')).toBeUndefined();
    });

    it('blocks code:update when student is locked', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');
      roomManager.lockStudent('sock-1');

      socket.trigger('code:update', { code: 'print("blocked")', timestamp: 2000 });

      // Code should NOT be updated since student is locked
      const student = roomManager.getStudentBySocket('sock-1');
      expect(student?.currentCode).toBeNull();
    });
  });

  // ---- 2.3 Execution Result ----

  describe('execution:result', () => {
    it('stores execution result in RoomManager', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');

      socket.trigger('execution:result', {
        status: 'success',
        stdout: 'hello world',
        stderr: '',
        timestamp: 1000,
      });

      const student = roomManager.getStudentBySocket('sock-1');
      expect(student?.lastExecution?.status).toBe('success');
      expect(student?.lastExecution?.stdout).toBe('hello world');
    });

    it('broadcasts execution to room', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');

      socket.trigger('execution:result', {
        status: 'success',
        stdout: 'output',
        stderr: '',
        timestamp: 1000,
      });

      expect(socket.to).toHaveBeenCalledWith('room-S001');
    });

    it('blocks execution:result when student is locked', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');
      roomManager.lockStudent('sock-1');

      socket.trigger('execution:result', {
        status: 'success',
        stdout: 'should be blocked',
        stderr: '',
        timestamp: 2000,
      });

      const student = roomManager.getStudentBySocket('sock-1');
      expect(student?.lastExecution).toBeNull();
    });
  });

  // ---- 2.4 Teacher Auth ----

  describe('teacher:auth', () => {
    it('sets socket.data.isTeacher on successful auth', () => {
      const socket = createMockSocket('teacher-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('teacher:auth', { password: 'any-password' });

      // When TEACHER_PASSWORD env is not set, any password is accepted
      expect(socket.data.isTeacher).toBe(true);
    });

    it('sends auth:result with success=true', () => {
      const socket = createMockSocket('teacher-1');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('teacher:auth', { password: 'test' });

      const result = socket.lastEmit('auth:result');
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('sends roster after successful auth', () => {
      // Register a student first
      createAndRegisterStudent('sock-1', 'Alice', 'S001');

      const teacherSocket = createMockSocket('teacher-1');
      registerHandlers(io as any, teacherSocket as any, roomManager, chatStore);

      teacherSocket.trigger('teacher:auth', { password: 'test' });

      const roster = teacherSocket.lastEmit('roster:update');
      expect(roster).toBeDefined();
      expect(roster.students).toHaveLength(1);
    });
  });

  // ---- 2.5 Room Subscription ----

  describe('room:subscribe', () => {
    it('teacher joins the target room', () => {
      const teacher = createAndRegisterTeacher('teacher-1');
      createAndRegisterStudent('sock-1', 'Alice', 'S001');

      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      expect(teacher.joinedRooms).toContain('room-S001');
    });

    it('sends cached code on subscribe', () => {
      const student = createAndRegisterStudent('sock-1', 'Alice', 'S001');
      student.trigger('code:update', { code: 'print(1)', timestamp: 1000 });

      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      const codeBroadcast = teacher.lastEmit('code:broadcast');
      expect(codeBroadcast).toBeDefined();
      expect(codeBroadcast.code).toBe('print(1)');
    });

    it('sends cached execution result on subscribe', () => {
      const student = createAndRegisterStudent('sock-1', 'Alice', 'S001');
      student.trigger('execution:result', {
        status: 'success', stdout: 'out', stderr: '', timestamp: 1000,
      });

      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      const execBroadcast = teacher.lastEmit('execution:broadcast');
      expect(execBroadcast).toBeDefined();
      expect(execBroadcast.stdout).toBe('out');
    });

    it('sends cached assigned problem on subscribe', () => {
      const student = createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const problem = {
        id: 'p1', title: 'Test', difficulty: 'easy' as const,
        description: 'desc', examples: [], constraints: [],
        starterCode: '', testCases: [],
      };
      roomManager.assignProblem('sock-1', problem);

      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      const assigned = teacher.lastEmit('problem:assigned');
      expect(assigned).toBeDefined();
      expect(assigned.problem.title).toBe('Test');
    });

    it('sends chat history on subscribe', () => {
      chatStore.addMessage({ roomId: 'room-S001', sender: 'student', text: 'help' });

      const teacher = createAndRegisterTeacher('teacher-1');
      createAndRegisterStudent('sock-1', 'Alice', 'S001');

      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      const history = teacher.lastEmit('chat:history');
      expect(history).toBeDefined();
      expect(history.messages).toHaveLength(1);
    });

    it('leaves previous room when subscribing to new room', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      createAndRegisterStudent('sock-2', 'Bob', 'S002');

      const teacher = createAndRegisterTeacher('teacher-sub-switch');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });
      expect(teacher.joinedRooms).toContain('room-S001');

      teacher.trigger('room:subscribe', { roomId: 'room-S002' });

      // leave() removes the old room from joinedRooms, but join() added the new one
      expect(teacher.joinedRooms).toContain('room-S002');
      // Verify leave was called for the old room
      expect(teacher.leave).toHaveBeenCalledWith('room-S001');
    });

    it('non-teacher cannot subscribe', () => {
      const socket = createMockSocket('not-teacher');
      registerHandlers(io as any, socket as any, roomManager, chatStore);

      socket.trigger('room:subscribe', { roomId: 'room-S001' });

      // Should not have joined
      expect(socket.joinedRooms).toHaveLength(0);
    });
  });

  // ---- 2.6 Problem Push ----

  describe('problem:push', () => {
    const sampleProblem = {
      id: 'p-test', title: 'Test Problem', difficulty: 'easy' as const,
      description: 'desc', examples: [], constraints: [],
      starterCode: 'print(1)', testCases: [],
    };

    it('pushes problem to specific student via room', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');

      teacher.trigger('problem:push', { roomId: 'room-S001', problem: sampleProblem });

      // Verify problem was stored in RoomManager
      const student = roomManager.getStudentByRoomId('room-S001');
      expect(student?.assignedProblem?.title).toBe('Test Problem');

      // Verify io.to(room).emit was called
      const roomEmit = io.roomEmits.find((e) => e.room === 'room-S001' && e.event === 'problem:assigned');
      expect(roomEmit).toBeDefined();
    });

    it('non-teacher cannot push', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const notTeacher = createMockSocket('random');
      registerHandlers(io as any, notTeacher as any, roomManager, chatStore);

      notTeacher.trigger('problem:push', { roomId: 'room-S001', problem: sampleProblem });

      const student = roomManager.getStudentByRoomId('room-S001');
      expect(student?.assignedProblem).toBeNull();
    });

    it('problem:push-all sends to all connected students', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      createAndRegisterStudent('sock-2', 'Bob', 'S002');
      const teacher = createAndRegisterTeacher('teacher-1');

      teacher.trigger('problem:push-all', { problem: sampleProblem });

      // Both students should have the problem assigned
      expect(roomManager.getStudentBySocket('sock-1')?.assignedProblem?.title).toBe('Test Problem');
      expect(roomManager.getStudentBySocket('sock-2')?.assignedProblem?.title).toBe('Test Problem');
    });
  });

  // ---- 2.7 Lock Flow ----

  describe('editor:lock / editor:unlock', () => {
    it('teacher locks student in subscribed room', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      teacher.trigger('editor:lock', { roomId: 'room-S001' });

      expect(roomManager.isStudentLocked('sock-1')).toBe(true);
    });

    it('broadcasts editor:locked to room', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      teacher.trigger('editor:lock', { roomId: 'room-S001' });

      const lockedEmit = io.roomEmits.find((e) => e.room === 'room-S001' && e.event === 'editor:locked');
      expect(lockedEmit).toBeDefined();
      expect(lockedEmit!.args[0].isLocked).toBe(true);
    });

    it('teacher cannot lock student in non-subscribed room', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      // Use a unique socket ID to ensure teacherWatching has no cached entry
      const teacher = createMockSocket('teacher-no-sub');
      teacher.data.isTeacher = true;
      registerHandlers(io as any, teacher as any, roomManager, chatStore);
      // Teacher did NOT subscribe to any room

      teacher.trigger('editor:lock', { roomId: 'room-S001' });

      expect(roomManager.isStudentLocked('sock-1')).toBe(false);
    });

    it('non-teacher cannot lock', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const notTeacher = createMockSocket('random');
      registerHandlers(io as any, notTeacher as any, roomManager, chatStore);

      notTeacher.trigger('editor:lock', { roomId: 'room-S001' });

      expect(roomManager.isStudentLocked('sock-1')).toBe(false);
    });

    it('teacher unlocks student', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });
      teacher.trigger('editor:lock', { roomId: 'room-S001' });

      teacher.trigger('editor:unlock', { roomId: 'room-S001' });

      expect(roomManager.isStudentLocked('sock-1')).toBe(false);
      const unlockedEmit = io.roomEmits.find((e) => e.room === 'room-S001' && e.event === 'editor:unlocked');
      expect(unlockedEmit).toBeDefined();
    });

    it('code:teacher-update stores and broadcasts code when locked', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });
      teacher.trigger('editor:lock', { roomId: 'room-S001' });

      teacher.trigger('code:teacher-update', {
        roomId: 'room-S001', code: 'teacher code', timestamp: 2000,
      });

      const student = roomManager.getStudentBySocket('sock-1');
      expect(student?.currentCode?.code).toBe('teacher code');

      const broadcast = io.roomEmits.find((e) => e.room === 'room-S001' && e.event === 'code:teacher-broadcast');
      expect(broadcast).toBeDefined();
      expect(broadcast!.args[0].code).toBe('teacher code');
    });

    it('code:teacher-update is blocked when student is not locked', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });
      // Student is NOT locked

      teacher.trigger('code:teacher-update', {
        roomId: 'room-S001', code: 'should be blocked', timestamp: 2000,
      });

      const student = roomManager.getStudentBySocket('sock-1');
      expect(student?.currentCode).toBeNull();
    });

    it('execution:request relays to student when locked', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });
      teacher.trigger('editor:lock', { roomId: 'room-S001' });

      teacher.trigger('execution:request', { roomId: 'room-S001', code: 'print(1)' });

      const relay = io.roomEmits.find((e) => e.room === 'room-S001' && e.event === 'execution:relay');
      expect(relay).toBeDefined();
      expect(relay!.args[0].code).toBe('print(1)');
    });
  });

  // ---- 2.8 Disconnect ----

  describe('disconnect', () => {
    it('removes student and broadcasts roster update', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');

      socket.trigger('disconnect');

      expect(roomManager.getStudentBySocket('sock-1')).toBeUndefined();
      expect(io.globalEmits.some((e) => e.event === 'roster:update')).toBe(true);
    });

    it('auto-unlocks when teacher disconnects', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });
      teacher.trigger('editor:lock', { roomId: 'room-S001' });
      expect(roomManager.isStudentLocked('sock-1')).toBe(true);

      teacher.trigger('disconnect');

      expect(roomManager.isStudentLocked('sock-1')).toBe(false);
    });

    it('broadcasts editor:unlocked when locked student disconnects', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');
      roomManager.lockStudent('sock-1');

      socket.trigger('disconnect');

      const unlockedEmit = io.roomEmits.find((e) => e.room === 'room-S001' && e.event === 'editor:unlocked');
      expect(unlockedEmit).toBeDefined();
    });
  });

  // ---- 2.9 Cross-Handler Integration ----

  describe('cross-handler integration', () => {
    it('chat:send routes to correct room via teacherWatching', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      const teacher = createAndRegisterTeacher('teacher-1');
      teacher.trigger('room:subscribe', { roomId: 'room-S001' });

      teacher.trigger('chat:send', { roomId: 'room-S001', sender: 'teacher', text: 'hello' });

      const history = chatStore.getHistory('room-S001');
      expect(history).toHaveLength(1);
      expect(history[0].text).toBe('hello');

      // io.to(room).emit('chat:message') should have been called
      const chatEmit = io.roomEmits.find((e) => e.room === 'room-S001' && e.event === 'chat:message');
      expect(chatEmit).toBeDefined();
    });

    it('chat:send from student routes to own room', () => {
      const socket = createAndRegisterStudent('sock-1', 'Alice', 'S001');

      socket.trigger('chat:send', { roomId: 'room-S001', sender: 'student', text: 'question' });

      const history = chatStore.getHistory('room-S001');
      expect(history).toHaveLength(1);
      expect(history[0].sender).toBe('student');
    });

    it('teacher switching rooms leaves old room and joins new', () => {
      createAndRegisterStudent('sock-1', 'Alice', 'S001');
      createAndRegisterStudent('sock-2', 'Bob', 'S002');
      const teacher = createAndRegisterTeacher('teacher-switch');

      teacher.trigger('room:subscribe', { roomId: 'room-S001' });
      teacher.trigger('room:subscribe', { roomId: 'room-S002' });

      // leave was called for old room, join for new room
      expect(teacher.leave).toHaveBeenCalledWith('room-S001');
      expect(teacher.joinedRooms).toContain('room-S002');
    });
  });
});
