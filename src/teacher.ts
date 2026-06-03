/**
 * Teacher Dashboard — Monitor student coding activity in real-time
 * and manage coding problems.
 */

import './code.css';
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
  TeacherCodeUpdate,
  RelayExecutionResult,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../shared/types';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;
const THEME_KEY = 'python-lab-theme';

let app: HTMLElement;
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let selectedRoomId: string | null = null;
let selectedStudentId: string | null = null;
let codeEditor: CodeEditor | null = null;
let rosterEntries: RosterEntry[] = [];
let allStudents: { studentId: string; name: string; online: boolean }[] = [];
let password = '';
let currentTab: 'monitor' | 'problems' = 'monitor';
let problemManager: ProblemManager | null = null;
let chatClient: ChatClient | null = null;
let activeMonitorTab: 'output' | 'chat' = 'output';

// Lock & push state
let isLocked = false;
let teacherEditor: CodeEditor | null = null;
let preLockCode: string = '';
let isExecuting = false;

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
          <div class="pre-reg-section">
            <h3 class="pre-reg-title">預先註冊學生</h3>
            <form id="pre-reg-form">
              <input type="text" id="pre-reg-student-id" class="pre-reg-input" placeholder="學生編號" required autocomplete="off" />
              <input type="text" id="pre-reg-name" class="pre-reg-input" placeholder="姓名" required autocomplete="off" />
              <button type="submit" class="btn btn-pre-reg" id="btn-pre-reg">註冊</button>
            </form>
            <div id="pre-reg-error" class="pre-reg-error hidden"></div>
            <div id="pre-reg-ok" class="pre-reg-ok hidden"></div>
          </div>
        </aside>
        <div class="monitor-panel">
          <div class="monitor-student-info" id="monitor-student-info">
            <span class="monitor-placeholder">請選擇一名學生查看代碼</span>
          </div>
          <div class="monitor-push-bar" id="monitor-push-bar">
            <div class="push-bar-row">
              <select id="push-problem-select" class="push-select">
                <option value="">選擇要推送的題目...</option>
              </select>
              <input type="text" id="push-student-id" class="push-student-id-input" placeholder="學生編號（可選）" autocomplete="off" />
              <button class="btn btn-push" id="btn-push-to-student">推送給學生</button>
              <button class="btn btn-push-all" id="btn-push-to-all">推送給所有學生</button>
            </div>
          </div>
          <div class="monitor-view-tabs" id="monitor-view-tabs" style="display:none">
            <button class="monitor-view-tab active" data-view="code">代碼監控</button>
            <button class="monitor-view-tab" data-view="guidance">指導編輯</button>
          </div>
          <div class="monitor-view-content" id="monitor-view-code" style="display:none">
            <div class="monitor-code-toolbar">
              <button class="btn btn-lock" id="btn-lock-toggle" title="鎖定編輯">🔒 鎖定編輯</button>
              <button class="btn btn-run-locked hidden" id="btn-run-locked" title="在學生端執行代碼">▶ Run</button>
              <button class="btn btn-unlock-push hidden" id="btn-unlock-push" title="推送代碼並解鎖">推送並解鎖</button>
              <button class="btn btn-unlock-cancel hidden" id="btn-unlock-cancel" title="取消並恢復原始代碼">取消</button>
              <button class="btn btn-end-classroom hidden" id="btn-end-classroom" title="結束課堂模式">結束課堂</button>
            </div>
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
                <input type="file" id="guidance-file-input" accept="image/*" style="position:absolute;left:-99999px" />
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

  // Populate push dropdown on init
  refreshPushDropdown();

  // Fetch all registered students for the roster
  fetchAllStudents();

  // Periodically refresh student list for online/offline status
  setInterval(fetchAllStudents, 10000);

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
    clearChat(messagesContainer);
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

  async function fetchAllStudents(): Promise<void> {
    try {
      const res = await fetch('/api/students');
      if (res.ok) {
        allStudents = await res.json();
        renderRoster();
      }
    } catch {
      // API unavailable, roster will be empty
    }
  }

  function renderRoster(): void {
    // Build merged list: all registered students + classroom status overlay
    const classroomMap = new Map(rosterEntries.map((e) => [e.studentId, e]));
    const isSelected = (sid: string) => sid === selectedStudentId || `room-${sid}` === selectedRoomId;

    const mergedCount = allStudents.length;
    studentCount.textContent = String(mergedCount);

    if (mergedCount === 0) {
      rosterList.innerHTML = '<div class="roster-empty">尚無註冊學生</div>';
      return;
    }

    rosterList.innerHTML = allStudents
      .map((student) => {
        const classroomEntry = classroomMap.get(student.studentId);
        const inClassroom = !!classroomEntry;
        const isOnline = student.online;
        const active = isSelected(student.studentId) ? 'active' : '';
        const modeClass = inClassroom ? 'mode-classroom' : 'mode-free';
        const modeLabel = inClassroom ? '課堂' : '自由';
        const roomId = inClassroom ? classroomEntry!.roomId : `room-${student.studentId}`;

        return `
          <div class="roster-item ${active} ${modeClass}"
               data-student-id="${escapeHtml(student.studentId)}"
               data-room-id="${escapeHtml(roomId)}"
               data-in-classroom="${inClassroom ? '1' : '0'}">
            <span class="roster-status ${isOnline ? 'online' : 'offline'}"></span>
            <div class="roster-info">
              <span class="roster-name">${escapeHtml(student.name)}</span>
              <span class="roster-id">${escapeHtml(student.studentId)}</span>
            </div>
            <span class="roster-mode-badge ${modeClass}">${modeLabel}</span>
          </div>
        `;
      })
      .join('');

    rosterList.querySelectorAll('.roster-item').forEach((item) => {
      item.addEventListener('click', () => {
        const el = item as HTMLElement;
        const studentId = el.dataset.studentId!;
        const roomId = el.dataset.roomId!;
        const inClassroom = el.dataset.inClassroom === '1';
        selectStudent(studentId, roomId, inClassroom);
      });
    });
  }

  async function refreshPushDropdown(): Promise<void> {
    const select = document.getElementById('push-problem-select') as HTMLSelectElement;
    if (!select) return;
    let problems = problemManager?.getProblems() || [];
    // 如果 ProblemManager 還沒初始化，直接從 API 加載題目列表
    if (problems.length === 0 && !problemManager) {
      try {
        const res = await fetch('/api/problems');
        if (res.ok) {
          problems = await res.json();
        }
      } catch {
        // API 不可用時保持下拉為空
      }
    }
    select.innerHTML = `
      <option value="">選擇要推送的題目...</option>
      ${problems.map((p: { id: string; title: string }) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('')}
    `;
  }

  function selectStudent(studentId: string, roomId: string, inClassroom: boolean): void {
    // Auto-unlock previous student if locked
    if (selectedRoomId && isLocked) {
      if (preLockCode) {
        socket?.emit('code:teacher-update', {
          roomId: selectedRoomId,
          code: preLockCode,
          timestamp: Date.now(),
        });
      }
      socket?.emit('editor:unlock', { roomId: selectedRoomId });
      isLocked = false;
      isExecuting = false;
      setLockButtonsVisible(false);
      btnRunLocked.disabled = false;
      btnRunLocked.textContent = '▶ Run';
      if (teacherEditor) {
        teacherEditor.destroy();
        teacherEditor = null;
      }
    }

    // Unsubscribe from previous room
    if (selectedRoomId) {
      socket?.emit('room:unsubscribe', { roomId: selectedRoomId });
    }

    // Find student info
    const student = allStudents.find((s) => s.studentId === studentId);
    const studentName = student?.name || studentId;

    if (inClassroom) {
      // === Classroom mode: full monitoring ===
      selectedRoomId = roomId;
      selectedStudentId = null;

      // Reset guidance state BEFORE subscribing to the room.
      // room:subscribe triggers the server to send cached state (including
      // problem:assigned), which the handler needs guidanceActiveRoomId for.
      const guidanceEditor = document.getElementById('guidance-editor') as HTMLTextAreaElement;
      guidanceEditor.value = '';
      clearGuidanceImagePreview();
      originalAssignedDescription = '';
      guidanceActiveRoomId = roomId;

      socket?.emit('room:subscribe', { roomId });

      // Initialize chat for this student
      resetChatForRoom(roomId);

      monitorStudentInfo.innerHTML = `
        <span class="monitor-student-name">${escapeHtml(studentName)}</span>
        <span class="monitor-student-id">${escapeHtml(studentId)}</span>
        <span class="monitor-mode-badge mode-classroom">課堂模式</span>
      `;

      refreshPushDropdown();

      const btnEndClassroom = document.getElementById('btn-end-classroom')!;
      btnEndClassroom.classList.remove('hidden');

      const viewTabs = document.getElementById('monitor-view-tabs')!;
      viewTabs.style.display = 'flex';

      const codeView = document.getElementById('monitor-view-code')!;
      codeView.style.display = '';

      // Show lock button
      btnLockToggle.classList.remove('hidden');
      const livePreview = document.getElementById('guidance-live-preview')!;
      livePreview.innerHTML = '<div class="output-placeholder">在此輸入內容，即時預覽...</div>';

      // Switch to code view by default
      const guidanceView = document.getElementById('monitor-view-guidance')!;
      guidanceView.style.display = 'none';
      document.querySelectorAll('.monitor-view-tab').forEach((t) => {
        t.classList.toggle('active', (t as HTMLElement).dataset.view === 'code');
      });

      if (codeEditor) {
        codeEditor.destroy();
        codeEditor = null;
      }
      if (teacherEditor) {
        teacherEditor.destroy();
        teacherEditor = null;
      }
      monitorEditor.innerHTML = '<div class="output-placeholder">等待代碼同步...</div>';
      monitorOutput.innerHTML = '<div class="output-placeholder">等待執行結果...</div>';
    } else {
      // === Free practice mode: basic info + push only ===
      selectedRoomId = null;
      selectedStudentId = studentId;

      // Destroy chat client since there's no socket room
      chatClient?.destroy();
      chatClient = null;
      clearChat(messagesContainer);

      monitorStudentInfo.innerHTML = `
        <span class="monitor-student-name">${escapeHtml(studentName)}</span>
        <span class="monitor-student-id">${escapeHtml(studentId)}</span>
        <span class="monitor-mode-badge mode-free">自由練習</span>
      `;

      // Hide classroom-only UI
      const btnEndClassroom = document.getElementById('btn-end-classroom')!;
      btnEndClassroom.classList.add('hidden');

      const viewTabs = document.getElementById('monitor-view-tabs')!;
      viewTabs.style.display = 'none';

      const codeView = document.getElementById('monitor-view-code')!;
      codeView.style.display = 'none';

      const guidanceView = document.getElementById('monitor-view-guidance')!;
      guidanceView.style.display = 'none';

      // Hide lock button
      btnLockToggle.classList.add('hidden');

      // Clear editors
      if (codeEditor) {
        codeEditor.destroy();
        codeEditor = null;
      }
      if (teacherEditor) {
        teacherEditor.destroy();
        teacherEditor = null;
      }
      monitorEditor.innerHTML = '<div class="output-placeholder">此學生尚未進入課堂模式，推送題目後即可開始監控</div>';
      monitorOutput.innerHTML = '<div class="output-placeholder">選擇課堂模式學生後，此處將顯示執行結果</div>';

      // Pre-fill student ID in push input
      const studentIdInput = document.getElementById('push-student-id') as HTMLInputElement;
      if (studentIdInput) {
        studentIdInput.value = studentId;
      }
    }

    renderRoster();
  }

  // Helper to fetch a problem, with fallback to API when ProblemManager is not initialized
  async function fetchProblem(problemId: string): Promise<AssignedProblem | null> {
    // Try ProblemManager first (has full problem data in memory)
    if (problemManager) {
      const problem = await problemManager.getProblem(problemId);
      if (problem) {
        return {
          id: problem.id,
          title: problem.title,
          difficulty: problem.difficulty,
          description: problem.description,
          examples: problem.examples,
          constraints: problem.constraints,
          starterCode: problem.starterCode,
          testCases: problem.testCases,
        };
      }
    }

    // Fallback: fetch directly from API
    try {
      const res = await fetch(`/api/problems/${problemId}`);
      if (res.ok) {
        const problem = await res.json();
        return {
          id: problem.id,
          title: problem.title,
          difficulty: problem.difficulty,
          description: problem.description,
          examples: problem.examples,
          constraints: problem.constraints,
          starterCode: problem.starterCode,
          testCases: problem.testCases,
        };
      }
    } catch {
      // API unavailable
    }
    return null;
  }

  // Push button - works for classroom, selected non-classroom, or manual ID
  document.getElementById('btn-push-to-student')?.addEventListener('click', async () => {
    const select = document.getElementById('push-problem-select') as HTMLSelectElement;
    const studentIdInput = document.getElementById('push-student-id') as HTMLInputElement;
    const problemId = select.value;
    if (!problemId) return;

    const assigned = await fetchProblem(problemId);
    if (!assigned) return;

    // Determine target student
    const targetRoomId = selectedRoomId || (selectedStudentId ? `room-${selectedStudentId}` : null);
    if (targetRoomId) {
      socket?.emit('problem:push', { roomId: targetRoomId, problem: assigned });
      const targetName = selectedStudentId || allStudents.find((s) => `room-${s.studentId}` === targetRoomId)?.studentId;
      alert(`已推送「${assigned.title}」給學生`);
    } else {
      const manualId = studentIdInput.value.trim();
      if (!manualId) {
        alert('請先選擇學生或輸入學生編號');
        return;
      }
      socket?.emit('problem:push', { roomId: `room-${manualId}`, problem: assigned });
      alert(`已推送「${assigned.title}」給學生 ${manualId}（等待學生進入課堂模式）`);
    }
    select.value = '';
    studentIdInput.value = '';
  });

  document.getElementById('btn-push-to-all')?.addEventListener('click', async () => {
    const select = document.getElementById('push-problem-select') as HTMLSelectElement;
    const problemId = select.value;
    if (!problemId) return;

    if (!confirm('確定要推送給所有學生嗎？（包含離線學生）')) return;

    const assigned = await fetchProblem(problemId);
    if (!assigned) return;

    socket?.emit('problem:push-all', { problem: assigned });
    select.value = '';
    alert(`已推送「${assigned.title}」給所有學生`);
  });

  // ---- Lock & Push Button Handlers ----

  const btnLockToggle = document.getElementById('btn-lock-toggle')! as HTMLButtonElement;
  const btnRunLocked = document.getElementById('btn-run-locked')! as HTMLButtonElement;
  const btnUnlockPush = document.getElementById('btn-unlock-push')! as HTMLButtonElement;
  const btnUnlockCancel = document.getElementById('btn-unlock-cancel')! as HTMLButtonElement;

  function setLockButtonsVisible(locked: boolean): void {
    btnLockToggle.textContent = locked ? '🔓 解鎖' : '🔒 鎖定編輯';
    btnLockToggle.classList.toggle('btn-locked-active', locked);
    btnRunLocked.classList.toggle('hidden', !locked);
    btnUnlockPush.classList.toggle('hidden', !locked);
    btnUnlockCancel.classList.toggle('hidden', !locked);
    // Hide problem push buttons when locked
    const pushRow = document.querySelector('#monitor-push-bar .push-bar-row') as HTMLElement;
    if (pushRow) pushRow.style.display = locked ? 'none' : 'flex';
  }

  btnLockToggle.addEventListener('click', () => {
    if (!selectedRoomId) return;

    if (!isLocked) {
      // Lock: store pre-lock code and emit lock event
      preLockCode = codeEditor?.getCode() || '';
      socket?.emit('editor:lock', { roomId: selectedRoomId });
    } else {
      // Unlock without pushing (same as cancel)
      if (teacherEditor && preLockCode) {
        socket?.emit('code:teacher-update', {
          roomId: selectedRoomId,
          code: preLockCode,
          timestamp: Date.now(),
        });
      }
      setTimeout(() => {
        socket?.emit('editor:unlock', { roomId: selectedRoomId! });
      }, 200);
    }
  });

  btnRunLocked.addEventListener('click', () => {
    if (!selectedRoomId || !teacherEditor) return;
    if (isExecuting) return;
    isExecuting = true;
    btnRunLocked.disabled = true;
    btnRunLocked.textContent = '⏳ Running...';

    const code = teacherEditor.getCode();
    socket?.emit('code:teacher-update', {
      roomId: selectedRoomId,
      code,
      timestamp: Date.now(),
    });
    socket?.emit('execution:request', { roomId: selectedRoomId, code });
  });

  btnUnlockPush.addEventListener('click', () => {
    if (!selectedRoomId || !teacherEditor) return;

    const code = teacherEditor.getCode();
    socket?.emit('code:teacher-update', {
      roomId: selectedRoomId,
      code,
      timestamp: Date.now(),
    });
    setTimeout(() => {
      socket?.emit('editor:unlock', { roomId: selectedRoomId! });
    }, 200);
  });

  btnUnlockCancel.addEventListener('click', () => {
    if (!selectedRoomId) return;

    if (preLockCode) {
      socket?.emit('code:teacher-update', {
        roomId: selectedRoomId,
        code: preLockCode,
        timestamp: Date.now(),
      });
    }
    setTimeout(() => {
      socket?.emit('editor:unlock', { roomId: selectedRoomId! });
    }, 200);
  });

  // End classroom button
  const btnEndClassroom = document.getElementById('btn-end-classroom')!;
  btnEndClassroom.addEventListener('click', () => {
    if (!selectedRoomId) return;
    if (!confirm('確定要結束課堂模式嗎？學生將返回自由練習模式。')) return;

    socket?.emit('classroom:end', { roomId: selectedRoomId });

    // Clean up UI
    btnEndClassroom.classList.add('hidden');
    if (codeEditor) {
      codeEditor.destroy();
      codeEditor = null;
    }
    if (teacherEditor) {
      teacherEditor.destroy();
      teacherEditor = null;
    }
    isLocked = false;
    isExecuting = false;
    setLockButtonsVisible(false);
    btnLockToggle.classList.add('hidden');
    btnRunLocked.disabled = false;
    btnRunLocked.textContent = '▶ Run';

    monitorEditor.innerHTML = '<div class="output-placeholder">等待代碼同步...</div>';
    monitorOutput.innerHTML = '<div class="output-placeholder">選擇學生後，此處將顯示執行結果</div>';

    const viewTabs = document.getElementById('monitor-view-tabs')!;
    viewTabs.style.display = 'none';

    const codeView = document.getElementById('monitor-view-code')!;
    codeView.style.display = 'none';

    selectedRoomId = null;
    selectedStudentId = null;
    monitorStudentInfo.innerHTML = '<span class="monitor-placeholder">請選擇一名學生查看代碼</span>';
    renderRoster();
  });

  // ---- Lock & Push Socket Listeners ----

  socket?.on('editor:locked', (data) => {
    if (data.roomId !== selectedRoomId) return;
    isLocked = true;
    setLockButtonsVisible(true);

    // Replace read-only editor with editable teacher editor
    if (codeEditor) {
      preLockCode = codeEditor.getCode();
      codeEditor.destroy();
      codeEditor = null;
    }

    const code = preLockCode || '';
    monitorEditor.innerHTML = '';
    teacherEditor = new CodeEditor(monitorEditor, code, false, isLightTheme());

    teacherEditor.onChange((newCode) => {
      if (!selectedRoomId) return;
      socket?.emit('code:teacher-update', {
        roomId: selectedRoomId,
        code: newCode,
        timestamp: Date.now(),
      });
    });
  });

  socket?.on('editor:unlocked', (data) => {
    if (data.roomId !== selectedRoomId) return;
    isLocked = false;
    isExecuting = false;
    setLockButtonsVisible(false);
    btnRunLocked.disabled = false;
    btnRunLocked.textContent = '▶ Run';

    // Replace editable teacher editor with read-only viewer
    if (teacherEditor) {
      teacherEditor.destroy();
      teacherEditor = null;
    }

    monitorEditor.innerHTML = '<div class="output-placeholder">等待代碼同步...</div>';

    // If we had code before, recreate the read-only editor
    const entry = rosterEntries.find((e) => e.roomId === selectedRoomId);
    if (entry && socket) {
      // The next code:broadcast will recreate the read-only editor
    }
  });

  // Relay execution result from student
  socket?.on('execution:relay-broadcast', (data: RelayExecutionResult) => {
    if (data.roomId !== selectedRoomId) return;
    isExecuting = false;
    btnRunLocked.disabled = false;
    btnRunLocked.textContent = '▶ Run';

    monitorOutput.innerHTML = renderOutput({
      status: data.status as any,
      stdout: data.stdout,
      stderr: data.stderr,
      returnValue: data.returnValue,
      executionTime: data.executionTime,
    });
  });

  // Listen for student self-exiting classroom
  socket?.on('classroom:exited', () => {
    // roster:update will fire next and handle the UI transition
  });

  // Roster events
  socket?.on('roster:update', (data) => {
    rosterEntries = data.students;

    // If the currently selected non-classroom student just entered classroom mode,
    // auto-upgrade to full monitoring
    if (selectedStudentId && !selectedRoomId) {
      const classroomEntry = data.students.find((e) => e.studentId === selectedStudentId);
      if (classroomEntry) {
        selectStudent(selectedStudentId, classroomEntry.roomId, true);
        return;
      }
    }

    // If the currently selected classroom student left classroom mode,
    // downgrade to basic info view
    if (selectedRoomId && !data.students.find((e) => e.roomId === selectedRoomId)) {
      const studentId = selectedRoomId.replace('room-', '');
      selectStudent(studentId, selectedRoomId, false);
      return;
    }

    renderRoster();
  });

  // ---- Pre-registration form ----

  const preRegForm = document.getElementById('pre-reg-form') as HTMLFormElement;
  const preRegError = document.getElementById('pre-reg-error')!;
  const preRegOk = document.getElementById('pre-reg-ok')!;
  const preRegBtn = document.getElementById('btn-pre-reg') as HTMLButtonElement;

  preRegForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const studentIdInput = document.getElementById('pre-reg-student-id') as HTMLInputElement;
    const nameInput = document.getElementById('pre-reg-name') as HTMLInputElement;
    const studentId = studentIdInput.value.trim();
    const name = nameInput.value.trim();

    if (!studentId || !name) return;

    preRegError.classList.add('hidden');
    preRegOk.classList.add('hidden');
    preRegBtn.disabled = true;
    preRegBtn.textContent = '註冊中...';

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, name }),
      });

      const data = await res.json();

      if (res.ok) {
        preRegOk.textContent = `已註冊 ${name} (${studentId})`;
        preRegOk.classList.remove('hidden');
        studentIdInput.value = '';
        nameInput.value = '';
        // Refresh roster with the new student
        fetchAllStudents();
      } else {
        preRegError.textContent = data.error || '註冊失敗';
        preRegError.classList.remove('hidden');
      }
    } catch {
      preRegError.textContent = '無法連接伺服器';
      preRegError.classList.remove('hidden');
    } finally {
      preRegBtn.disabled = false;
      preRegBtn.textContent = '註冊';
    }
  });

  // Code broadcast
  socket?.on('code:broadcast', (data) => {
    if (data.roomId !== selectedRoomId) return;

    // When locked, teacher owns the code — skip student broadcasts
    if (isLocked) return;

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
    // Auto-unlock if currently locked
    if (selectedRoomId && isLocked && preLockCode) {
      socket?.emit('code:teacher-update', {
        roomId: selectedRoomId,
        code: preLockCode,
        timestamp: Date.now(),
      });
      socket?.emit('editor:unlock', { roomId: selectedRoomId });
    }

    problemManager?.destroy();
    problemManager = null;
    chatClient?.destroy();
    chatClient = null;
    clearChat(messagesContainer);
    socket?.disconnect();
    socket = null;
    selectedRoomId = null;
    selectedStudentId = null;
    codeEditor?.destroy();
    codeEditor = null;
    teacherEditor?.destroy();
    teacherEditor = null;
    isLocked = false;
    isExecuting = false;
    rosterEntries = [];
    allStudents = [];
    initAuth();
  });

  // Reconnect handling
  socket?.io.on('reconnect', () => {
    socket?.emit('teacher:auth', { password });
    if (selectedRoomId) {
      // On reconnect, reset lock state (server will have auto-unlocked)
      isLocked = false;
      isExecuting = false;
      setLockButtonsVisible(false);
      btnRunLocked.disabled = false;
      btnRunLocked.textContent = '▶ Run';
      if (teacherEditor) {
        teacherEditor.destroy();
        teacherEditor = null;
      }
      monitorEditor.innerHTML = '<div class="output-placeholder">等待代碼同步...</div>';

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
