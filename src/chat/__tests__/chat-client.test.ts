import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatClient } from '../chat-client.js';
import type { ChatMessage } from '../../../shared/types.js';

function createMockSocket() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  const offListeners: Record<string, Array<(...args: any[]) => void>> = {};

  return {
    listeners,
    offListeners,
    emit: vi.fn((event: string, ...args: any[]) => {
      const handlers = listeners[event];
      if (handlers) {
        for (const h of handlers) h(...args);
      }
    }),
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (!offListeners[event]) offListeners[event] = [];
      offListeners[event].push(handler);
      const arr = listeners[event];
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    }),
  };
}

describe('ChatClient', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let client: ChatClient;

  beforeEach(() => {
    mockSocket = createMockSocket();
    client = new ChatClient(mockSocket as any, 'room-001', 'student');
  });

  it('sendMessage emits chat:send with correct payload', () => {
    client.sendMessage('hello');

    expect(mockSocket.emit).toHaveBeenCalledWith('chat:send', {
      roomId: 'room-001',
      sender: 'student',
      text: 'hello',
      imageUrl: undefined,
    });
  });

  it('sendMessage with imageUrl emits correct payload', () => {
    client.sendMessage(undefined, 'data:image/png;base64,abc');

    expect(mockSocket.emit).toHaveBeenCalledWith('chat:send', {
      roomId: 'room-001',
      sender: 'student',
      text: undefined,
      imageUrl: 'data:image/png;base64,abc',
    });
  });

  it('onMessage registers handler for chat:message', () => {
    const handler = vi.fn();
    client.onMessage(handler);

    const msg: ChatMessage = {
      id: '1',
      roomId: 'room-001',
      sender: 'teacher',
      text: 'hi',
      timestamp: Date.now(),
    };

    expect(mockSocket.on).toHaveBeenCalledWith('chat:message', expect.any(Function));

    // Simulate receiving a message
    const registeredHandler = mockSocket.listeners['chat:message'][0];
    registeredHandler(msg);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it('onHistory registers one-time handler for chat:history', () => {
    const handler = vi.fn();
    client.onHistory(handler);

    const historyData = {
      roomId: 'room-001',
      messages: [
        { id: '1', roomId: 'room-001', sender: 'teacher' as const, text: 'a', timestamp: 1 },
        { id: '2', roomId: 'room-001', sender: 'student' as const, text: 'b', timestamp: 2 },
      ],
    };

    // Simulate receiving history
    const registeredHandler = mockSocket.listeners['chat:history'][0];
    registeredHandler(historyData);

    expect(handler).toHaveBeenCalledWith(historyData.messages);

    // Should auto-unregister after first call
    expect(mockSocket.off).toHaveBeenCalledWith('chat:history', registeredHandler);
  });

  it('destroy removes all listeners', () => {
    const msgHandler = vi.fn();
    client.onMessage(msgHandler);
    const histHandler = vi.fn();
    client.onHistory(histHandler);

    client.destroy();

    expect(mockSocket.off).toHaveBeenCalledTimes(2);
  });

  it('sender type teacher is reflected in messages', () => {
    const teacherClient = new ChatClient(mockSocket as any, 'room-001', 'teacher');
    teacherClient.sendMessage('listen up');

    expect(mockSocket.emit).toHaveBeenCalledWith('chat:send', {
      roomId: 'room-001',
      sender: 'teacher',
      text: 'listen up',
      imageUrl: undefined,
    });
  });
});
