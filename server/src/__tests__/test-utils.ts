import { vi } from 'vitest';

/**
 * Create a mock ServerSocket for service-side handler tests.
 *
 * Provides the full interface needed by registerHandlers:
 * - id, data, join, leave, to().emit(), on/off/emit
 */
export function createMockServerSocket(id: string) {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};

  const socket = {
    id,
    data: {} as Record<string, unknown>,
    listeners,

    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),

    off: vi.fn((event: string, handler: (...args: any[]) => void) => {
      const arr = listeners[event];
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    }),

    emit: vi.fn((event: string, ...args: any[]) => {
      const handlers = listeners[event];
      if (handlers) {
        for (const h of handlers) handlers.push(h(...args));
      }
    }),

    join: vi.fn((_room: string) => {
      // no-op in mock
    }),

    leave: vi.fn((_room: string) => {
      // no-op in mock
    }),

    to: vi.fn((_room: string) => {
      return {
        emit: vi.fn((_event: string, ..._args: any[]) => {
          // no-op in mock — tests verify via io.to().emit
        }),
      };
    }),

    /** Helper: trigger a client-to-server event, simulating what Socket.io does. */
    triggerEvent(event: string, ...args: any[]) {
      const handlers = listeners[event];
      if (handlers) {
        for (const h of handlers) h(...args);
      }
    },
  };

  return socket;
}

/**
 * Create a mock io server instance for integration tests.
 * Tracks rooms for to().emit() verification.
 */
export function createMockIOServer() {
  const roomEmits: Array<{ room: string; event: string; args: any[] }> = [];
  const globalEmits: Array<{ event: string; args: any[] }> = [];

  return {
    roomEmits,
    globalEmits,

    emit: vi.fn((event: string, ...args: any[]) => {
      globalEmits.push({ event, args });
    }),

    to: vi.fn((room: string) => {
      return {
        emit: vi.fn((event: string, ...args: any[]) => {
          roomEmits.push({ room, event, args });
        }),
      };
    }),
  };
}
