/**
 * Python Coding Lab — Main orchestrator.
 *
 * Lifecycle:
 * 1. Render registration overlay
 * 2. Student registers via WebSocket
 * 3. Render editor layout with CodeMirror + Pyodide
 * 4. Code changes sync to server in real-time
 * 5. Run/Tests execute locally via Pyodide, results sent to server
 */

import './code.css';
import { marked } from 'marked';
import Sk from 'skulpt';
import { CodeEditor } from './code-editor';
import { CodeExecutor } from './code-executor';
import { CodeWidgetExecutor } from './code-widget-executor';
import { SkulptExecutor } from './code-skulpt-executor';
import { CodeSession } from './code-session';
import { CodeSocket } from './code-socket';
import { problems as fallbackProblems, defaultProblem as fallbackDefault } from './code-problems';
import { renderOutput, renderOutputLoading, escapeHtml } from './code-output';
import type { CodeProblem, ExecutionStatus } from './code-types';
import type { AssignedProblem } from '../shared/types';

const THEME_KEY = 'python-lab-theme';
const ENGINE_KEY = 'python-lab-engine';

type EngineType = 'pyodide' | 'skulpt' | 'pyodide-widget';

let app: HTMLElement;
let editor: CodeEditor;
let executor: CodeExecutor | SkulptExecutor | CodeWidgetExecutor;
let session: CodeSession;
let socket: CodeSocket;
/** All available problems loaded from server (or fallback). */
let problemsById: Record<string, CodeProblem> = {};
/** Ordered list of problem ids for cycling. */
let problemIds: string[] = [];
let currentProblem: CodeProblem = fallbackDefault;
let isApplyingRemote = false;
let currentEngine: EngineType = 'pyodide';

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
  editor?.setTheme(isLightTheme());
}

function updateThemeButton(): void {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  const isLight = document.documentElement.dataset.theme === 'light';
  btn.textContent = isLight ? '☀' : '🌙';
}

/* ---- Render Functions ---- */

function renderLayout(): string {
  return `
    <nav class="code-nav">
      <a href="./">← 返回個人主頁</a>
      <span class="code-nav-title">Python 程式設計實驗室</span>
      <button class="btn-theme-toggle" id="btn-theme-toggle" title="切換主題">☀</button>
      <div class="conn-status">
        <span class="status-dot" id="conn-dot"></span>
        <span id="conn-text">Connected</span>
      </div>
    </nav>
    <div class="code-layout">
      <div class="problem-panel" id="problem-panel"></div>
      <div class="editor-output-panel">
        <div class="editor-panel" id="editor-panel"></div>
        <div class="action-bar">
          <button class="btn btn-run" id="btn-run" disabled>▶ Run</button>
          <button class="btn btn-tests" id="btn-tests" disabled>✓ Run Tests</button>
          <select class="problem-select" id="problem-select" title="選擇題目">
            <option value="">載入中...</option>
          </select>
          <select class="engine-select" id="engine-select" title="Python 引擎">
            <option value="pyodide">Pyodide</option>
            <option value="skulpt">Skulpt</option>
            <option value="pyodide-widget">Pyodide + Widgets</option>
          </select>
          <div class="executor-status" id="executor-status">
            <span class="status-dot status-loading"></span>
            <span id="status-text">Loading Python...</span>
          </div>
        </div>
        <div class="turtle-canvas-wrapper hidden" id="turtle-canvas-wrapper">
          <div id="turtle-canvas"></div>
        </div>
        <div class="output-panel" id="output-panel">
          <div class="output-placeholder">Python environment is loading, please wait...</div>
        </div>
      </div>
    </div>
  `;
}

