/**
 * Teacher Dashboard — Monitor student coding activity in real-time
 * and manage coding problems.
 */

import './teacher.css';
import './problem-manager.css';
import './chat/chat.css';
import { io, Socket } from 'socket.io-client';
import { CodeEditor } from './code-editor';
import { renderOutput, escapeHtml } from './code-output';
import { ProblemManager } from './problem-manager';
import { ChatClient } from './chat/chat-client';
import { createChatTabs, createChatPanel, appendMessage, renderHistory, clearChat } from './chat/chat-ui';
import type { Problem, ProblemMeta } from './problem-manager';
import type {
  RosterEntry,
  RemoteExecutionResult,
  AssignedProblem,
  ChatMessage,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../shared/types';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;
const THEME_KEY = 'python-lab-theme';

let app: HTMLElement;
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let selectedRoomId: string | null = null;
let codeEditor: CodeEditor | null = null;
let rosterEntries: RosterEntry[] = [];
let password = '';
let currentTab: 'monitor' | 'problems' = 'monitor';
let problemManager: ProblemManager | null = null;
let chatClient: ChatClient | null = null;
let activeMonitorTab: 'output' | 'chat' = 'output';

/* ---- Theme ---- */

function loadTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function isLightTheme(): boolean {
  return document.documentElement.dataset.theme === 'light';
}

function toggleTheme(): void {
  const current = document.documentElement.dataset.theme;
  if (current === 'light') {
    delete document.documentElement.dataset.theme;
    localStorage.setItem(THEME_KEY, 'dark');
  } else {
    document.documentElement.dataset.theme = 'light';
    localStorage.setItem(THEME_KEY, 'light');
  }
  updateThemeButton();
  codeEditor?.setTheme(isLightTheme());
  problemManager?.setTheme(isLightTheme());
}

function updateThemeButton(): void {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  btn.textContent = isLightTheme() ? '☀' : '🌙';
}

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
  loadTheme();

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
      <span class="teacher-nav-title">Teacher Dashboard — Python Lab</span>
      <button class="btn-theme-toggle" id="btn-theme-toggle" title="切換主題">🌙</button>
      <div class="teacher-conn-status">
        <span class="status-dot" id="conn-dot"></span>
        <span id="conn-text">Connected</span>
      </div>
      <button class="btn btn-logout" id="btn-logout">登出</button>
    </nav>
    <div class="teacher-tabs">
      <button class="tab-btn active" data-tab="monitor">學生監控</button>
      <button class="tab-btn" data-tab="problems">題目管理</button>
    </div>
    <div class="teacher-tab-content" id="tab-monitor">
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
          <div class="monitor-push-bar" id="monitor-push-bar" style="display:none">
            <select id="push-problem-select" class="push-select">
              <option value="">選擇要推送的題目...</option>
            </select>
            <button class="btn btn-push" id="btn-push-to-student">推送給此學生</button>
            <button class="btn btn-push-all" id="btn-push-to-all">推送給所有學生</button>
          </div>
          <div class="monitor-editor" id="monitor-editor"></div>
          <div id="monitor-tab-bar-container"></div>
          <div class="monitor-output" id="monitor-output">
            <div class="output-placeholder">選擇學生後，此處將顯示執行結果</div>
          </div>
          <div id="monitor-chat-container" class="chat-panel hidden"></div>
        </div>
      </div>
    </div>
    <div class="teacher-tab-content hidden" id="tab-problems">
      <div id="problem-manager-container"></div>
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

  // Connection status
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

  // Theme toggle
  updateThemeButton();
  document.getElementById('btn-theme-toggle')!.addEventListener('click', toggleTheme);

  // Tab switching
  initTabs();

  /* ---- Chat ---- */

  const monitorTabBarContainer = document.getElementById('monitor-tab-bar-container')!;
  const monitorChatContainer = document.getElementById('monitor-chat-container')!;

  const tabBar = createChatTabs((tab) => {
    activeMonitorTab = tab;
    monitorOutput.style.display = tab === 'output' ? '' : 'none';
    monitorChatContainer.classList.toggle('hidden', tab !== 'chat');
  });
  monitorTabBarContainer.appendChild(tabBar);

  const chatPanel = createChatPanel('teacher', (text, imageUrl) => {
    chatClient?.sendMessage(text || undefined, imageUrl);
  });
  monitorChatContainer.appendChild(chatPanel);

  const messagesContainer = chatPanel.querySelector('.chat-messages')! as HTMLElement;

  function resetChatForRoom(roomId: string): void {
    chatClient?.destroy();
    (chatPanel as any).resetInput?.();
    if (!socket) return;

    chatClient = new ChatClient(socket, roomId, 'teacher');

    chatClient.onMessage((msg: ChatMessage) => {
      const isMine = msg.sender === 'teacher';
      appendMessage(messagesContainer, msg, isMine);
    });

    chatClient.onHistory((messages: ChatMessage[]) => {
      renderHistory(messagesContainer, messages, (msg) => msg.sender === 'teacher');
    });
  }

  /* ---- Monitor Tab ---- */

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

    rosterList.querySelectorAll('.roster-item').forEach((item) => {
      item.addEventListener('click', () => {
        const roomId = (item as HTMLElement).dataset.roomId!;
        selectStudent(roomId);
      });
    });
  }

  function refreshPushDropdown(): void {
    const select = document.getElementById('push-problem-select') as HTMLSelectElement;
    if (!select) return;
    const problems = problemManager?.getProblems() || [];
    select.innerHTML = `
      <option value="">選擇要推送的題目...</option>
      ${problems.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('')}
    `;
  }

  function selectStudent(roomId: string): void {
    if (selectedRoomId) {
      socket?.emit('room:unsubscribe', { roomId: selectedRoomId });
    }

    selectedRoomId = roomId;
    socket?.emit('room:subscribe', { roomId });

    // Initialize chat for this student
    resetChatForRoom(roomId);

    const entry = rosterEntries.find((e) => e.roomId === roomId);
    if (entry) {
      monitorStudentInfo.innerHTML = `
        <span class="monitor-student-name">${escapeHtml(entry.name)}</span>
        <span class="monitor-student-id">${escapeHtml(entry.studentId)}</span>
      `;
    }

    // Show push bar
    const pushBar = document.getElementById('monitor-push-bar')!;
    pushBar.style.display = 'flex';
    refreshPushDropdown();

    if (codeEditor) {
      codeEditor.destroy();
      codeEditor = null;
    }
    monitorEditor.innerHTML = '<div class="output-placeholder">等待代碼同步...</div>';
    monitorOutput.innerHTML = '<div class="output-placeholder">等待執行結果...</div>';

    renderRoster();
  }

  // Push button
  document.getElementById('btn-push-to-student')?.addEventListener('click', async () => {
    if (!selectedRoomId || !problemManager) return;
    const select = document.getElementById('push-problem-select') as HTMLSelectElement;
    const problemId = select.value;
    if (!problemId) return;

    const problem = await problemManager.getProblem(problemId);
    if (!problem) return;

    const assigned: AssignedProblem = {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      examples: problem.examples,
      constraints: problem.constraints,
      starterCode: problem.starterCode,
      testCases: problem.testCases,
    };

    socket?.emit('problem:push', { roomId: selectedRoomId, problem: assigned });
    select.value = '';
    alert(`已推送「${problem.title}」給學生`);
  });

  document.getElementById('btn-push-to-all')?.addEventListener('click', async () => {
    if (!problemManager) return;
    const select = document.getElementById('push-problem-select') as HTMLSelectElement;
    const problemId = select.value;
    if (!problemId) return;

    if (!confirm('確定要推送給所有學生嗎？')) return;

    const problem = await problemManager.getProblem(problemId);
    if (!problem) return;

    const assigned: AssignedProblem = {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      examples: problem.examples,
      constraints: problem.constraints,
      starterCode: problem.starterCode,
      testCases: problem.testCases,
    };

    socket?.emit('problem:push-all', { problem: assigned });
    select.value = '';
    alert(`已推送「${problem.title}」給所有學生`);
  });

  // Roster events
  socket?.on('roster:update', (data) => {
    rosterEntries = data.students;
    renderRoster();
  });

  // Code broadcast
  socket?.on('code:broadcast', (data) => {
    if (data.roomId !== selectedRoomId) return;

    if (!codeEditor) {
      monitorEditor.innerHTML = '';
      codeEditor = new CodeEditor(monitorEditor, data.code, true, isLightTheme());
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
    problemManager?.destroy();
    problemManager = null;
    chatClient?.destroy();
    chatClient = null;
    clearChat(messagesContainer);
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

/* ---- Tabs ---- */

function initTabs(): void {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabMonitor = document.getElementById('tab-monitor')!;
  const tabProblems = document.getElementById('tab-problems')!;

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab as 'monitor' | 'problems';
      if (tab === currentTab) return;

      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = tab;

      if (tab === 'monitor') {
        tabMonitor.classList.remove('hidden');
        tabProblems.classList.add('hidden');
      } else {
        tabMonitor.classList.add('hidden');
        tabProblems.classList.remove('hidden');
        initProblemsTab();
      }
    });
  });
}

function initProblemsTab(): void {
  if (problemManager) return; // Already initialized

  const container = document.getElementById('problem-manager-container')!;
  problemManager = new ProblemManager(container);

  problemManager.onProblemSelect = (problem: Problem) => {
    // Could pre-fill push dropdown, but for now this is informational
  };

  problemManager.onProblemsChange = () => {
    // Refresh push dropdown in monitor tab
    const select = document.getElementById('push-problem-select') as HTMLSelectElement;
    if (select && select.style.display !== 'none') {
      const problems = problemManager?.getProblems() || [];
      select.innerHTML = `
        <option value="">選擇要推送的題目...</option>
        ${problems.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('')}
      `;
    }
  };

  problemManager.init().catch((err) => {
    console.error('Failed to init ProblemManager:', err);
  });
}

// Boot
document.addEventListener('DOMContentLoaded', initAuth);
