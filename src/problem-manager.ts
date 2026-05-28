import { marked } from 'marked';
import { CodeEditor } from './code-editor';
import { escapeHtml } from './code-output';

marked.setOptions({ breaks: true });

export interface ProblemMeta {
  id: string;
  file: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface Problem extends ProblemMeta {
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: string;
  testCases: { input: string; expected: string }[];
  solution?: string;
  hints?: string[];
}

interface EditingProblem extends Problem {
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: string;
  testCases: { input: string; expected: string }[];
  solution: string;
  hints: string[];
}

function emptyProblem(): EditingProblem {
  return {
    id: '',
    file: '',
    title: '',
    difficulty: 'easy',
    category: '',
    tags: [],
    description: '',
    examples: [],
    constraints: [],
    starterCode: '',
    testCases: [],
    solution: '',
    hints: [],
    author: 'teacher',
    createdAt: '',
    updatedAt: '',
  };
}

function newProblemId(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'new-problem';
  return base + '-' + Date.now().toString(36);
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export class ProblemManager {
  private container: HTMLElement;
  private problems: ProblemMeta[] = [];
  private editing: EditingProblem = emptyProblem();
  private selectedId: string | null = null;
  private isDirty = false;
  private starterEditor: CodeEditor | null = null;
  private solutionEditor: CodeEditor | null = null;

  /** Called when user clicks a problem in the list (for push workflow). */
  onProblemSelect: ((problem: Problem) => void) | null = null;
  /** Called after any CRUD operation. */
  onProblemsChange: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    await this.loadProblems();
    this.render();
  }

  getProblems(): ProblemMeta[] {
    return this.problems;
  }

  async getProblem(id: string): Promise<Problem | null> {
    try {
      const res = await fetch(`/api/problems/${id}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  private async loadProblems(): Promise<void> {
    try {
      const res = await fetch('/api/problems');
      if (res.ok) {
        this.problems = await res.json();
      }
    } catch (err) {
      console.error('Failed to load problems:', err);
    }
  }

  /* ---- Render ---- */

  private render(): void {
    this.container.innerHTML = `
      <div class="pm-layout">
        <div class="pm-sidebar" id="pm-sidebar"></div>
        <div class="pm-editor" id="pm-editor"></div>
        <div class="pm-preview" id="pm-preview"></div>
      </div>
    `;
    this.renderSidebar();
    this.renderEditor();
    this.renderPreview();
  }

  private renderSidebar(): void {
    const el = document.getElementById('pm-sidebar')!;
    const items = this.problems
      .map(
        (p) => `
        <div class="pm-problem-item ${p.id === this.selectedId ? 'active' : ''}"
             data-id="${escapeHtml(p.id)}">
          <span class="pm-problem-title">${escapeHtml(p.title || '(未命名)')}</span>
          <span class="pm-problem-meta">
            <span class="difficulty-label difficulty-${p.difficulty}">${p.difficulty}</span>
            ${p.category ? `<span class="pm-problem-cat">${escapeHtml(p.category)}</span>` : ''}
          </span>
        </div>
      `
      )
      .join('');

    el.innerHTML = `
      <div class="pm-sidebar-header">
        <h3>題目列表</h3>
        <span class="pm-count">${this.problems.length}</span>
      </div>
      <div class="pm-sidebar-actions">
        <button class="btn btn-small btn-new" id="pm-btn-new">+ 新增</button>
        <button class="btn btn-small btn-import" id="pm-btn-import">匯入</button>
      </div>
      <div class="pm-problem-list" id="pm-problem-list">${items || '<div class="pm-empty">尚無題目</div>'}</div>
    `;

    el.querySelectorAll('.pm-problem-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.id!;
        this.selectProblem(id);
      });
    });

    document.getElementById('pm-btn-new')!.addEventListener('click', () => this.createNew());
    document.getElementById('pm-btn-import')!.addEventListener('click', () => this.triggerImport());
  }

  private renderEditor(): void {
    const el = document.getElementById('pm-editor')!;
    const p = this.editing;

    el.innerHTML = `
      <div class="pm-editor-header">
        <h3>${this.selectedId ? '編輯題目' : '新增題目'}</h3>
        <div class="pm-editor-actions">
          <button class="btn btn-save" id="pm-btn-save">儲存</button>
          ${this.selectedId ? '<button class="btn btn-export" id="pm-btn-export">匯出</button>' : ''}
          ${this.selectedId ? '<button class="btn btn-delete" id="pm-btn-delete">刪除</button>' : ''}
        </div>
      </div>
      <div class="pm-form">
        <div class="pm-form-row">
          <div class="pm-field pm-field-title">
            <label>標題</label>
            <input type="text" id="pm-title" value="${escapeHtml(p.title)}" placeholder="題目標題" />
          </div>
          <div class="pm-field pm-field-difficulty">
            <label>難度</label>
            <select id="pm-difficulty">
              <option value="easy" ${p.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
              <option value="medium" ${p.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="hard" ${p.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
            </select>
          </div>
        </div>
        <div class="pm-form-row">
          <div class="pm-field pm-field-category">
            <label>分類</label>
            <input type="text" id="pm-category" value="${escapeHtml(p.category)}" placeholder="如：Array, Loop" />
          </div>
          <div class="pm-field pm-field-tags">
            <label>標籤</label>
            <input type="text" id="pm-tags" value="${escapeHtml(p.tags.join(', '))}" placeholder="以逗號分隔" />
          </div>
        </div>
        <div class="pm-field">
          <label>題目描述 <span class="pm-hint">(支援 Markdown)</span></label>
          <textarea id="pm-description" class="pm-textarea" rows="6">${escapeHtml(p.description)}</textarea>
        </div>
        <div class="pm-field">
          <label>範例 <button class="btn btn-tiny" id="pm-add-example">+</button></label>
          <div id="pm-examples">${this.renderExampleFields(p)}</div>
        </div>
        <div class="pm-field">
          <label>約束條件 <button class="btn btn-tiny" id="pm-add-constraint">+</button></label>
          <div id="pm-constraints">${this.renderConstraintFields(p)}</div>
        </div>
        <div class="pm-field">
          <label>起始代碼</label>
          <div class="pm-codemirror-container" id="pm-starter-editor"></div>
        </div>
        <div class="pm-field">
          <label>測試用例 <button class="btn btn-tiny" id="pm-add-testcase">+</button></label>
          <div id="pm-testcases">${this.renderTestCaseFields(p)}</div>
        </div>
        <details class="pm-details">
          <summary>教師專用 (參考解答 & 提示)</summary>
          <div class="pm-field">
            <label>參考解答</label>
            <div class="pm-codemirror-container" id="pm-solution-editor"></div>
          </div>
          <div class="pm-field">
            <label>提示 <button class="btn btn-tiny" id="pm-add-hint">+</button></label>
            <div id="pm-hints">${this.renderHintFields(p)}</div>
          </div>
        </details>
      </div>
    `;

    // CodeMirror editors
    const starterContainer = document.getElementById('pm-starter-editor')!;
    const isLight = document.documentElement.dataset.theme === 'light';
    this.starterEditor = new CodeEditor(starterContainer, p.starterCode, false, isLight);

    const solutionContainer = document.getElementById('pm-solution-editor')!;
    this.solutionEditor = new CodeEditor(solutionContainer, p.solution || '', false, isLight);

    // Wire events
    this.wireEditorEvents();
  }

  private renderExampleFields(p: EditingProblem): string {
    return p.examples
      .map(
        (ex, i) => `
        <div class="pm-dynamic-row" data-index="${i}">
          <input type="text" class="pm-example-input" value="${escapeHtml(ex.input)}" placeholder="Input" />
          <input type="text" class="pm-example-output" value="${escapeHtml(ex.output)}" placeholder="Output" />
          <input type="text" class="pm-example-explanation" value="${escapeHtml(ex.explanation || '')}" placeholder="Explanation (optional)" />
          <button class="btn btn-tiny btn-remove" data-action="remove-example">✕</button>
        </div>
      `
      )
      .join('');
  }

  private renderConstraintFields(p: EditingProblem): string {
    return p.constraints
      .map(
        (c, i) => `
        <div class="pm-dynamic-row" data-index="${i}">
          <input type="text" class="pm-constraint-input" value="${escapeHtml(c)}" placeholder="約束條件" />
          <button class="btn btn-tiny btn-remove" data-action="remove-constraint">✕</button>
        </div>
      `
      )
      .join('');
  }

  private renderTestCaseFields(p: EditingProblem): string {
    return p.testCases
      .map(
        (tc, i) => `
        <div class="pm-dynamic-row" data-index="${i}">
          <input type="text" class="pm-testcase-input" value="${escapeHtml(tc.input)}" placeholder="Input" />
          <input type="text" class="pm-testcase-expected" value="${escapeHtml(tc.expected)}" placeholder="Expected" />
          <button class="btn btn-tiny btn-remove" data-action="remove-testcase">✕</button>
        </div>
      `
      )
      .join('');
  }

  private renderHintFields(p: EditingProblem): string {
    return p.hints
      .map(
        (h, i) => `
        <div class="pm-dynamic-row" data-index="${i}">
          <input type="text" class="pm-hint-input" value="${escapeHtml(h)}" placeholder="提示文字" />
          <button class="btn btn-tiny btn-remove" data-action="remove-hint">✕</button>
        </div>
      `
      )
      .join('');
  }

  /** Sync current form field values back to this.editing (without re-rendering). */
  private syncFormToEditing(): void {
    this.editing.title = (document.getElementById('pm-title') as HTMLInputElement)?.value || '';
    this.editing.difficulty = (document.getElementById('pm-difficulty') as HTMLSelectElement)?.value as EditingProblem['difficulty'] || 'easy';
    this.editing.category = (document.getElementById('pm-category') as HTMLInputElement)?.value || '';
    const tagsRaw = (document.getElementById('pm-tags') as HTMLInputElement)?.value || '';
    this.editing.tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
    this.editing.description = (document.getElementById('pm-description') as HTMLTextAreaElement)?.value || '';
    this.editing.starterCode = this.starterEditor?.getCode() || '';
    this.editing.solution = this.solutionEditor?.getCode() || '';
    this.editing.examples = this.collectExamples();
    this.editing.constraints = this.collectConstraints();
    this.editing.testCases = this.collectTestCases();
    this.editing.hints = this.collectHints();
  }

  private wireEditorEvents(): void {
    // Save
    document.getElementById('pm-btn-save')?.addEventListener('click', () => this.saveProblem());
    // Delete
    document.getElementById('pm-btn-delete')?.addEventListener('click', () => {
      if (this.selectedId && confirm('確定要刪除這道題目嗎？')) {
        this.deleteProblem(this.selectedId);
      }
    });
    // Export
    document.getElementById('pm-btn-export')?.addEventListener('click', () => this.exportProblem());

    // Add buttons for dynamic lists
    document.getElementById('pm-add-example')?.addEventListener('click', () => {
      this.syncFormToEditing();
      this.editing.examples.push({ input: '', output: '', explanation: '' });
      this.renderEditor();
      this.updatePreview();
    });
    document.getElementById('pm-add-constraint')?.addEventListener('click', () => {
      this.syncFormToEditing();
      this.editing.constraints.push('');
      this.renderEditor();
      this.updatePreview();
    });
    document.getElementById('pm-add-testcase')?.addEventListener('click', () => {
      this.syncFormToEditing();
      this.editing.testCases.push({ input: '', expected: '' });
      this.renderEditor();
      this.updatePreview();
    });
    document.getElementById('pm-add-hint')?.addEventListener('click', () => {
      this.syncFormToEditing();
      this.editing.hints.push('');
      this.renderEditor();
      this.updatePreview();
    });

    // Remove buttons for dynamic lists
    document.getElementById('pm-editor')!.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      if (!action) return;

      const row = target.closest('.pm-dynamic-row') as HTMLElement;
      if (!row) return;
      const idx = parseInt(row.dataset.index!, 10);

      this.syncFormToEditing();

      switch (action) {
        case 'remove-example':
          this.editing.examples.splice(idx, 1);
          break;
        case 'remove-constraint':
          this.editing.constraints.splice(idx, 1);
          break;
        case 'remove-testcase':
          this.editing.testCases.splice(idx, 1);
          break;
        case 'remove-hint':
          this.editing.hints.splice(idx, 1);
          break;
      }
      this.renderEditor();
      this.updatePreview();
    });

    // Live preview on input changes
    const textInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      '#pm-title, #pm-category, #pm-tags, #pm-description, #pm-difficulty'
    );
    textInputs.forEach((input) => {
      input.addEventListener('input', () => this.updatePreview());
    });

    // Dynamic row inputs
    document.getElementById('pm-editor')!.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('pm-example-input') ||
        target.classList.contains('pm-example-output') ||
        target.classList.contains('pm-example-explanation') ||
        target.classList.contains('pm-constraint-input') ||
        target.classList.contains('pm-testcase-input') ||
        target.classList.contains('pm-testcase-expected') ||
        target.classList.contains('pm-hint-input')
      ) {
        this.updatePreview();
      }
    });

    // Keyboard shortcut: Ctrl+S to save
    document.getElementById('pm-editor')!.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        this.saveProblem();
      }
    });
  }

  /* ---- Preview ---- */

  private renderPreview(): void {
    const el = document.getElementById('pm-preview')!;
    el.innerHTML = `
      <div class="pm-preview-header"><h3>即時預覽</h3></div>
      <div id="pm-preview-content"></div>
    `;
    this.updatePreview();
  }

  private updatePreview(): void {
    const content = document.getElementById('pm-preview-content');
    if (!content) return;

    // Collect form data
    const title = (document.getElementById('pm-title') as HTMLInputElement)?.value || this.editing.title;
    const difficulty = (document.getElementById('pm-difficulty') as HTMLSelectElement)?.value || this.editing.difficulty;

    let description = '';
    if (document.getElementById('pm-description')) {
      description = (document.getElementById('pm-description') as HTMLTextAreaElement).value;
    }

    // Render with marked
    let descHtml = '';
    try {
      descHtml = marked.parse(description || '') as string;
    } catch {
      descHtml = escapeHtml(description || '');
    }

    // Collect examples from form
    const examples = this.collectExamples();

    // Collect constraints from form
    const constraints = this.collectConstraints();

    let exHtml = '';
    if (examples.length) {
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
      exHtml = `<div class="problem-section-title">Examples</div>${items}`;
    }

    let conHtml = '';
    if (constraints.length) {
      const items = constraints.map((c) => `<li>${escapeHtml(c)}</li>`).join('');
      conHtml = `<div class="problem-section-title">Constraints</div><ul class="constraints-list">${items}</ul>`;
    }

    content.innerHTML = `
      <div class="problem-header">
        <h1 class="problem-title">${escapeHtml(title) || '(未命名)'}</h1>
        <span class="problem-difficulty difficulty-${difficulty}">${difficulty}</span>
      </div>
      <div class="problem-description">${descHtml}</div>
      ${exHtml}
      ${conHtml}
    `;
  }

  private collectExamples(): { input: string; output: string; explanation?: string }[] {
    const rows = document.querySelectorAll<HTMLElement>('#pm-examples .pm-dynamic-row');
    const examples: { input: string; output: string; explanation?: string }[] = [];
    rows.forEach((row) => {
      const input = (row.querySelector('.pm-example-input') as HTMLInputElement)?.value || '';
      const output = (row.querySelector('.pm-example-output') as HTMLInputElement)?.value || '';
      const explanation = (row.querySelector('.pm-example-explanation') as HTMLInputElement)?.value || '';
      if (input || output) {
        examples.push({ input, output, ...(explanation ? { explanation } : {}) });
      }
    });
    return examples;
  }

  private collectConstraints(): string[] {
    const rows = document.querySelectorAll<HTMLElement>('#pm-constraints .pm-dynamic-row');
    const constraints: string[] = [];
    rows.forEach((row) => {
      const val = (row.querySelector('.pm-constraint-input') as HTMLInputElement)?.value?.trim();
      if (val) constraints.push(val);
    });
    return constraints;
  }

  private collectTestCases(): { input: string; expected: string }[] {
    const rows = document.querySelectorAll<HTMLElement>('#pm-testcases .pm-dynamic-row');
    const testCases: { input: string; expected: string }[] = [];
    rows.forEach((row) => {
      const input = (row.querySelector('.pm-testcase-input') as HTMLInputElement)?.value || '';
      const expected = (row.querySelector('.pm-testcase-expected') as HTMLInputElement)?.value || '';
      if (input || expected) {
        testCases.push({ input, expected });
      }
    });
    return testCases;
  }

  private collectHints(): string[] {
    const rows = document.querySelectorAll<HTMLElement>('#pm-hints .pm-dynamic-row');
    const hints: string[] = [];
    rows.forEach((row) => {
      const val = (row.querySelector('.pm-hint-input') as HTMLInputElement)?.value?.trim();
      if (val) hints.push(val);
    });
    return hints;
  }

  /* ---- CRUD ---- */

  private async selectProblem(id: string): Promise<void> {
    const problem = await this.getProblem(id);
    if (!problem) return;

    this.selectedId = id;
    this.editing = {
      ...problem,
      solution: problem.solution || '',
      hints: problem.hints || [],
      examples: problem.examples || [],
      constraints: problem.constraints || [],
      testCases: problem.testCases || [],
    };
    this.isDirty = false;
    this.starterEditor?.destroy();
    this.solutionEditor?.destroy();
    this.render();

    this.onProblemSelect?.(problem);
  }

  private createNew(): void {
    this.selectedId = null;
    this.editing = emptyProblem();
    this.isDirty = false;
    this.starterEditor?.destroy();
    this.solutionEditor?.destroy();
    this.render();
  }

  private collectFormData(): EditingProblem {
    const title = (document.getElementById('pm-title') as HTMLInputElement)?.value?.trim() || '';
    const difficulty = (document.getElementById('pm-difficulty') as HTMLSelectElement)?.value as EditingProblem['difficulty'] || 'easy';
    const category = (document.getElementById('pm-category') as HTMLInputElement)?.value?.trim() || '';
    const tagsRaw = (document.getElementById('pm-tags') as HTMLInputElement)?.value || '';
    const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
    const description = (document.getElementById('pm-description') as HTMLTextAreaElement)?.value || '';
    const starterCode = this.starterEditor?.getCode() || '';
    const solution = this.solutionEditor?.getCode() || '';

    return {
      ...this.editing,
      title,
      difficulty,
      category,
      tags,
      description,
      examples: this.collectExamples(),
      constraints: this.collectConstraints(),
      starterCode,
      testCases: this.collectTestCases(),
      solution,
      hints: this.collectHints(),
    };
  }

  async saveProblem(): Promise<void> {
    const data = this.collectFormData();

    if (!data.title.trim()) {
      alert('請輸入題目標題');
      return;
    }

    try {
      let result: Problem;

      if (this.selectedId) {
        // Update existing
        const res = await fetch(`/api/problems/${this.selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update');
        result = await res.json();
      } else {
        // Create new
        data.id = newProblemId(data.title);
        const res = await fetch('/api/problems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create');
        result = await res.json();
      }

      this.selectedId = result.id;
      this.editing = { ...result, solution: result.solution || '', hints: result.hints || [] };
      this.isDirty = false;

      await this.loadProblems();
      this.render();
      this.onProblemsChange?.();
    } catch (err) {
      console.error('Save failed:', err);
      alert('儲存失敗');
    }
  }

  private async deleteProblem(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/problems/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      this.selectedId = null;
      this.editing = emptyProblem();
      await this.loadProblems();
      this.render();
      this.onProblemsChange?.();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('刪除失敗');
    }
  }

  private async exportProblem(): Promise<void> {
    if (!this.selectedId) return;
    const problem = await this.getProblem(this.selectedId);
    if (!problem) return;

    const blob = new Blob([JSON.stringify(problem, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${problem.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private triggerImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const problem = JSON.parse(text) as Problem;
        // Generate a new id to avoid conflicts
        if (!problem.id || this.problems.some((p) => p.id === problem.id)) {
          problem.id = newProblemId(problem.title || 'imported');
        }
        const res = await fetch('/api/problems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(problem),
        });
        if (!res.ok) throw new Error('Import failed');
        await this.loadProblems();
        const result = await res.json();
        this.selectProblem(result.id);
        this.onProblemsChange?.();
      } catch (err) {
        console.error('Import failed:', err);
        alert('匯入失敗：檔案格式不正確');
      }
    });
    input.click();
  }

  setTheme(isLight: boolean): void {
    this.starterEditor?.setTheme(isLight);
    this.solutionEditor?.setTheme(isLight);
  }

  destroy(): void {
    this.starterEditor?.destroy();
    this.solutionEditor?.destroy();
  }
}