function renderRegistrationForm(): string {
  return `
    <div class="registration-overlay">
      <div class="registration-card">
        <h1>Python 程式設計實驗室</h1>
        <p class="registration-subtitle">請輸入你的資料以加入課堂</p>
        <form id="reg-form">
          <label class="reg-label">
            <span>姓名 Name</span>
            <input type="text" id="reg-name" class="reg-input" placeholder="陳小明" required autocomplete="off" />
          </label>
          <label class="reg-label">
            <span>學生編號 Student ID</span>
            <input type="text" id="reg-student-id" class="reg-input" placeholder="20240001" required autocomplete="off" />
          </label>
          <button type="submit" class="btn btn-run" id="reg-submit">加入課堂</button>
        </form>
        <div id="reg-error" class="reg-error hidden"></div>
        <div id="reg-loading" class="reg-loading hidden">正在連接...</div>
      </div>
    </div>
  `;
}

// Configure marked globally for GFM line breaks (single \n → <br>)
marked.setOptions({ breaks: true });

function renderDescription(description: string): string {
  // Strip leading whitespace from each line (template literal indentation
  // would otherwise cause marked to interpret the content as a code block).
  const dedented = description.replace(/^[ \t]+/gm, '');
  try {
    const html = marked.parse(dedented) as string;
    if (html && html.trim()) return html;
  } catch { /* fall through */ }
  return description; // fallback to raw content
}

function renderProblem(problem: CodeProblem | AssignedProblem): string {
  return `
    <div class="problem-header">
      <h1 class="problem-title">${escapeHtml(problem.title)}</h1>
      <span class="problem-difficulty difficulty-${problem.difficulty}">${problem.difficulty}</span>
    </div>
    <div class="problem-description">${renderDescription(problem.description)}</div>
    ${problem.examples.length ? renderExamples(problem.examples) : ''}
    ${problem.constraints.length ? renderConstraints(problem.constraints) : ''}
  `;
}

function renderExamples(
  examples: { input: string; output: string; explanation?: string }[]
): string {
  const items = examples
    .map(
      (ex, i) => `
        <div class="example-block">
          <div class="example-label">Example ${i + 1}:</div>
          <pre><strong>Input:</strong> ${escapeHtml(ex.input)}
<strong>Output:</strong> ${escapeHtml(ex.output)}</pre>
          ${ex.explanation ? `<div class="example-explanation"><strong>Explanation:</strong> ${escapeHtml(ex.explanation)}</div>` : ''}
        </div>
      `
    )
    .join('');
  return `<div class="problem-section-title">Examples</div>${items}`;
}

function renderConstraints(constraints: string[]): string {
  const items = constraints
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join('');
  return `<div class="problem-section-title">Constraints</div><ul class="constraints-list">${items}</ul>`;
}

/* ---- Registration ---- */

function initRegistration(): void {
  loadTheme();

  app = document.getElementById('code-app') as HTMLElement;
  if (!app) return;

  app.innerHTML = renderRegistrationForm();

  const form = document.getElementById('reg-form') as HTMLFormElement;
  const errorDiv = document.getElementById('reg-error')!;
  const loadingDiv = document.getElementById('reg-loading')!;
  const submitBtn = document.getElementById('reg-submit') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('reg-name') as HTMLInputElement;
    const studentIdInput = document.getElementById('reg-student-id') as HTMLInputElement;
    const name = nameInput.value.trim();
    const studentId = studentIdInput.value.trim();

    if (!name || !studentId) return;

    errorDiv.classList.add('hidden');
    loadingDiv.classList.remove('hidden');
    submitBtn.disabled = true;

    try {
      socket = new CodeSocket();
      const sessionInfo = await socket.register({ name, studentId });
      await initLab(sessionInfo);
    } catch (err) {
      loadingDiv.classList.add('hidden');
      submitBtn.disabled = false;
      errorDiv.textContent = err instanceof Error ? err.message : 'Connection failed';
      errorDiv.classList.remove('hidden');
    }
  });
}

/* ---- Problem Loading ---- */

