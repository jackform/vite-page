/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';

/* ---- Helper functions extracted from teacher.ts for isolated testing ---- */

const THEME_KEY = 'python-lab-theme';

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Replicate renderAuthForm from teacher.ts */
function renderAuthForm(): string {
  return `
    <div class="auth-overlay">
      <div class="auth-card">
        <h1>Teacher Dashboard</h1>
        <p class="auth-subtitle">Python — Teacher Dashboard</p>
        <form id="auth-form">
          <label class="auth-label">
            <span>Password</span>
            <input type="password" id="auth-password" class="auth-input" placeholder="Enter password" required autocomplete="off" />
          </label>
          <button type="submit" class="btn btn-auth" id="auth-submit">Login</button>
        </form>
        <div id="auth-error" class="auth-error hidden"></div>
        <div id="auth-loading" class="auth-loading hidden">Connecting...</div>
      </div>
    </div>
  `;
}

/** Replicate renderRoster from teacher.ts */
interface RosterEntry {
  studentId: string;
  name: string;
  roomId: string;
  connected: boolean;
  joinedAt: number;
}

function renderRoster(entries: RosterEntry[], selectedRoomId: string | null): string {
  if (entries.length === 0) {
    return '<div class="roster-empty">Waiting for students...</div>';
  }

  return entries
    .map(
      (entry) => `
          <div class="roster-item ${entry.roomId === selectedRoomId ? 'active' : ''}"
               data-room-id="${entry.roomId}">
            <span class="roster-status ${entry.connected ? 'online' : 'offline'}"></span>
            <div class="roster-info">
              <span class="roster-name">${escapeHtml(entry.name)}</span>
              <span class="roster-id">${escapeHtml(entry.studentId)}</span>
            </div>
          </div>
        `
    )
    .join('');
}

/** Room isolation pattern: filter socket events by roomId */
function isForCurrentRoom(eventRoomId: string, selectedRoomId: string | null): boolean {
  return eventRoomId === selectedRoomId;
}

/** Lock state machine */
function createLockState() {
  let isLocked = false;
  let isExecuting = false;
  let preLockCode = '';

  return {
    lock(currentCode: string) {
      isLocked = true;
      preLockCode = currentCode;
      return { isLocked, preLockCode };
    },
    unlock() {
      isLocked = false;
      isExecuting = false;
      const code = preLockCode;
      preLockCode = '';
      return { isLocked, preLockCode: code };
    },
    cancel() {
      isLocked = false;
      isExecuting = false;
      const code = preLockCode;
      return { isLocked, preLockCode: code };
    },
    pushUpdate(code: string) {
      preLockCode = code;
      return { preLockCode };
    },
    startExecution() {
      if (isExecuting) return false;
      isExecuting = true;
      return true;
    },
    endExecution() {
      isExecuting = false;
    },
    getState() {
      return { isLocked, isExecuting, preLockCode };
    },
  };
}

/** Theme management */
function loadTheme(): string {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
  return document.documentElement.dataset.theme || 'dark';
}

function toggleTheme(): string {
  const current = document.documentElement.dataset.theme;
  if (current === 'light') {
    delete document.documentElement.dataset.theme;
    localStorage.setItem(THEME_KEY, 'dark');
    return 'dark';
  } else {
    document.documentElement.dataset.theme = 'light';
    localStorage.setItem(THEME_KEY, 'light');
    return 'light';
  }
}

// ---- Tests ----

describe('Teacher Auth Form', () => {
  it('renderAuthForm returns HTML with auth-overlay', () => {
    const html = renderAuthForm();
    expect(html).toContain('auth-overlay');
    expect(html).toContain('auth-card');
  });

  it('renderAuthForm includes password input', () => {
    const html = renderAuthForm();
    expect(html).toContain('id="auth-password"');
    expect(html).toContain('type="password"');
  });

  it('renderAuthForm includes submit button', () => {
    const html = renderAuthForm();
    expect(html).toContain('id="auth-submit"');
    expect(html).toContain('Login');
  });

  it('renderAuthForm includes error div initially hidden', () => {
    const html = renderAuthForm();
    expect(html).toContain('id="auth-error"');
    expect(html).toContain('class="auth-error hidden"');
  });

  it('renderAuthForm includes loading div initially hidden', () => {
    const html = renderAuthForm();
    expect(html).toContain('id="auth-loading"');
    expect(html).toContain('class="auth-loading hidden"');
  });
});

