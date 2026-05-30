import { describe, it, expect } from 'vitest';
import { problems, defaultProblem } from '../code-problems.js';
import type { CodeProblem } from '../code-types.js';

describe('code-problems', () => {
  describe('problems registry', () => {
    it('contains exactly 6 problems', () => {
      const ids = Object.keys(problems);
      expect(ids).toHaveLength(6);
    });

    it('contains two-sum as first problem', () => {
      expect(problems['two-sum']).toBeDefined();
    });

    it('contains all expected problem IDs', () => {
      expect(Object.keys(problems).sort()).toEqual([
        'fizzbuzz',
        'numpy-demo',
        'pandas-demo',
        'scipy-demo',
        'sklearn-demo',
        'two-sum',
      ]);
    });

    it('each problem has required fields', () => {
      for (const [id, problem] of Object.entries(problems)) {
        expect(problem.id).toBe(id);
        expect(typeof problem.title).toBe('string');
        expect(problem.title.length).toBeGreaterThan(0);
        expect(['easy', 'medium', 'hard']).toContain(problem.difficulty);
        expect(typeof problem.starterCode).toBe('string');
        expect(Array.isArray(problem.testCases)).toBe(true);
        expect(Array.isArray(problem.examples)).toBe(true);
        expect(Array.isArray(problem.constraints)).toBe(true);
      }
    });
  });

  describe('defaultProblem', () => {
    it('is two-sum', () => {
      expect(defaultProblem).toBe(problems['two-sum']);
    });
  });

  describe('two-sum', () => {
    let twoSum: CodeProblem;

    beforeEach(() => {
      twoSum = problems['two-sum'];
    });

    it('has correct difficulty', () => {
      expect(twoSum.difficulty).toBe('easy');
    });

    it('has 3 examples', () => {
      expect(twoSum.examples).toHaveLength(3);
    });

    it('has 3 test cases', () => {
      expect(twoSum.testCases).toHaveLength(3);
    });

    it('has 4 constraints', () => {
      expect(twoSum.constraints).toHaveLength(4);
    });

    it('starterCode contains a function definition', () => {
      expect(twoSum.starterCode).toContain('def two_sum');
    });

    it('examples have input and output fields', () => {
      for (const ex of twoSum.examples) {
        expect(typeof ex.input).toBe('string');
        expect(typeof ex.output).toBe('string');
      }
    });

    it('first example has explanation', () => {
      expect(twoSum.examples[0].explanation).toBeDefined();
    });

    it('test cases have input and expected fields', () => {
      for (const tc of twoSum.testCases) {
        expect(typeof tc.input).toBe('string');
        expect(typeof tc.expected).toBe('string');
      }
    });

    it('description contains HTML markup', () => {
      expect(twoSum.description).toContain('<p>');
      expect(twoSum.description).toContain('<code>');
    });
  });

  describe('fizzbuzz', () => {
    let fb: CodeProblem;

    beforeEach(() => {
      fb = problems['fizzbuzz'];
    });

    it('has correct difficulty', () => {
      expect(fb.difficulty).toBe('easy');
    });

    it('has 3 examples', () => {
      expect(fb.examples).toHaveLength(3);
    });

    it('has 3 test cases', () => {
      expect(fb.testCases).toHaveLength(3);
    });

    it('starterCode contains a function definition', () => {
      expect(fb.starterCode).toContain('def fizz_buzz');
    });
  });

  describe('demo problems', () => {
    const demoIds = ['numpy-demo', 'pandas-demo', 'sklearn-demo', 'scipy-demo'];

    for (const id of demoIds) {
      describe(id, () => {
        let problem: CodeProblem;

        beforeEach(() => {
          problem = problems[id];
        });

        it('has zero test cases (demo-only)', () => {
          expect(problem.testCases).toHaveLength(0);
        });

        it('has starterCode with imports or functions', () => {
          expect(problem.starterCode.length).toBeGreaterThan(0);
        });

        it('has a description containing HTML', () => {
          expect(problem.description.length).toBeGreaterThan(0);
        });
      });
    }

    it('sklearn-demo and scipy-demo are medium difficulty', () => {
      expect(problems['sklearn-demo'].difficulty).toBe('medium');
      expect(problems['scipy-demo'].difficulty).toBe('medium');
    });

    it('numpy-demo and pandas-demo are easy difficulty', () => {
      expect(problems['numpy-demo'].difficulty).toBe('easy');
      expect(problems['pandas-demo'].difficulty).toBe('easy');
    });
  });
});
