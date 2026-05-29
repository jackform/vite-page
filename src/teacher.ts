/**
 * Teacher Dashboard — Monitor student coding activity in real-time
 * and manage coding problems.
 */

import './teacher.css';
import './problem-manager.css';
import './chat/chat.css';
import { marked } from 'marked';
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

/* ---- Guidance Editor State ---- */
let guidanceImageDataUrl: string | null = null;
let originalAssignedDescription: string = '';
let guidanceActiveRoomId: string | null = null;

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
          <div class="monitor-view-tabs" id="monitor-view-tabs" style="display:none">
            <button class="monitor-view-tab active" data-view="code">代碼監控</button>
            <button class="monitor-view-tab" data-view="guidance">指導編輯</button>
          </div>
          <div class="monitor-view-content" id="monitor-view-code" style="display:none">
            <div class="monitor-editor" id="monitor-editor"></div>
            <div id="monitor-tab-bar-container"></div>
            <div class="monitor-output" id="monitor-output">
              <div class="output-placeholder">選擇學生後，此處將顯示執行結果</div>
            </div>
            <div id="monitor-chat-container" class="chat-panel hidden"></div>
          </div>
          <div class="monitor-view-content" id="monitor-view-guidance" style="display:none">
            <div class="guidance-panel">
              <div class="guidance-editor-pane">
                <div class="guidance-pane-label">編輯指導內容 (Markdown)</div>
                <textarea class="guidance-editor" id="guidance-editor" placeholder="在此編輯指導內容，支援 Markdown 語法...

## 教師提示

請嘗試使用 **雙層迴圈** 來解決這個問題。

1. 第一步：先排序
2. 第二步：使用雙指針

