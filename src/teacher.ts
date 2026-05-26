/**
 * Teacher Dashboard — Monitor student coding activity in real-time.
 */

import './teacher.css';
import { io, Socket } from 'socket.io-client';
import { CodeEditor } from './code-editor';
import { renderOutput, escapeHtml } from './code-output';
import type {
  RosterEntry,
  RemoteExecutionResult,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../shared/types';

const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : 'http://localhost:3001';

let app: HTMLElement;
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let selectedRoomId: string | null = null;
let codeEditor: CodeEditor | null = null;
let rosterEntries: RosterEntry[] = [];
let password = '';

/* ---- Auth ---- */

function renderAuthForm(): string {
  return `
    <div class="auth-overlay">
      <div class="auth-card">
        <h1>👨‍🏫 Teacher Dashboard</h1>
        <p class="auth-subtitle">Python 程式設計實驗室 — 教師監控面板</p>
        <form id="auth-form">
          <label class="auth-label">
            <span>密碼 Password</span>
            <input type="password" id="auth-password" class="auth-input" placeholder="輸入教師密碼" required autocomplete="off" />
          </label>
          <button type="submit" class="btn btn-auth" id="auth-submit">登入</button>
        </form>
        <div id="auth-error" class="auth-error hidden"></div>
        <div id="auth-loading" class="auth-loading hidden">正在連接...</div>
      </div>
    </div>
  `;
}

function initAuth(): void {
  app = document.getElementById('teacher-app') as HTMLElement;
  if (!app) return;

  app.innerHTML = renderAuthForm();

  const form = document.getElementById('auth-form') as HTMLFormElement;
  const errorDiv = document.getElementById('auth-error')!;
  const loadingDiv = document.getElementById('auth-loading')!;
  const submitBtn = document.getElementById('auth-submit') as HTMLButtonElement;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const pwInput = document.getElementById('auth-password') as HTMLInputElement;
    password = pwInput.value;

    errorDiv.classList.add('hidden');
    loadingDiv.classList.remove('hidden');
    submitBtn.disabled = true;

    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket!.emit('teacher:auth', { password });
    });

    socket.on('auth:result', (result) => {
      if (result.success) {
        loadingDiv.classList.add('hidden');
        initDashboard();
      } else {
        loadingDiv.classList.add('hidden');
        submitBtn.disabled = false;
        errorDiv.textContent = result.error || 'Authentication failed';
        errorDiv.classList.remove('hidden');
        socket?.disconnect();
        socket = null;
      }
    });

    socket.on('connect_error', (err) => {
      loadingDiv.classList.add('hidden');
      submitBtn.disabled = false;
      errorDiv.textContent = `Connection failed: ${err.message}`;
      errorDiv.classList.remove('hidden');
      socket?.disconnect();
      socket = null;
    });
  });
}

/* ---- Dashboard ---- */

function renderDashboard(): string {
  return `
    <nav class="teacher-nav">
      <span class="teacher-nav-title">👨‍🏫 Teacher Dashboard — Python Lab</span>
      <div class="teacher-conn-status">
        <span class="status-dot" id="conn-dot"></span>
        <span id="conn-text">Connected</span>
      </div>
      <button class="btn btn-logout" id="btn-logout">登出</button>
    </nav>
    <div class="teacher-layout">
      <aside class="roster-panel" id="roster-panel">
        <h2 class="roster-title">
          學生列表
          <span class="student-count" id="student-count">0</span>
        </h2>
        <div class="roster-list" id="roster-list">
          <div class="roster-empty">等待學生加入...</div>
        </div>
      </aside>
      <div class="monitor-panel">
        <div class="monitor-student-info" id="monitor-student-info">
          <span class="monitor-placeholder">請選擇一名學生查看代碼</span>
        </div>
        <div class="monitor-editor" id="monitor-editor"></div>
        <div class="monitor-output" id="monitor-output">
          <div class="output-placeholder">選擇學生後，此處將顯示執行結果</div>
        </div>
      </div>
    </div>
  `;
}

