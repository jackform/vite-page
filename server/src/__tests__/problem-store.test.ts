/**
 * Unit tests for problem-store.ts CRUD operations.
 *
 * The module resolves its data directory at import time via findBestDataDir().
 * We test against the real data directory but verify behavior that works
 * regardless of existing state (null checks, creation flow, delete flow).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  listProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  hasProblem,
} from '../problem-store.js';
import type { Problem } from '../problem-store.js';

describe('getProblem', () => {
  it('returns null for non-existent problem', () => {
    expect(getProblem('__nonexistent_test_id__')).toBeNull();
  });

  it('returns null for empty string id', () => {
    expect(getProblem('')).toBeNull();
  });
});

describe('hasProblem', () => {
  it('returns false for non-existent problem', () => {
    expect(hasProblem('__nonexistent_test_id__')).toBe(false);
  });
});

describe('updateProblem', () => {
  it('returns null for non-existent problem', () => {
    expect(updateProblem('__nonexistent_test_id__', { title: 'x' })).toBeNull();
  });
});

describe('deleteProblem', () => {
  it('returns false for non-existent problem', () => {
    expect(deleteProblem('__nonexistent_test_id__')).toBe(false);
  });
});

describe('createProblem', () => {
  const testId = `__vitest_test_${Date.now()}`;

  afterAll(() => {
    // Clean up
    if (hasProblem(testId)) {
      deleteProblem(testId);
    }
  });

  it('creates a problem with all required fields', () => {
    const problem: Problem = {
      id: testId,
      title: 'Vitest Test Problem',
      difficulty: 'easy',
      category: 'testing',
      tags: ['vitest', 'test'],
      description: 'A test problem created by vitest.',
      examples: [{ input: '1', output: '1' }],
      constraints: ['n >= 1'],
      starterCode: 'def solve():\n    return 42\n',
      testCases: [{ input: '1', expected: '42' }],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
    };

    const created = createProblem(problem);
    expect(created.id).toBe(testId);
    expect(created.title).toBe('Vitest Test Problem');
    expect(created.difficulty).toBe('easy');
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
    expect(created.category).toBe('testing');
    expect(created.tags).toEqual(['vitest', 'test']);
  });

  it('created problem is retrievable', () => {
    const retrieved = getProblem(testId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(testId);
    expect(retrieved!.title).toBe('Vitest Test Problem');
    expect(retrieved!.examples).toHaveLength(1);
    expect(retrieved!.testCases).toHaveLength(1);
  });

  it('created problem appears in list', () => {
    const all = listProblems();
    const found = all.find((p) => p.id === testId);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Vitest Test Problem');
    expect(found!.difficulty).toBe('easy');
  });
});

describe('updateProblem (on real data)', () => {
  const testId = `__vitest_update_${Date.now()}`;

  beforeAll(() => {
    const problem: Problem = {
      id: testId,
      title: 'Original Title',
      difficulty: 'easy',
      category: 'testing',
      tags: ['original'],
      description: 'Original description.',
      examples: [],
      constraints: [],
      starterCode: 'pass',
      testCases: [],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
    };
    createProblem(problem);
  });

  afterAll(() => {
    if (hasProblem(testId)) {
      deleteProblem(testId);
    }
  });

  it('updates title and difficulty', () => {
    const updated = updateProblem(testId, {
      title: 'Updated Title',
      difficulty: 'hard',
    });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated Title');
    expect(updated!.difficulty).toBe('hard');
  });

  it('preserves unmodified fields', () => {
    const retrieved = getProblem(testId);
    expect(retrieved!.description).toBe('Original description.');
    expect(retrieved!.tags).toEqual(['original']);
    expect(retrieved!.category).toBe('testing');
  });

  it('updated problem reflects in list', () => {
    const all = listProblems();
    const found = all.find((p) => p.id === testId);
    expect(found!.title).toBe('Updated Title');
    expect(found!.difficulty).toBe('hard');
  });
});

describe('hasProblem integration', () => {
  const testId = `__vitest_has_${Date.now()}`;

  afterAll(() => {
    if (hasProblem(testId)) {
      deleteProblem(testId);
    }
  });

  it('returns false before creation', () => {
    expect(hasProblem(testId)).toBe(false);
  });

  it('returns true after creation', () => {
    createProblem({
      id: testId,
      title: 'Has Test',
      difficulty: 'easy',
      category: 'test',
      tags: [],
      description: 'test',
      examples: [],
      constraints: [],
      starterCode: 'pass',
      testCases: [],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
    });
    expect(hasProblem(testId)).toBe(true);
  });

  it('returns false after deletion', () => {
    deleteProblem(testId);
    expect(hasProblem(testId)).toBe(false);
  });
});

describe('listProblems', () => {
  it('returns an array', () => {
    expect(Array.isArray(listProblems())).toBe(true);
  });

  it('each problem has required metadata fields', () => {
    const all = listProblems();
    for (const p of all) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.title).toBe('string');
      expect(['easy', 'medium', 'hard']).toContain(p.difficulty);
      expect(typeof p.file).toBe('string');
      expect(p.file).toContain('.json');
    }
  });
});

describe('engine field', () => {
  const testId = `__vitest_engine_${Date.now()}`;

  afterAll(() => {
    if (hasProblem(testId)) {
      deleteProblem(testId);
    }
  });

  it('createProblem defaults engine to pyodide when not specified', () => {
    const problem: Problem = {
      id: testId,
      title: 'Engine Default Test',
      difficulty: 'easy',
      category: 'testing',
      tags: [],
      description: 'Testing engine default.',
      examples: [],
      constraints: [],
      starterCode: 'pass',
      testCases: [],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
    };

    const created = createProblem(problem);
    // Index metadata should default engine to 'pyodide'
    const all = listProblems();
    const found = all.find((p) => p.id === testId);
    expect(found).toBeDefined();
    expect(found!.engine).toBe('pyodide');
  });

  it('createProblem preserves custom engine in index metadata', () => {
    const customId = `${testId}-skulpt`;
    // Clean up at the end
    const cleanup = () => {
      if (hasProblem(customId)) deleteProblem(customId);
    };

    const problem: Problem = {
      id: customId,
      title: 'Skulpt Engine Test',
      difficulty: 'easy',
      category: 'testing',
      tags: [],
      description: 'Testing skulpt engine.',
      examples: [],
      constraints: [],
      starterCode: 'import turtle',
      testCases: [],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
      // Simulate engine field being sent from frontend
      engine: 'skulpt' as any,
    } as Problem;

    try {
      const created = createProblem(problem);
      const all = listProblems();
      const found = all.find((p) => p.id === customId);
      expect(found).toBeDefined();
      expect(found!.engine).toBe('skulpt');
    } finally {
      cleanup();
    }
  });

  it('createProblem preserves pyodide-widget engine in index metadata', () => {
    const customId = `${testId}-widget`;
    const cleanup = () => {
      if (hasProblem(customId)) deleteProblem(customId);
    };

    const problem: Problem = {
      id: customId,
      title: 'Widget Engine Test',
      difficulty: 'easy',
      category: 'testing',
      tags: [],
      description: 'Testing widget engine.',
      examples: [],
      constraints: [],
      starterCode: 'from tkinter import *',
      testCases: [],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
      engine: 'pyodide-widget' as any,
    } as Problem;

    try {
      createProblem(problem);
      const all = listProblems();
      const found = all.find((p) => p.id === customId);
      expect(found).toBeDefined();
      expect(found!.engine).toBe('pyodide-widget');
    } finally {
      cleanup();
    }
  });

  it('updateProblem preserves existing engine when not in updates', () => {
    const customId = `${testId}-update-preserve`;
    const cleanup = () => {
      if (hasProblem(customId)) deleteProblem(customId);
    };

    const problem: Problem = {
      id: customId,
      title: 'Preserve Engine',
      difficulty: 'easy',
      category: 'testing',
      tags: [],
      description: 'Testing engine preservation.',
      examples: [],
      constraints: [],
      starterCode: 'pass',
      testCases: [],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
      engine: 'skulpt' as any,
    } as Problem;

    try {
      createProblem(problem);
      // Update only title, don't touch engine
      updateProblem(customId, { title: 'Preserved Engine Title' });

      const all = listProblems();
      const found = all.find((p) => p.id === customId);
      expect(found).toBeDefined();
      expect(found!.title).toBe('Preserved Engine Title');
      expect(found!.engine).toBe('skulpt');
    } finally {
      cleanup();
    }
  });

  it('full problem detail from getProblem includes engine field', () => {
    const customId = `${testId}-get-detail`;
    const cleanup = () => {
      if (hasProblem(customId)) deleteProblem(customId);
    };

    const problem: Problem = {
      id: customId,
      title: 'Get Detail Engine',
      difficulty: 'easy',
      category: 'testing',
      tags: [],
      description: 'Testing getProblem includes engine.',
      examples: [],
      constraints: [],
      starterCode: 'pass',
      testCases: [],
      author: 'vitest',
      file: '',
      createdAt: '',
      updatedAt: '',
      engine: 'skulpt' as any,
    } as Problem;

    try {
      createProblem(problem);
      const detail = getProblem(customId);
      expect(detail).not.toBeNull();
      // The full problem detail file should include the engine field
      expect((detail as any).engine).toBe('skulpt');
    } finally {
      cleanup();
    }
  });
});
