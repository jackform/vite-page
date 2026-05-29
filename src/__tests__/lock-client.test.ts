import { describe, it, expect, beforeEach, vi } from 'vitest';

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

describe('Lock client socket events (simulated)', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let setReadOnlyCalls: boolean[];
  let setCodeCalls: string[];
  let getCodeReturnValue: string;
  let isLockedByTeacher: boolean;
  let preLockCode: string;

  beforeEach(() => {
    mockSocket = createMockSocket();
    setReadOnlyCalls = [];
    setCodeCalls = [];
    getCodeReturnValue = 'current code';
    isLockedByTeacher = false;
    preLockCode = '';
  });

  function setReadOnly(val: boolean): void {
    setReadOnlyCalls.push(val);
  }

  function setCode(code: string): void {
    setCodeCalls.push(code);
  }

  function getCode(): string {
    return getCodeReturnValue;
  }

  function setupLockListeners(roomId: string): void {
    mockSocket.on('editor:locked', (data: { roomId: string; isLocked: boolean }) => {
      if (data.roomId !== roomId) return;
      isLockedByTeacher = true;
      preLockCode = getCode();
      setReadOnly(true);
    });

    mockSocket.on('editor:unlocked', (data: { roomId: string; isLocked: boolean }) => {
      if (data.roomId !== roomId) return;
      isLockedByTeacher = false;
      setReadOnly(false);
    });

    mockSocket.on('code:teacher-broadcast', (data: { roomId: string; code: string }) => {
      if (data.roomId !== roomId) return;
      setCode(data.code);
    });

    mockSocket.on('execution:relay', async (data: { roomId: string; code: string }) => {
      if (data.roomId !== roomId) return;
      mockSocket.emit('execution:relay-result', {
        roomId,
        status: 'success',
        stdout: `Output: ${data.code}`,
        stderr: '',
        executionTime: 100,
        timestamp: Date.now(),
      });
    });
  }

  describe('editor:locked', () => {
    it('sets readOnly and stores preLockCode', () => {
      setupLockListeners('room-A');
      expect(isLockedByTeacher).toBe(false);

      const handler = mockSocket.listeners['editor:locked'][0];
      handler({ roomId: 'room-A', isLocked: true });

      expect(isLockedByTeacher).toBe(true);
      expect(setReadOnlyCalls).toEqual([true]);
      expect(preLockCode).toBe('current code');
    });

    it('ignores lock event for wrong room', () => {
      setupLockListeners('room-A');
      const handler = mockSocket.listeners['editor:locked'][0];
      handler({ roomId: 'room-B', isLocked: true });

      expect(isLockedByTeacher).toBe(false);
      expect(setReadOnlyCalls).toEqual([]);
    });
  });

  describe('editor:unlocked', () => {
    it('clears lock state and restores editability', () => {
      setupLockListeners('room-A');
      isLockedByTeacher = true;

      const handler = mockSocket.listeners['editor:unlocked'][0];
      handler({ roomId: 'room-A', isLocked: false });

      expect(isLockedByTeacher).toBe(false);
      expect(setReadOnlyCalls).toEqual([false]);
    });
  });

  describe('code:teacher-broadcast', () => {
    it('updates code when broadcast received', () => {
      setupLockListeners('room-A');

      const handler = mockSocket.listeners['code:teacher-broadcast'][0];
      handler({ roomId: 'room-A', code: 'new code from teacher', timestamp: Date.now() });

      expect(setCodeCalls).toEqual(['new code from teacher']);
    });

    it('ignores broadcast for wrong room', () => {
      setupLockListeners('room-A');

      const handler = mockSocket.listeners['code:teacher-broadcast'][0];
      handler({ roomId: 'room-B', code: 'should ignore', timestamp: Date.now() });

      expect(setCodeCalls).toEqual([]);
    });
  });

  describe('execution:relay', () => {
    it('executes code and emits relay result', async () => {
      setupLockListeners('room-A');

      const relayHandler = mockSocket.listeners['execution:relay'][0];
      await relayHandler({ roomId: 'room-A', code: 'print(1+1)' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'execution:relay-result',
        expect.objectContaining({
          roomId: 'room-A',
          status: 'success',
          stdout: 'Output: print(1+1)',
        })
      );
    });
  });

  describe('lock guard for student actions', () => {
    it('handleRun returns early when locked', () => {
      isLockedByTeacher = true;
      let runCalled = false;
      function handleRun(): void {
        if (isLockedByTeacher) return;
        runCalled = true;
      }
      handleRun();
      expect(runCalled).toBe(false);
    });

    it('handleTests returns early when locked', () => {
      isLockedByTeacher = true;
      let testsCalled = false;
      function handleTests(): void {
        if (isLockedByTeacher) return;
        testsCalled = true;
      }
      handleTests();
      expect(testsCalled).toBe(false);
    });

    it('handleRun proceeds when not locked', () => {
      isLockedByTeacher = false;
      let runCalled = false;
      function handleRun(): void {
        if (isLockedByTeacher) return;
        runCalled = true;
      }
      handleRun();
      expect(runCalled).toBe(true);
    });
  });
});
