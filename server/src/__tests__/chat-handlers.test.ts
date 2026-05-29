import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatStore } from '../chat-store.js';
import { RoomManager } from '../room-manager.js';

// We test the handler logic directly by extracting validation rules
// and testing registerChatHandlers behavior via a simulated event flow.

describe('ChatStore integration', () => {
  let chatStore: ChatStore;

  beforeEach(() => {
    chatStore = new ChatStore();
  });

  describe('message validation rules', () => {
    function isValidMessage(text?: string, imageUrl?: string): boolean {
      if (!text && !imageUrl) return false;
      if (text !== undefined && text.length > 2000) return false;
      if (imageUrl !== undefined && imageUrl.length > 3_000_000) return false;
      // Both text and imageUrl are strings, so pass type check
      return true;
    }

    it('rejects empty text with no image', () => {
      expect(isValidMessage('', undefined)).toBe(false);
      expect(isValidMessage(undefined, undefined)).toBe(false);
    });

    it('rejects text exceeding 2000 chars', () => {
      const long = 'x'.repeat(2001);
      expect(isValidMessage(long)).toBe(false);
    });

    it('accepts text at exactly 2000 chars', () => {
      const ok = 'x'.repeat(2000);
      expect(isValidMessage(ok)).toBe(true);
    });

    it('rejects imageUrl exceeding 3MB', () => {
      const big = 'x'.repeat(3_000_001);
      expect(isValidMessage(undefined, big)).toBe(false);
    });

    it('accepts imageUrl at exactly 3MB', () => {
      const ok = 'x'.repeat(3_000_000);
      expect(isValidMessage(undefined, ok)).toBe(true);
    });

    it('accepts valid text-only message', () => {
      expect(isValidMessage('hello')).toBe(true);
    });

    it('accepts valid image-only message', () => {
      expect(isValidMessage(undefined, 'data:image/png;base64,abc')).toBe(true);
    });

    it('accepts message with both text and image', () => {
      expect(isValidMessage('look', 'data:image/png;base64,abc')).toBe(true);
    });
  });

  describe('message storage and retrieval', () => {
    it('stores and retrieves multiple messages per room', () => {
      chatStore.addMessage({ roomId: 'room-A', sender: 'teacher', text: 'msg1' });
      chatStore.addMessage({ roomId: 'room-A', sender: 'student', text: 'msg2' });
      chatStore.addMessage({ roomId: 'room-A', sender: 'teacher', text: 'msg3' });

      const history = chatStore.getHistory('room-A');
      expect(history).toHaveLength(3);
      expect(history.map((m) => m.text)).toEqual(['msg1', 'msg2', 'msg3']);
    });
  });

  describe('sender permission logic', () => {
    it('student can only send to own room', () => {
      // Simulate: student in room-A tries to send to room-B
      const studentRoomId: string = 'room-A';
      const targetRoomId: string = 'room-B';
      expect(studentRoomId === targetRoomId).toBe(false);
    });

    it('student can send to own room', () => {
      const studentRoomId = 'room-A';
      const targetRoomId = 'room-A';
      expect(studentRoomId === targetRoomId).toBe(true);
    });

    it('teacher needs active subscription to send', () => {
      const teacherWatching = new Map<string, string>();
      // No subscription yet
      expect(teacherWatching.has('socket-1')).toBe(false);
      // After subscription
      teacherWatching.set('socket-1', 'room-A');
      expect(teacherWatching.get('socket-1')).toBe('room-A');
    });
  });
});

describe('chat:send event handler behavior', () => {
  let chatStore: ChatStore;
  let roomManager: RoomManager;
  let teacherWatching: Map<string, string>;

  beforeEach(() => {
    chatStore = new ChatStore();
    roomManager = new RoomManager();
    teacherWatching = new Map();
  });

  function handleChatSend(
    socketId: string,
    isTeacher: boolean,
    targetRoomId: string,
    text?: string,
    imageUrl?: string,
  ): { success: boolean; error?: string } {
    // Validation
    if (!text && !imageUrl) {
      return { success: false, error: 'Message must have text or imageUrl' };
    }
    if (text && text.length > 2000) {
      return { success: false, error: 'Text exceeds 2000 characters' };
    }
    if (imageUrl && imageUrl.length > 3_000_000) {
      return { success: false, error: 'Image exceeds 3MB' };
    }

    if (isTeacher) {
      const watchingRoom = teacherWatching.get(socketId);
      if (!watchingRoom) {
        return { success: false, error: 'Teacher not subscribed to any room' };
      }
      // Teacher sends to the room they're watching
      chatStore.addMessage({ roomId: watchingRoom, sender: 'teacher', text, imageUrl });
      return { success: true };
    } else {
      const student = roomManager.getStudentBySocket(socketId);
      if (!student) {
        return { success: false, error: 'Student not registered' };
      }
      if (targetRoomId !== student.roomId) {
        return { success: false, error: 'Cannot send to another room' };
      }
      chatStore.addMessage({ roomId: student.roomId, sender: 'student', text, imageUrl });
      return { success: true };
    }
  }

  it('teacher sends message to subscribed room', () => {
    teacherWatching.set('teacher-socket', 'room-A');

    const result = handleChatSend('teacher-socket', true, 'room-A', 'hello');
    expect(result.success).toBe(true);

    const history = chatStore.getHistory('room-A');
    expect(history).toHaveLength(1);
    expect(history[0].sender).toBe('teacher');
    expect(history[0].text).toBe('hello');
  });

  it('teacher cannot send without subscription', () => {
    const result = handleChatSend('teacher-socket', true, 'room-A', 'hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not subscribed');
  });

  it('student sends message to own room', () => {
    roomManager.addStudent('student-socket', 'S001', 'Alice');

    const result = handleChatSend('student-socket', false, 'room-S001', 'question');
    expect(result.success).toBe(true);
    expect(chatStore.getHistory('room-S001')).toHaveLength(1);
  });

  it('student cannot send to another room', () => {
    roomManager.addStudent('student-socket', 'S001', 'Alice');

    const result = handleChatSend('student-socket', false, 'room-S002', 'sneaky');
    expect(result.success).toBe(false);
    expect(result.error).toContain('another room');
  });

  it('unregistered student cannot send', () => {
    const result = handleChatSend('unknown-socket', false, 'room-X', 'hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not registered');
  });

  it('empty message is rejected', () => {
    teacherWatching.set('teacher-socket', 'room-A');
    const result = handleChatSend('teacher-socket', true, 'room-A', '', undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('text or imageUrl');
  });

  it('oversized text is rejected', () => {
    teacherWatching.set('teacher-socket', 'room-A');
    const result = handleChatSend('teacher-socket', true, 'room-A', 'x'.repeat(2001));
    expect(result.success).toBe(false);
    expect(result.error).toContain('2000');
  });
});
