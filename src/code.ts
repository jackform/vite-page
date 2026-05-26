/**
 * Python Coding Lab — Main orchestrator.
 *
 * Lifecycle:
 * 1. Render the empty layout on DOMContentLoaded
 * 2. Mount CodeMirror editor with starter code
 * 3. Kick off Pyodide load (async, slow)
 * 4. Once Pyodide is ready, enable Run/Tests buttons
 * 5. On Run/Tests: send code to executor, display results
 *
 * This is the page entry point, analogous to src/main.ts and src/poster.ts.
 */

import './code.css';
import { CodeEditor } from './code-editor';
import { CodeExecutor } from './code-executor';
import { CodeSession } from './code-session';
import { problems, defaultProblem } from './code-problems';
import type { CodeProblem, ExecutionStatus, TestRunResult } from './code-types';

/* ---- DOM references (populated after renderLayout) ---- */

let app: HTMLElement;
let editor: CodeEditor;
let executor: CodeExecutor;
let session: CodeSession;
let currentProblem: CodeProblem = defaultProblem;

/* ---- Render Functions ---- */

function renderLayout(): string {
  return `
    <nav class="code-nav">
      <a href="./">← 返回個人主頁</a>
      <span class="code-nav-title">Python 程式設計實驗室</span>
      <div></div>
    </nav>
    <div class="code-layout">
      <div class="problem-panel" id="problem-panel"></div>
      <div class="editor-output-panel">
        <div class="editor-panel" id="editor-panel"></div>
        <div class="action-bar">
          <button class="btn btn-run" id="btn-run" disabled>▶ Run</button>
          <button class="btn btn-tests" id="btn-tests" disabled>✓ Run Tests</button>
          <button class="btn btn-problem" id="btn-problem">切換題目</button>
          <div class="executor-status" id="executor-status">
            <span class="status-dot status-loading"></span>
            <span id="status-text">Loading Python...</span>
          </div>
        </div>
        <div class="output-panel" id="output-panel">
          <div class="output-placeholder">Python environment is loading, please wait...</div>
        </div>
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

function renderOutput(result: TestRunResult): string {
  let html = '';

  // Stdout section
  if (result.stdout.trim()) {
    html += `<div class="output-stdout">${escapeHtml(result.stdout.trim())}</div>`;
  }

  // Stderr section
  if (result.stderr.trim()) {
    html += `<div class="output-stderr">${escapeHtml(result.stderr.trim())}</div>`;
  }

  // Return value
  if (result.returnValue !== undefined && result.returnValue !== 'None') {
    html += `<div class="output-stdout">⇒ ${escapeHtml(result.returnValue)}</div>`;
  }

  // Test results (if running tests)
  if (result.testResults && result.testResults.length > 0) {
    html += '<div class="test-results">';

    const allPassed = result.testResults.every((t) => t.passed);
    html += `<div class="test-result-summary ${allPassed ? 'all-passed' : 'has-failures'}">`;
    html += `${allPassed ? '✓' : '✗'} ${result.passedCount}/${result.totalCount} tests passed`;
    html += '</div>';

    for (const tr of result.testResults) {
      html += `
        <div class="test-case-item ${tr.passed ? 'test-passed' : 'test-failed'}">
          <span class="test-case-index">Test ${tr.index + 1}</span>
          <div class="test-case-detail">
            <div><span class="label">Input: </span><span class="value">${escapeHtml(tr.input)}</span></div>
            <div><span class="label">Expected: </span><span class="value">${escapeHtml(tr.expected)}</span></div>
            <div><span class="label">Actual: </span><span class="${tr.passed ? 'value' : 'actual-error'}">${escapeHtml(tr.actual)}</span></div>
          </div>
        </div>
      `;
    }

    html += '</div>';
  }

  // Execution time
  if (result.executionTime !== undefined) {
    html += `<div class="output-meta">Execution time: ${result.executionTime}ms</div>`;
  }

  // Show error for timeout
  if (result.status === 'timeout') {
    html += `<div class="output-stderr">⏱ ${escapeHtml(result.stderr)}</div>`;
  }

  return html;
}

/** Show loading state in the output panel. */
function renderOutputLoading(): string {
  return '<div class="output-loading"><span class="loading-spinner"></span> Running...</div>';
}

/** Escape HTML special characters. */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ---- Init ---- */

async function init(): Promise<void> {
  app = document.getElementById('code-app') as HTMLElement;
  if (!app) return;

  // ---- Render layout ----
  app.innerHTML = renderLayout();

  const problemPanel = document.getElementById('problem-panel')!;
  const editorPanel = document.getElementById('editor-panel')!;
  const outputPanel = document.getElementById('output-panel')!;
  const btnRun = document.getElementById('btn-run')! as HTMLButtonElement;
  const btnTests = document.getElementById('btn-tests')! as HTMLButtonElement;
  const btnProblem = document.getElementById('btn-problem')! as HTMLButtonElement;
  const statusText = document.getElementById('status-text')!;
  const statusDot = document.querySelector('.status-dot')!;

  // ---- Render problem description ----
  problemPanel.innerHTML = renderProblem(currentProblem);

  // ---- Create session (Yjs-ready seam) ----
  session = new CodeSession(
    { roomId: 'default', role: 'student', userId: 'anonymous' },
    currentProblem.starterCode
  );

  // ---- Mount editor ----
  editor = new CodeEditor(editorPanel, currentProblem.starterCode);

  editor.onChange((code) => {
    session.updateCode(code);
  });

  // ---- Create executor and start loading Pyodide ----
  executor = new CodeExecutor();

  executor.onStatusChange((status: ExecutionStatus) => {
    updateStatusUI(status, statusText, statusDot, btnRun, btnTests);
  });

  // Start loading Pyodide in background (don't block the UI)
  executor.load().then(() => {
    // Ready — update UI handled by onStatusChange
  }).catch((err) => {
    console.error('Pyodide failed to load:', err);
    outputPanel.innerHTML = `<div class="output-stderr">Failed to load Python environment: ${escapeHtml(err.message)}</div>`;
  });

  // ---- Button handlers ----

  async function handleRun(): Promise<void> {
    if (!executor.isReady()) return;
    outputPanel.innerHTML = renderOutputLoading();
    const code = editor.getCode();
    const result = await executor.execute(code);
    outputPanel.innerHTML = renderOutput(result);
  }

  async function handleTests(): Promise<void> {
    if (!executor.isReady()) return;
    outputPanel.innerHTML = renderOutputLoading();
    const code = editor.getCode();
    const result = await executor.runTests(code, currentProblem.testCases);
    outputPanel.innerHTML = renderOutput(result);
  }

  btnRun.addEventListener('click', handleRun);
  btnTests.addEventListener('click', handleTests);

  // Problem switcher — cycles through available problems
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

  // Keyboard shortcut: Ctrl/Cmd+Enter to run
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
  btnTests: HTMLButtonElement
): void {
  statusDot.className = 'status-dot';

  switch (status) {
    case 'loading':
      statusDot.classList.add('status-loading');
      statusText.textContent = 'Loading Python...';
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
document.addEventListener('DOMContentLoaded', init);