也可以貼上圖片 (Ctrl+V) 或點擊下方按鈕插入圖片。"></textarea>
                <div class="guidance-image-preview hidden" id="guidance-image-preview">
                  <img id="guidance-image-thumb" alt="Preview" />
                  <span id="guidance-image-label"></span>
                  <button class="guidance-image-remove" id="guidance-image-remove" title="移除圖片">&times;</button>
                </div>
                <input type="file" id="guidance-file-input" accept="image/*" hidden />
                <div class="guidance-btn-bar">
                  <button class="btn btn-push" id="btn-guidance-push">推送指導</button>
                  <button class="btn btn-push-all" id="btn-guidance-reset">重置為原描述</button>
                  <button class="btn btn-push-all" id="btn-guidance-insert-image">插入圖片</button>
                </div>
              </div>
              <div class="guidance-preview-pane">
                <div class="guidance-pane-label">即時預覽 (學生視角)</div>
                <div class="guidance-live-preview" id="guidance-live-preview">
                  <div class="output-placeholder">在此輸入內容，即時預覽...</div>
                </div>
              </div>
            </div>
          </div>
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

    // Show push bar and view tabs
    const pushBar = document.getElementById('monitor-push-bar')!;
    pushBar.style.display = 'flex';
    refreshPushDropdown();

    const viewTabs = document.getElementById('monitor-view-tabs')!;
    viewTabs.style.display = 'flex';

    // Reset guidance state
    const guidanceEditor = document.getElementById('guidance-editor') as HTMLTextAreaElement;
    guidanceEditor.value = '';
    clearGuidanceImagePreview();
    originalAssignedDescription = '';
    guidanceActiveRoomId = roomId;
    const livePreview = document.getElementById('guidance-live-preview')!;
    livePreview.innerHTML = '<div class="output-placeholder">在此輸入內容，即時預覽...</div>';

    // Switch to code view by default
    const codeView = document.getElementById('monitor-view-code')!;
    const guidanceView = document.getElementById('monitor-view-guidance')!;
    codeView.style.display = '';
    guidanceView.style.display = 'none';
    document.querySelectorAll('.monitor-view-tab').forEach((t) => {
      t.classList.toggle('active', (t as HTMLElement).dataset.view === 'code');
    });

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

  /* ---- View Tab Switching ---- */

  document.querySelectorAll('.monitor-view-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = (tab as HTMLElement).dataset.view;
      const codeView = document.getElementById('monitor-view-code')!;
      const guidanceView = document.getElementById('monitor-view-guidance')!;

      document.querySelectorAll('.monitor-view-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      if (view === 'code') {
        codeView.style.display = '';
        guidanceView.style.display = 'none';
      } else {
        codeView.style.display = 'none';
        guidanceView.style.display = '';
      }
    });
  });

  /* ---- Guidance Editor ---- */

  // Listen for assigned problem to pre-fill the guidance editor
  socket?.on('problem:assigned', (data: { problem: AssignedProblem }) => {
    if (!guidanceActiveRoomId) return;
    const desc = data.problem.description;
    originalAssignedDescription = desc;
    const guidanceEditor = document.getElementById('guidance-editor') as HTMLTextAreaElement;
    if (guidanceEditor && !guidanceEditor.value.trim()) {
      guidanceEditor.value = desc;
      updateGuidancePreview();
    }
  });

  // Live preview: update as teacher types
  function updateGuidancePreview(): void {
    const editor = document.getElementById('guidance-editor') as HTMLTextAreaElement;
    const preview = document.getElementById('guidance-live-preview')!;
    if (!editor || !preview) return;

    const text = editor.value.trim();
    if (!text) {
      preview.innerHTML = '<div class="output-placeholder">在此輸入內容，即時預覽...</div>';
      return;
    }
    const dedented = text.replace(/^[ \t]+/gm, '');
    try {
      preview.innerHTML = (marked.parse(dedented) as string) || escapeHtml(text);
    } catch {
      preview.innerHTML = escapeHtml(text);
    }
  }

  const guidanceEditorEl = document.getElementById('guidance-editor') as HTMLTextAreaElement;
  guidanceEditorEl?.addEventListener('input', updateGuidancePreview);

  // Image handling
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function clearGuidanceImagePreview(): void {
    guidanceImageDataUrl = null;
    const preview = document.getElementById('guidance-image-preview')!;
    preview.classList.add('hidden');
    const fileInput = document.getElementById('guidance-file-input') as HTMLInputElement;
    fileInput.value = '';
  }

  function insertImageIntoEditor(dataUrl: string): void {
    const editor = document.getElementById('guidance-editor') as HTMLTextAreaElement;
    if (!editor) return;
    const markdown = `![image](${dataUrl})`;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    editor.value = before + markdown + after;
    editor.selectionStart = editor.selectionEnd = start + markdown.length;
    editor.focus();
    updateGuidancePreview();
  }

  // Insert image button
  document.getElementById('btn-guidance-insert-image')?.addEventListener('click', () => {
    document.getElementById('guidance-file-input')?.click();
  });

  // File input handler
  document.getElementById('guidance-file-input')?.addEventListener('change', async function (this: HTMLInputElement) {
    const files = this.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 2_000_000) {
      alert('圖片大小不能超過 2MB');
      this.value = '';
      return;
    }
    try {
      const dataUrl = await fileToBase64(file);
      guidanceImageDataUrl = dataUrl;
      const preview = document.getElementById('guidance-image-preview')!;
      const thumb = document.getElementById('guidance-image-thumb') as HTMLImageElement;
      const label = document.getElementById('guidance-image-label')!;
      thumb.src = dataUrl;
      label.textContent = file.name;
      preview.classList.remove('hidden');
      insertImageIntoEditor(dataUrl);
      clearGuidanceImagePreview();
    } catch {
      alert('讀取圖片失敗');
    }
  });

  // Image preview remove button
  document.getElementById('guidance-image-remove')?.addEventListener('click', () => {
    clearGuidanceImagePreview();
  });

  // Paste image support in guidance editor
  document.getElementById('guidance-editor')?.addEventListener('paste', (e) => {
    const items = (e as ClipboardEvent).clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 2_000_000) {
            alert('圖片大小不能超過 2MB');
            return;
          }
          fileToBase64(file).then((dataUrl) => {
            insertImageIntoEditor(dataUrl);
          }).catch(() => {
            alert('讀取圖片失敗');
          });
        }
        return;
      }
    }
  });

  // Push guidance button
  document.getElementById('btn-guidance-push')?.addEventListener('click', () => {
    if (!guidanceActiveRoomId) return;
    const editor = document.getElementById('guidance-editor') as HTMLTextAreaElement;
    const desc = editor.value;
    if (!desc.trim()) {
      alert('指導內容不能為空');
      return;
    }
    socket?.emit('guidance:push', { roomId: guidanceActiveRoomId, description: desc });
    alert('已推送指導內容給學生');
  });

  // Reset guidance button
  document.getElementById('btn-guidance-reset')?.addEventListener('click', () => {
    const editor = document.getElementById('guidance-editor') as HTMLTextAreaElement;
    editor.value = originalAssignedDescription;
    clearGuidanceImagePreview();
    updateGuidancePreview();
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