async function loadProblemsFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/problems');
    if (!res.ok) throw new Error('Failed to fetch');
    const list: { id: string; title: string; difficulty: 'easy' | 'medium' | 'hard' }[] = await res.json();

    problemIds = [];
    problemsById = {};

    // Load first problem immediately, rest on demand
    for (const meta of list) {
      problemIds.push(meta.id);
      // Store metadata immediately for the dropdown label
      if (!problemsById[meta.id]) {
        problemsById[meta.id] = {
          id: meta.id,
          title: meta.title,
          difficulty: meta.difficulty,
          description: '',
          examples: [],
          constraints: [],
          starterCode: '',
          testCases: [],
        };
      }
    }

    if (problemIds.length > 0) {
      const first = await loadProblemById(problemIds[0]);
      if (first) currentProblem = first;
    }
  } catch {
    // Fall back to hardcoded problems
    problemsById = fallbackProblems;
    problemIds = Object.keys(fallbackProblems);
    currentProblem = fallbackDefault;
  }
}

async function loadProblemById(id: string): Promise<CodeProblem | null> {
  const cached = problemsById[id];
  // Only return cached if it has actual content (not just metadata stub)
  if (cached && cached.starterCode) return cached;
  try {
    const res = await fetch(`/api/problems/${id}`);
    if (!res.ok) return null;
    const full: CodeProblem = await res.json();
    problemsById[full.id] = full;
    return full;
  } catch {
    return cached || null;
  }
}

function populateProblemSelect(): void {
  const select = document.getElementById('problem-select') as HTMLSelectElement;
  if (!select) return;

  const currentId = currentProblem?.id;
  select.innerHTML = problemIds
    .map((id) => {
      const p = problemsById[id];
      const title = p?.title || id;
      const selected = id === currentId ? ' selected' : '';
      return `<option value="${id}"${selected}>${escapeHtml(title)}</option>`;
    })
    .join('');

  if (problemIds.length === 0) {
    select.innerHTML = '<option value="">尚無題目</option>';
  }
}

function switchToProblem(problem: CodeProblem): void {
  const problemPanel = document.getElementById('problem-panel');
  const outputPanel = document.getElementById('output-panel');
  if (!problemPanel || !outputPanel) return;

  currentProblem = problem;
  problemPanel.innerHTML = renderProblem(problem);
  editor.setCode(problem.starterCode);
  session.updateCode(problem.starterCode);
  outputPanel.innerHTML = '<div class="output-placeholder">Ready. Press Run to execute.</div>';
  populateProblemSelect();
}

/* ---- Init ---- */

