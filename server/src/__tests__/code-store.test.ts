import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as codeStore from '../code-store.js';

const testStudentId = 'test-code-store';
const testProblemId = 'problem-1';
const testProblemId2 = 'problem-2';

describe('code-store', () => {
  beforeEach(() => {
    // Clean up test data
    codeStore.deleteCode(testStudentId, testProblemId);
    codeStore.deleteCode(testStudentId, testProblemId2);
  });

  afterEach(() => {
    codeStore.deleteCode(testStudentId, testProblemId);
    codeStore.deleteCode(testStudentId, testProblemId2);
  });

  describe('saveCode / getCode', () => {
    it('saves and retrieves code for a student+problem', () => {
      const saved = codeStore.saveCode(testStudentId, testProblemId, 'print("hello")');
      expect(saved.studentId).toBe(testStudentId);
      expect(saved.problemId).toBe(testProblemId);
      expect(saved.code).toBe('print("hello")');
      expect(saved.savedAt).toBeDefined();

      const retrieved = codeStore.getCode(testStudentId, testProblemId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.code).toBe('print("hello")');
    });

    it('returns null for non-existent code', () => {
      const result = codeStore.getCode(testStudentId, 'nonexistent');
      expect(result).toBeNull();
    });

    it('overwrites existing saved code', () => {
      codeStore.saveCode(testStudentId, testProblemId, 'first version');
      codeStore.saveCode(testStudentId, testProblemId, 'second version');

      const result = codeStore.getCode(testStudentId, testProblemId);
      expect(result!.code).toBe('second version');
    });
  });

  describe('deleteCode', () => {
    it('returns false for non-existent code', () => {
      expect(codeStore.deleteCode(testStudentId, testProblemId)).toBe(false);
    });

    it('deletes existing saved code', () => {
      codeStore.saveCode(testStudentId, testProblemId, 'delete me');
      expect(codeStore.deleteCode(testStudentId, testProblemId)).toBe(true);
      expect(codeStore.getCode(testStudentId, testProblemId)).toBeNull();
    });
  });

  describe('listCodes', () => {
    it('returns empty array for student with no saved code', () => {
      const list = codeStore.listCodes(testStudentId);
      expect(list).toEqual([]);
    });

    it('returns problem IDs for saved code', () => {
      codeStore.saveCode(testStudentId, testProblemId, 'code 1');
      codeStore.saveCode(testStudentId, testProblemId2, 'code 2');

      const list = codeStore.listCodes(testStudentId);
      expect(list).toContain(testProblemId);
      expect(list).toContain(testProblemId2);
    });
  });

  describe('creates directories on demand', () => {
    it('creates the code directory when saving for a new student', () => {
      const uniqueId = `test-new-student-${Date.now()}`;
      try {
        const saved = codeStore.saveCode(uniqueId, testProblemId, 'new student code');
        expect(saved.code).toBe('new student code');
        const retrieved = codeStore.getCode(uniqueId, testProblemId);
        expect(retrieved).not.toBeNull();
      } finally {
        codeStore.deleteCode(uniqueId, testProblemId);
      }
    });
  });
});