function initDashboard(): void {
  app.innerHTML = renderDashboard();

  const rosterList = document.getElementById('roster-list')!;
  const studentCount = document.getElementById('student-count')!;
  const monitorEditor = document.getElementById('monitor-editor')!;
  const monitorOutput = document.getElementById('monitor-output')!;
  const monitorStudentInfo = document.getElementById('monitor-student-info')!;
  const connDot = document.getElementById('conn-dot')!;
  const connText = document.getElementById('conn-text')!;
  const btnLogout = document.getElementById('btn-logout')!;

  function updateConnStatus(): void {
    if (socket?.connected) {
      connDot.className = 'status-dot status-ready';
      connText.textContent = 'Connected';
    } else {
      connDot.className = 'status-dot status-error';
      connText.textContent = 'Disconnected';
    }
  }
  updateConnStatus();
  setInterval(updateConnStatus, 3000);

  function renderRoster(): void {
    studentCount.textContent = String(rosterEntries.length);

    if (rosterEntries.length === 0) {
      rosterList.innerHTML = '<div class="roster-empty">等待學生加入...</div>';
      return;
    }

    rosterList.innerHTML = rosterEntries
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

    // Click handlers
    rosterList.querySelectorAll('.roster-item').forEach((item) => {
      item.addEventListener('click', () => {
        const roomId = (item as HTMLElement).dataset.roomId!;
        selectStudent(roomId);
      });
    });
  }

  function selectStudent(roomId: string): void {
    // Unsubscribe previous
    if (selectedRoomId) {
      socket?.emit('room:unsubscribe', { roomId: selectedRoomId });
    }

    selectedRoomId = roomId;
    socket?.emit('room:subscribe', { roomId });

    const entry = rosterEntries.find((e) => e.roomId === roomId);
    if (entry) {
      monitorStudentInfo.innerHTML = `
        <span class="monitor-student-name">${escapeHtml(entry.name)}</span>
        <span class="monitor-student-id">${escapeHtml(entry.studentId)}</span>
      `;
    }

    // Reset editor
    if (codeEditor) {
      codeEditor.destroy();
      codeEditor = null;
    }
    monitorEditor.innerHTML = '<div class="output-placeholder">等待代碼同步...</div>';
    monitorOutput.innerHTML = '<div class="output-placeholder">等待執行結果...</div>';

    renderRoster();
  }

  // Roster events
  socket?.on('roster:update', (data) => {
    rosterEntries = data.students;
    renderRoster();
  });

  // Code broadcast from server
  socket?.on('code:broadcast', (data) => {
    if (data.roomId !== selectedRoomId) return;

    if (!codeEditor) {
      monitorEditor.innerHTML = '';
      codeEditor = new CodeEditor(monitorEditor, data.code, true);
    } else {
      codeEditor.setCode(data.code);
    }
  });

  // Execution broadcast
  socket?.on('execution:broadcast', (data: RemoteExecutionResult) => {
    if (data.roomId !== selectedRoomId) return;

    monitorOutput.innerHTML = renderOutput({
      status: data.status as any,
      stdout: data.stdout,
      stderr: data.stderr,
      returnValue: data.returnValue,
      passedCount: data.passedCount,
      totalCount: data.totalCount,
      executionTime: data.executionTime,
      testResults: [],
    });
  });

  // Logout
  btnLogout.addEventListener('click', () => {
    socket?.disconnect();
    socket = null;
    selectedRoomId = null;
    codeEditor?.destroy();
    codeEditor = null;
    rosterEntries = [];
    initAuth();
  });

  // Reconnect handling
  socket?.io.on('reconnect', () => {
    socket?.emit('teacher:auth', { password });
    if (selectedRoomId) {
      socket?.emit('room:subscribe', { roomId: selectedRoomId });
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', initAuth);
