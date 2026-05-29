import { describe, it, expect, beforeEach } from 'vitest';
import { ChatStore } from '../chat-store.js';

describe('ChatStore', () => {
  let store: ChatStore;

  beforeEach(() => {
    store = new ChatStore();
  });

  it('addMessage assigns an id and timestamp', () => {
    const msg = store.addMessage({
      roomId: 'room-001',
      sender: 'teacher',
      text: 'hello',
    });

    expect(msg.id).toBeDefined();
    expect(typeof msg.id).toBe('string');
    expect(msg.timestamp).toBeGreaterThan(0);
    expect(msg.roomId).toBe('room-001');
    expect(msg.sender).toBe('teacher');
    expect(msg.text).toBe('hello');
  });

  it('addMessage generates unique ids for each message', () => {
    const m1 = store.addMessage({ roomId: 'room-001', sender: 'teacher', text: 'a' });
    const m2 = store.addMessage({ roomId: 'room-001', sender: 'teacher', text: 'b' });
    expect(m1.id).not.toBe(m2.id);
  });

  it('getHistory returns messages sorted by timestamp', () => {
    const m1 = store.addMessage({ roomId: 'room-001', sender: 'teacher', text: 'first' });
    const m2 = store.addMessage({ roomId: 'room-001', sender: 'student', text: 'second' });

    const history = store.getHistory('room-001');
    expect(history).toHaveLength(2);
    expect(history[0].text).toBe('first');
    expect(history[1].text).toBe('second');
  });

  it('getHistory returns empty array for unknown room', () => {
    expect(store.getHistory('nonexistent')).toEqual([]);
  });

  it('messages from different rooms are isolated', () => {
    store.addMessage({ roomId: 'room-A', sender: 'teacher', text: 'msg A' });
    store.addMessage({ roomId: 'room-B', sender: 'teacher', text: 'msg B' });

    expect(store.getHistory('room-A')).toHaveLength(1);
    expect(store.getHistory('room-B')).toHaveLength(1);
    expect(store.getHistory('room-A')[0].text).toBe('msg A');
    expect(store.getHistory('room-B')[0].text).toBe('msg B');
  });

  it('supports imageUrl messages', () => {
    const msg = store.addMessage({
      roomId: 'room-001',
      sender: 'teacher',
      imageUrl: 'data:image/png;base64,abc123',
    });

    expect(msg.text).toBeUndefined();
    expect(msg.imageUrl).toBe('data:image/png;base64,abc123');
  });

  it('supports messages with both text and imageUrl', () => {
    const msg = store.addMessage({
      roomId: 'room-001',
      sender: 'teacher',
      text: 'check this',
      imageUrl: 'data:image/png;base64,abc123',
    });

    expect(msg.text).toBe('check this');
    expect(msg.imageUrl).toBe('data:image/png;base64,abc123');
  });

  it('getHistory returns a copy, not the internal array', () => {
    store.addMessage({ roomId: 'room-001', sender: 'teacher', text: 'original' });
    const history = store.getHistory('room-001');
    history.push({ id: 'fake', roomId: 'room-001', sender: 'teacher', text: 'injected', timestamp: 0 });

    const fresh = store.getHistory('room-001');
    expect(fresh).toHaveLength(1);
  });
});
