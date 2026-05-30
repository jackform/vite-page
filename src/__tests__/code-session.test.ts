import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeSession } from '../code-session.js';
import type { SessionConfig } from '../code-types.js';

describe('CodeSession', () => {
  let config: SessionConfig;

  beforeEach(() => {
    config = {
      roomId: 'room-test-001',
      role: 'student',
      userId: 'user-abc',
    };
  });

  describe('constructor', () => {
    it('initializes with default empty code', () => {
      const session = new CodeSession(config);
      expect(session.getCode()).toBe('');
    });

    it('initializes with provided code', () => {
      const session = new CodeSession(config, 'print("hello")');
      expect(session.getCode()).toBe('print("hello")');
    });

    it('stores config', () => {
      const session = new CodeSession(config);
      const stored = session.getConfig();
      expect(stored.roomId).toBe('room-test-001');
      expect(stored.role).toBe('student');
      expect(stored.userId).toBe('user-abc');
    });

    it('getConfig returns a copy, not the original object', () => {
      const session = new CodeSession(config);
      const copy = session.getConfig();
      copy.roomId = 'modified';
      // Original config should not be affected
      expect(session.getConfig().roomId).toBe('room-test-001');
    });
  });

  describe('getCode / updateCode', () => {
    it('returns current code state', () => {
      const session = new CodeSession(config, 'initial code');
      expect(session.getCode()).toBe('initial code');
    });

    it('updateCode changes the code state', () => {
      const session = new CodeSession(config, 'old code');
      session.updateCode('new code');
      expect(session.getCode()).toBe('new code');
    });

    it('updateCode with empty string', () => {
      const session = new CodeSession(config, 'some code');
      session.updateCode('');
      expect(session.getCode()).toBe('');
    });

    it('updateCode with multiline code', () => {
      const session = new CodeSession(config);
      session.updateCode('def foo():\n    return 42\n');
      expect(session.getCode()).toBe('def foo():\n    return 42\n');
    });
  });

  describe('updateCode with socket', () => {
    it('sends code update to socket when bound', () => {
      const mockSocket = {
        sendCodeUpdate: vi.fn(),
      };
      const session = new CodeSession(config, '', mockSocket as any);
      session.updateCode('print(42)');
      expect(mockSocket.sendCodeUpdate).toHaveBeenCalledWith('print(42)');
    });

    it('does not throw when socket is not bound', () => {
      const session = new CodeSession(config);
      expect(() => session.updateCode('code')).not.toThrow();
    });
  });

  describe('remote change handlers', () => {
    it('registers and triggers remote change handler', () => {
      const session = new CodeSession(config, 'original');
      const handler = vi.fn();
      session.onRemoteChange(handler);
      session.applyRemoteCode('remote code');
      expect(handler).toHaveBeenCalledWith('remote code');
    });

    it('supports multiple remote change handlers', () => {
      const session = new CodeSession(config, 'original');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      session.onRemoteChange(handler1);
      session.onRemoteChange(handler2);
      session.applyRemoteCode('new code');
      expect(handler1).toHaveBeenCalledWith('new code');
      expect(handler2).toHaveBeenCalledWith('new code');
    });

    it('applyRemoteCode updates internal state', () => {
      const session = new CodeSession(config, 'original');
      session.applyRemoteCode('remote code');
      expect(session.getCode()).toBe('remote code');
    });

    it('handlers not called if none registered', () => {
      const session = new CodeSession(config, 'original');
      expect(() => session.applyRemoteCode('code')).not.toThrow();
    });
  });

  describe('bindSocket', () => {
    it('sets socket via bindSocket', () => {
      const session = new CodeSession(config);
      expect(session.getSocket()).toBeNull();

      const mockSocket = { sendCodeUpdate: vi.fn() };
      session.bindSocket(mockSocket as any);
      expect(session.getSocket()).toBe(mockSocket);

      session.updateCode('test');
      expect(mockSocket.sendCodeUpdate).toHaveBeenCalledWith('test');
    });
  });

  describe('getConfig', () => {
    it('returns snapshot with all fields', () => {
      const session = new CodeSession(config);
      const cfg = session.getConfig();
      expect(cfg).toEqual({
        roomId: 'room-test-001',
        role: 'student',
        userId: 'user-abc',
      });
    });
  });
});