describe('renderRoster', () => {
  const sampleEntries: RosterEntry[] = [
    { studentId: 'S001', name: 'Alice', roomId: 'room-S001', connected: true, joinedAt: 1000 },
    { studentId: 'S002', name: 'Bob', roomId: 'room-S002', connected: false, joinedAt: 2000 },
  ];

  it('renders student list with names and IDs', () => {
    const html = renderRoster(sampleEntries, null);
    expect(html).toContain('Alice');
    expect(html).toContain('S001');
    expect(html).toContain('Bob');
    expect(html).toContain('S002');
  });

  it('shows empty state when list is empty', () => {
    const html = renderRoster([], null);
    expect(html).toContain('Waiting for students...');
    expect(html).not.toContain('roster-item');
  });

  it('highlights selected student', () => {
    const html = renderRoster(sampleEntries, 'room-S001');
    expect(html).toContain('active');
    // The selected room's roster item should have the active class
    expect(html).toContain('room-S001');
    // Verify the active class is on the correct item
    const activeRegex = /class="roster-item active".*room-S001/;
    expect(activeRegex.test(html.replace(/\n/g, ' '))).toBe(true);
  });

  it('shows online status for connected student', () => {
    const html = renderRoster(sampleEntries, null);
    expect(html).toContain('online');
  });

  it('shows offline status for disconnected student', () => {
    const html = renderRoster(sampleEntries, null);
    expect(html).toContain('offline');
  });

  it('escapes HTML in student names', () => {
    const entries: RosterEntry[] = [
      { studentId: 'S001', name: '<script>alert("xss")</script>', roomId: 'room-S001', connected: true, joinedAt: 1000 },
    ];
    const html = renderRoster(entries, null);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('Room isolation', () => {
  it('returns true when event room matches selected room', () => {
    expect(isForCurrentRoom('room-A', 'room-A')).toBe(true);
  });

  it('returns false when event room differs from selected room', () => {
    expect(isForCurrentRoom('room-B', 'room-A')).toBe(false);
  });

  it('returns false when no room is selected', () => {
    expect(isForCurrentRoom('room-A', null)).toBe(false);
  });
});

describe('Lock state machine', () => {
  it('starts unlocked with empty preLockCode', () => {
    const state = createLockState();
    expect(state.getState()).toEqual({ isLocked: false, isExecuting: false, preLockCode: '' });
  });

  it('lock stores current code and sets isLocked', () => {
    const state = createLockState();
    const result = state.lock('student code');
    expect(result.isLocked).toBe(true);
    expect(result.preLockCode).toBe('student code');
  });

  it('unlock clears state and returns preLockCode', () => {
    const state = createLockState();
    state.lock('student code');
    const result = state.unlock();
    expect(result.isLocked).toBe(false);
    expect(result.preLockCode).toBe('student code');
  });

  it('cancel returns preLockCode for restoration', () => {
    const state = createLockState();
    state.lock('original code');
    const result = state.cancel();
    expect(result.isLocked).toBe(false);
    expect(result.preLockCode).toBe('original code');
  });

  it('startExecution returns false when already executing', () => {
    const state = createLockState();
    expect(state.startExecution()).toBe(true);
    expect(state.startExecution()).toBe(false);
  });

  it('endExecution resets executing state', () => {
    const state = createLockState();
    state.startExecution();
    state.endExecution();
    expect(state.getState().isExecuting).toBe(false);
  });
});

describe('Theme management', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('loadTheme defaults to dark when no saved preference', () => {
    const theme = loadTheme();
    expect(theme).toBe('dark');
  });

  it('loadTheme returns light when saved as light', () => {
    localStorage.setItem(THEME_KEY, 'light');
    const theme = loadTheme();
    expect(theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('toggleTheme switches from dark to light', () => {
    loadTheme(); // dark
    const newTheme = toggleTheme();
    expect(newTheme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('toggleTheme switches from light to dark', () => {
    localStorage.setItem(THEME_KEY, 'light');
    loadTheme(); // light
    const newTheme = toggleTheme();
    expect(newTheme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });
});