async function initLab(sessionInfo: {
  roomId: string;
  userId: string;
  studentName: string;
  studentId: string;
}): Promise<void> {
  app.innerHTML = renderLayout();

  const problemPanel = document.getElementById('problem-panel')!;
  const editorPanel = document.getElementById('editor-panel')!;
  const outputPanel = document.getElementById('output-panel')!;
  const btnRun = document.getElementById('btn-run')! as HTMLButtonElement;
  const btnTests = document.getElementById('btn-tests')! as HTMLButtonElement;
  const problemSelect = document.getElementById('problem-select')! as HTMLSelectElement;
  const statusText = document.getElementById('status-text')!;
  const statusDot = document.querySelector('.status-dot')!;
  const connDot = document.getElementById('conn-dot')!;
  const connText = document.getElementById('conn-text')!;

  // Load problems from server
  await loadProblemsFromServer();
  problemPanel.innerHTML = renderProblem(currentProblem);

  session = new CodeSession(
    { roomId: sessionInfo.roomId, role: 'student', userId: sessionInfo.userId },
    currentProblem.starterCode,
    socket
  );

  editor = new CodeEditor(editorPanel, currentProblem.starterCode, false, isLightTheme());

  editor.onChange((code) => {
    if (isApplyingRemote) return;
    session.updateCode(code);
  });

  session.onRemoteChange((code) => {
    isApplyingRemote = true;
    editor.setCode(code);
    isApplyingRemote = false;
  });

  // Connection status
  function updateConnStatus(): void {
    if (socket.isConnected()) {
      connDot.className = 'status-dot status-ready';
      connText.textContent = 'Connected';
    } else {
      connDot.className = 'status-dot status-error';
      connText.textContent = 'Disconnected';
    }
  }
  updateConnStatus();

  socket.onDisconnect(() => updateConnStatus());
  socket.onConnect(() => updateConnStatus());

  // Listen for teacher-pushed problems
  socket.on('problem:assigned', (data: { problem: AssignedProblem }) => {
    const problem = data.problem;
    const codeProblem: CodeProblem = {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      examples: problem.examples || [],
      constraints: problem.constraints || [],
      starterCode: problem.starterCode,
      testCases: problem.testCases || [],
    };

    // Also add to local cache so it appears in the cycle list
    if (!problemsById[codeProblem.id]) {
      problemsById[codeProblem.id] = codeProblem;
      problemIds.push(codeProblem.id);
    }

    switchToProblem(codeProblem);
    outputPanel.innerHTML = '<div class="output-placeholder">教師已指派新題目。Press Run to execute.</div>';
    showNotification(`教師已指派新題目：${problem.title}`);
  });

  // Theme toggle
  updateThemeButton();
  document.getElementById('btn-theme-toggle')!.addEventListener('click', toggleTheme);

  // Engine selector
  const engineSelect = document.getElementById('engine-select') as HTMLSelectElement;
  const turtleWrapper = document.getElementById('turtle-canvas-wrapper')!;

  const savedEngine = localStorage.getItem(ENGINE_KEY) as EngineType | null;
  if (savedEngine === 'skulpt' || savedEngine === 'pyodide' || savedEngine === 'pyodide-widget') {
    currentEngine = savedEngine;
    engineSelect.value = savedEngine;
  }

  function createExecutor(engine: EngineType): void {
    executor?.destroy();
    turtleWrapper.classList.add('hidden');

    if (engine === 'skulpt') {
      turtleWrapper.classList.remove('hidden');
      try {
        if (!(Sk as any).TurtleGraphics) {
          (Sk as any).TurtleGraphics = {};
        }
        (Sk as any).TurtleGraphics.target = 'turtle-canvas';
        executor = new SkulptExecutor('turtle-canvas');
      } catch (err: any) {
        console.error('Skulpt init failed:', err);
        outputPanel.innerHTML = `<div class="output-stderr">Failed to start Skulpt: ${escapeHtml(err.message)}</div>`;
        engineSelect.value = 'pyodide';
        localStorage.setItem(ENGINE_KEY, 'pyodide');
        currentEngine = 'pyodide';
        executor = new CodeExecutor();
      }
    } else if (engine === 'pyodide-widget') {
      executor = new CodeWidgetExecutor();
      // Wire up callback results from widget button clicks
      (executor as CodeWidgetExecutor).onCallbackResult((cbResult) => {
        // Render any widgets created during the callback (e.g. Toplevel)
        if (cbResult.widgets && cbResult.widgets.length > 0) {
          (executor as CodeWidgetExecutor).renderCallbackWidgets(cbResult.widgets);
        }
        const cbContainer = document.getElementById('widget-callback-output');
        if (cbContainer) {
          if (cbResult.stdout.trim()) {
            cbContainer.innerHTML += `<div class="output-stdout">${escapeHtml(cbResult.stdout.trim())}</div>`;
          }
          if (cbResult.stderr.trim()) {
            cbContainer.innerHTML += `<div class="output-stderr">${escapeHtml(cbResult.stderr.trim())}</div>`;
          }
          cbContainer.scrollTop = cbContainer.scrollHeight;
        }
      });
    } else {
      executor = new CodeExecutor();
    }

    currentEngine = engine;
    localStorage.setItem(ENGINE_KEY, engine);

    executor.onStatusChange((status: ExecutionStatus) => {
      updateStatusUI(status, statusText, statusDot, btnRun, btnTests, executor.getStatusMessage());
    });

    outputPanel.innerHTML = renderOutputLoading();
    executor.load().then(() => {
      outputPanel.innerHTML = '<div class="output-placeholder">Ready. Press Run to execute.</div>';
    }).catch((err) => {
      console.error(`${engine} failed to load:`, err);
      outputPanel.innerHTML = `<div class="output-stderr">Failed to load ${engine}: ${escapeHtml(err.message)}</div>`;
    });
  }

  createExecutor(currentEngine);

  engineSelect.addEventListener('change', () => {
    const engine = engineSelect.value as EngineType;
    if (engine !== currentEngine) {
      createExecutor(engine);
    }
  });

  async function handleRun(): Promise<void> {
    if (!executor.isReady()) return;
    outputPanel.innerHTML = renderOutputLoading();
    const code = editor.getCode();
    if (executor instanceof CodeWidgetExecutor) {
      const result = await executor.execute(code);
      executor.renderWidgetOutput(outputPanel, result);
      socket.sendExecutionResult({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime: result.executionTime,
      });
    } else {
      const result = await executor.execute(code);
      outputPanel.innerHTML = renderOutput(result);
      socket.sendExecutionResult({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        returnValue: result.returnValue,
        executionTime: result.executionTime,
      });
    }
  }

  async function handleTests(): Promise<void> {
    if (!executor.isReady()) return;
    outputPanel.innerHTML = renderOutputLoading();
    const code = editor.getCode();
    if (executor instanceof CodeWidgetExecutor) {
      const result = await executor.execute(code);
      executor.renderWidgetOutput(outputPanel, result);
      socket.sendExecutionResult({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime: result.executionTime,
      });
    } else {
      const result = await executor.runTests(code, currentProblem.testCases);
      outputPanel.innerHTML = renderOutput(result);
      socket.sendExecutionResult({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        executionTime: result.executionTime,
      });
    }
  }

  btnRun.addEventListener('click', handleRun);
  btnTests.addEventListener('click', handleTests);

  // Populate problem dropdown after loading
  populateProblemSelect();

  // Refresh problem list from server when opening the dropdown
  problemSelect.addEventListener('focus', async () => {
    try {
      const res = await fetch('/api/problems');
      if (res.ok) {
        const list: { id: string; title: string; difficulty: string }[] = await res.json();
        const newIds: string[] = [];
        for (const meta of list) {
          newIds.push(meta.id);
          if (!problemsById[meta.id]) {
            problemsById[meta.id] = {
              id: meta.id,
              title: meta.title,
              difficulty: meta.difficulty as CodeProblem['difficulty'],
              description: '',
              examples: [],
              constraints: [],
              starterCode: '',
              testCases: [],
            };
          }
        }
        problemIds = newIds;
        populateProblemSelect();
      }
    } catch { /* keep current list */ }
  });

  // Switch to selected problem
  problemSelect.addEventListener('change', async () => {
    const id = problemSelect.value;
    if (!id || id === currentProblem?.id) return;
    const problem = await loadProblemById(id);
    if (problem) {
      switchToProblem(problem);
      populateProblemSelect();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  });
}

function showNotification(message: string): void {
  const existing = document.querySelector('.lab-notification');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'lab-notification';
  el.textContent = message;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('show'));

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function updateStatusUI(
  status: ExecutionStatus,
  statusText: HTMLElement,
  statusDot: Element,
  btnRun: HTMLButtonElement,
  btnTests: HTMLButtonElement,
  customMessage?: string | null
): void {
  statusDot.className = 'status-dot';

  switch (status) {
    case 'loading':
      statusDot.classList.add('status-loading');
      statusText.textContent = customMessage || 'Loading Python...';
      btnRun.disabled = true;
      btnTests.disabled = true;
      break;
    case 'ready':
      statusDot.classList.add('status-ready');
      statusText.textContent = 'Ready';
      btnRun.disabled = false;
      btnTests.disabled = false;
      break;
    case 'running':
      statusDot.classList.add('status-running');
      statusText.textContent = 'Running...';
      btnRun.disabled = true;
      btnTests.disabled = true;
      break;
    case 'error':
      statusDot.classList.add('status-error');
      statusText.textContent = 'Error';
      btnRun.disabled = true;
      btnTests.disabled = true;
      break;
    default:
      statusDot.classList.add('status-loading');
      statusText.textContent = 'Loading...';
      btnRun.disabled = true;
      btnTests.disabled = true;
  }
}

// Boot
document.addEventListener('DOMContentLoaded', initRegistration);
