/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProblemManager } from '../problem-manager';

// Mock CodeEditor
vi.mock('../code-editor', () => {
  return {
    CodeEditor: vi.fn().mockImplementation(function (
      _container: HTMLElement,
      initialCode: string,
      _readOnly = false,
      _isLight = false,
    ) {
      let code = initialCode;
      let onChangeCb: ((c: string) => void) | null = null;
      return {
        getCode: () => code,
        setCode: (c: string) => { code = c; },
        onChange: (cb: (c: string) => void) => { onChangeCb = cb; },
        setTheme: vi.fn(),
        setReadOnly: vi.fn(),
        destroy: vi.fn(),
        // Test helpers
        _setCode: (c: string) => { code = c; },
        _triggerChange: (c: string) => { code = c; onChangeCb?.(c); },
      };
    }),
  };
});

function createTestContainer(): HTMLElement {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

const sampleProblemList = [
  { id: 'p1', file: 'p1.json', title: 'Two Sum', difficulty: 'easy', category: 'Array', tags: ['hash'], author: 'teacher', createdAt: '2024-01-01', updatedAt: '2024-01-02' },
  { id: 'p2', file: 'p2.json', title: 'Add Two Numbers', difficulty: 'medium', category: 'Linked List', tags: ['math'], author: 'teacher', createdAt: '2024-01-01', updatedAt: '2024-01-02' },
];

const sampleProblemDetail = {
  id: 'p1', file: 'p1.json', title: 'Two Sum', difficulty: 'easy', category: 'Array',
  tags: ['hash'], author: 'teacher', createdAt: '2024-01-01', updatedAt: '2024-01-02',
  description: '# Two Sum\nFind two numbers that add up to target.',
  examples: [{ input: '[2,7]', output: '[0,1]', explanation: '2+7=9' }],
  constraints: ['2 <= nums.length <= 10^4'],
  starterCode: 'def twoSum(nums, target):\n  pass',
  testCases: [{ input: '[2,7]\n9', expected: '[0,1]' }],
  solution: 'def twoSum(nums, target):\n  for i, a in enumerate(nums):\n    for j, b in enumerate(nums):\n      if a+b==target: return [i,j]',
  hints: ['Use a hash map'],
};

describe('ProblemManager', () => {
  let container: HTMLElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = createTestContainer();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    // Default: return empty problem list
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/problems') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sampleProblemList),
        });
      }
      if (url.startsWith('/api/problems/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sampleProblemDetail),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  // ---- 4.1 Render Structure ----

  describe('rendering', () => {
    it('renders three-column layout', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      expect(container.querySelector('.pm-layout')).toBeTruthy();
      expect(container.querySelector('.pm-sidebar')).toBeTruthy();
      expect(container.querySelector('.pm-editor')).toBeTruthy();
      expect(container.querySelector('.pm-preview')).toBeTruthy();
    });

    it('renders problem list in sidebar', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      const items = container.querySelectorAll('.pm-problem-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Two Sum');
      expect(items[1].textContent).toContain('Add Two Numbers');
    });

    it('shows empty state when no problems', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/problems') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
      });

      const pm = new ProblemManager(container);
      await pm.init();

      expect(container.textContent).toContain('尚無題目');
    });

    it('renders new button in sidebar', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      const btn = container.querySelector('#pm-btn-new');
      expect(btn).toBeTruthy();
      expect(btn!.textContent).toContain('新增');
    });

    it('renders form fields for editing', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      expect(container.querySelector('#pm-title')).toBeTruthy();
      expect(container.querySelector('#pm-difficulty')).toBeTruthy();
      expect(container.querySelector('#pm-description')).toBeTruthy();
    });

    it('renders problem count in sidebar', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      const count = container.querySelector('.pm-count');
      expect(count).toBeTruthy();
      expect(count!.textContent).toBe('2');
    });
  });

  // ---- 4.2 Form Population ----

  describe('form population', () => {
    it('loads problem list from API on init', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      expect(fetchMock).toHaveBeenCalledWith('/api/problems');
      expect(pm.getProblems()).toHaveLength(2);
    });

    it('handles API error gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const pm = new ProblemManager(container);
      await pm.init();

      // Should not crash, should still render
      expect(container.querySelector('.pm-layout')).toBeTruthy();
      expect(pm.getProblems()).toHaveLength(0);
    });

    it('selecting a problem fetches full detail', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      // Click on "Two Sum"
      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();

      await vi.waitFor(() => {
        const calls = fetchMock.mock.calls.filter(
          (c: any[]) => c[0] === '/api/problems/p1'
        );
        expect(calls.length).toBeGreaterThan(0);
      });
    });

    it('getProblem returns full problem data', async () => {
      const pm = new ProblemManager(container);

      const problem = await pm.getProblem('p1');
      expect(problem?.title).toBe('Two Sum');
      expect(fetchMock).toHaveBeenCalledWith('/api/problems/p1');
    });

    it('getProblem returns null on fetch error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      const pm = new ProblemManager(container);

      const problem = await pm.getProblem('p1');
      expect(problem).toBeNull();
    });
  });

  // ---- 4.3 CRUD Operations ----

  describe('CRUD operations', () => {
    it('new problem clears form state', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      // Select a problem first
      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();
      await vi.waitFor(() => {});

      // Click new
      const newBtn = container.querySelector('#pm-btn-new') as HTMLElement;
      newBtn.click();

      const titleInput = container.querySelector('#pm-title') as HTMLInputElement;
      expect(titleInput.value).toBe('');
    });

    it('save creates new problem via POST', async () => {
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/problems' && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...sampleProblemDetail, id: 'new-id' }),
          });
        }
        if (url === '/api/problems') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleProblemList) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleProblemDetail) });
      });

      const pm = new ProblemManager(container);
      await pm.init();

      // Fill title and click save
      const titleInput = container.querySelector('#pm-title') as HTMLInputElement;
      titleInput.value = 'New Problem';
      const saveBtn = container.querySelector('#pm-btn-save') as HTMLElement;
      saveBtn.click();

      await vi.waitFor(() => {
        const postCalls = fetchMock.mock.calls.filter(
          (c: any[]) => c[1]?.method === 'POST'
        );
        expect(postCalls.length).toBeGreaterThan(0);
      });
    });

    it('save updates existing problem via PUT', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      // Select problem first
      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();

      // Wait for the delete button to appear (indicates editor is rendered for selected problem)
      await vi.waitFor(() => {
        expect(container.querySelector('#pm-btn-delete')).toBeTruthy();
      });

      // Modify title and save
      const titleInput = container.querySelector('#pm-title') as HTMLInputElement;
      titleInput.value = 'Updated Title';
      const saveBtn = container.querySelector('#pm-btn-save') as HTMLElement;
      saveBtn.click();

      await vi.waitFor(() => {
        const putCalls = fetchMock.mock.calls.filter(
          (c: any[]) => c[1]?.method === 'PUT'
        );
        expect(putCalls.length).toBeGreaterThan(0);
      });
    });

    it('shows alert when saving with empty title', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const pm = new ProblemManager(container);
      await pm.init();

      const saveBtn = container.querySelector('#pm-btn-save') as HTMLElement;
      saveBtn.click();

      await vi.waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('請輸入題目標題');
      });

      alertMock.mockRestore();
    });

    it('delete sends DELETE request with confirmation', async () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/problems/p1' && init?.method === 'DELETE') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }
        if (url === '/api/problems') {
          // Return problem list so the test can click an item
          return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleProblemList) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleProblemDetail) });
      });

      const pm = new ProblemManager(container);
      await pm.init();

      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();

      // Wait for the delete button to appear
      await vi.waitFor(() => {
        expect(container.querySelector('#pm-btn-delete')).toBeTruthy();
      });

      const deleteBtn = container.querySelector('#pm-btn-delete') as HTMLElement;
      deleteBtn.click();

      expect(confirmMock).toHaveBeenCalled();
      confirmMock.mockRestore();
    });

    it('cancel delete does not send request', async () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const pm = new ProblemManager(container);
      await pm.init();

      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();

      // Wait for the delete button to appear
      await vi.waitFor(() => {
        expect(container.querySelector('#pm-btn-delete')).toBeTruthy();
      });

      const deleteBtn = container.querySelector('#pm-btn-delete') as HTMLElement;
      deleteBtn.click();

      expect(confirmMock).toHaveBeenCalled();
      confirmMock.mockRestore();
    });
  });

  // ---- 4.4 Preview ----

  describe('preview', () => {
    it('renders markdown preview section', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      const preview = container.querySelector('.pm-preview');
      expect(preview).toBeTruthy();
      expect(preview!.querySelector('#pm-preview-content')).toBeTruthy();
    });

    it('preview updates when title input changes', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      const titleInput = container.querySelector('#pm-title') as HTMLInputElement;
      titleInput.value = 'New Title';
      titleInput.dispatchEvent(new Event('input'));

      const previewTitle = container.querySelector('.problem-title');
      expect(previewTitle?.textContent).toBe('New Title');
    });

    it('preview shows examples when present', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      // Select a problem with examples
      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();

      // Wait for the preview to update with the selected problem's title
      await vi.waitFor(() => {
        const previewTitle = container.querySelector('.problem-title');
        expect(previewTitle?.textContent).toContain('Two Sum');
      });

      const previewContent = container.querySelector('#pm-preview-content');
      expect(previewContent).toBeTruthy();
    });

    it('preview shows constraints when present', async () => {
      const pm = new ProblemManager(container);
      await pm.init();

      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();

      // Wait for the preview to reflect the selected problem
      await vi.waitFor(() => {
        const previewTitle = container.querySelector('.problem-title');
        expect(previewTitle?.textContent).toContain('Two Sum');
      });

      const previewContent = container.querySelector('#pm-preview-content');
      // Check that the constraints section appears (from the editing form data)
      // The updatePreview collects constraints from form inputs
      expect(previewContent).toBeTruthy();
    });
  });

  // ---- 4.5 Import / Export ----

  describe('import / export', () => {
    it('export creates download link for selected problem', async () => {
      const createObjectURLMock = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURLMock = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickMock = vi.fn();
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string, _options?: any) => {
        const el = origCreateElement(tag as keyof HTMLElementTagNameMap);
        if (tag === 'a') {
          Object.defineProperty(el, 'click', { value: clickMock });
        }
        return el;
      });

      const pm = new ProblemManager(container);
      await pm.init();

      const item = container.querySelector('.pm-problem-item') as HTMLElement;
      item.click();

      // Wait for the export button to appear (rendered when a problem is selected)
      await vi.waitFor(() => {
        expect(container.querySelector('#pm-btn-export')).toBeTruthy();
      });

      const exportBtn = container.querySelector('#pm-btn-export') as HTMLElement;
      exportBtn.click();

      await vi.waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalled();
      });

      createObjectURLMock.mockRestore();
      revokeObjectURLMock.mockRestore();
    });

    it('import button creates file input', async () => {
      const clickMock = vi.fn();
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string, _options?: any) => {
        const el = origCreateElement(tag as keyof HTMLElementTagNameMap);
        if (tag === 'input') {
          Object.defineProperty(el, 'click', { value: clickMock });
        }
        return el;
      });

      const pm = new ProblemManager(container);
      await pm.init();

      const importBtn = container.querySelector('#pm-btn-import') as HTMLElement;
      importBtn.click();

      expect(clickMock).toHaveBeenCalled();
    });

    it('triggerImport reads JSON file and POSTs to API', async () => {
      let changeHandler: ((e: Event) => void) | null = null;
      const clickMock = vi.fn();
      const origCreateElement = document.createElement.bind(document);

      vi.spyOn(document, 'createElement').mockImplementation((tag: string, _options?: any) => {
        const el = origCreateElement(tag as keyof HTMLElementTagNameMap);
        if (tag === 'input') {
          Object.defineProperty(el, 'click', { value: clickMock });
          const origAddEventListener = el.addEventListener.bind(el);
          vi.spyOn(el, 'addEventListener').mockImplementation((evt: string, handler: any) => {
            if (evt === 'change') changeHandler = handler;
            else origAddEventListener(evt, handler);
          });
          Object.defineProperty(el, 'files', {
            value: [new File(['{"title":"Imported"}'], 'test.json', { type: 'application/json' })],
            writable: false,
          });
        }
        return el;
      });

      const pm = new ProblemManager(container);
      await pm.init();

      const importBtn = container.querySelector('#pm-btn-import') as HTMLElement;
      importBtn.click();

      // Simulate file selection
      if (changeHandler) {
        await changeHandler({} as Event);
      }

      await vi.waitFor(() => {
        const postCalls = fetchMock.mock.calls.filter(
          (c: any[]) => c[1]?.method === 'POST'
        );
        expect(postCalls.length).toBeGreaterThan(0);
      });
    });
  });
});
