/**
 * Unit tests for problem-store.ts CRUD operations.
 *
 * The module resolves its data directory at import time via findBestDataDir().
 * We test against the real data directory but verify behavior that works
 * regardless of existing state (null checks, creation flow, delete flow).
 */

import { describe, it, expect } from 'vitest';
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
