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
import Sk from 'skulpt';
import { CodeEditor } from './code-editor';
import { CodeExecutor } from './code-executor';
import { SkulptExecutor } from './code-skulpt-executor';
import { CodeSession } from './code-session';
import { CodeSocket } from './code-socket';
import { problems, defaultProblem } from './code-problems';
import { renderOutput, renderOutputLoading, escapeHtml } from './code-output';
import type { CodeProblem, ExecutionStatus } from './code-types';

const THEME_KEY = 'python-lab-theme';
const ENGINE_KEY = 'python-lab-engine';

type EngineType = 'pyodide' | 'skulpt';

let app: HTMLElement;
let editor: CodeEditor;
let executor: CodeExecutor | SkulptExecutor;
let session: CodeSession;
let socket: CodeSocket;
let currentProblem: CodeProblem = defaultProblem;
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
          <button class="btn btn-problem" id="btn-problem">切換題目</button>
          <select class="engine-select" id="engine-select" title="Python 引擎">
            <option value="pyodide">Pyodide</option>
            <option value="skulpt">Skulpt</option>
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

function renderProblem(problem: CodeProblem): string {
  return `
    <div class="problem-header">
      <h1 class="problem-title">${escapeHtml(problem.title)}</h1>
      <span class="problem-difficulty difficulty-${problem.difficulty}">${problem.difficulty}</span>
    </div>
    <div class="problem-description">${problem.description}</div>
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
  const btnProblem = document.getElementById('btn-problem')! as HTMLButtonElement;
  const statusText = document.getElementById('status-text')!;
  const statusDot = document.querySelector('.status-dot')!;
  const connDot = document.getElementById('conn-dot')!;
  const connText = document.getElementById('conn-text')!;

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

  // Theme toggle
  updateThemeButton();
  document.getElementById('btn-theme-toggle')!.addEventListener('click', toggleTheme);

  // Engine selector
  const engineSelect = document.getElementById('engine-select') as HTMLSelectElement;
  const turtleWrapper = document.getElementById('turtle-canvas-wrapper')!;

  const savedEngine = localStorage.getItem(ENGINE_KEY) as EngineType | null;
  if (savedEngine === 'skulpt' || savedEngine === 'pyodide') {
    currentEngine = savedEngine;
    engineSelect.value = savedEngine;
  }

  function createExecutor(engine: EngineType): void {
    executor?.destroy();
    turtleWrapper.classList.add('hidden');

    if (engine === 'skulpt') {
      turtleWrapper.classList.remove('hidden');
      try {
        // Sk.TurtleGraphics is created by the turtle module on first import.
        // Pre-configure it so the module finds the right canvas element.
        if (!(Sk as any).TurtleGraphics) {
          (Sk as any).TurtleGraphics = {};
        }
        (Sk as any).TurtleGraphics.target = 'turtle-canvas';
        executor = new SkulptExecutor('turtle-canvas');
      } catch (err: any) {
        console.error('Skulpt init failed:', err);
        outputPanel.innerHTML = `<div class="output-stderr">Failed to start Skulpt: ${escapeHtml(err.message)}</div>`;
        // Fall back to Pyodide
        engineSelect.value = 'pyodide';
        localStorage.setItem(ENGINE_KEY, 'pyodide');
        currentEngine = 'pyodide';
        executor = new CodeExecutor();
      }
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

  async function handleTests(): Promise<void> {
    if (!executor.isReady()) return;
    outputPanel.innerHTML = renderOutputLoading();
    const code = editor.getCode();
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

  btnRun.addEventListener('click', handleRun);
  btnTests.addEventListener('click', handleTests);

  btnProblem.addEventListener('click', () => {
    const keys = Object.keys(problems);
    const currentIdx = keys.indexOf(currentProblem.id);
    const nextIdx = (currentIdx + 1) % keys.length;
    currentProblem = problems[keys[nextIdx]];

    problemPanel.innerHTML = renderProblem(currentProblem);
    editor.setCode(currentProblem.starterCode);
    session.updateCode(currentProblem.starterCode);
    outputPanel.innerHTML = '<div class="output-placeholder">Code cleared. Press Run to execute.</div>';
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  });
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
