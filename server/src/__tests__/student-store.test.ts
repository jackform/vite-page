import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as studentStore from '../student-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use a temp directory for tests to avoid polluting real data
const testDataDir = path.resolve(__dirname, '..', '..', 'data', 'students');

describe('student-store', () => {
  const testId = '99999999';
  const testId2 = '88888888';

  beforeEach(() => {
    // Clean up test data before each test
    const file1 = path.join(testDataDir, `${testId}.json`);
    const file2 = path.join(testDataDir, `${testId2}.json`);
    if (fs.existsSync(file1)) fs.unlinkSync(file1);
    if (fs.existsSync(file2)) fs.unlinkSync(file2);

    // Remove from index
    const indexFile = path.join(testDataDir, 'index.json');
    if (fs.existsSync(indexFile)) {
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      index.students = index.students.filter((s: string) => s !== testId && s !== testId2);
      fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf-8');
    }
  });

  afterEach(() => {
    // Clean up after each test
    const file1 = path.join(testDataDir, `${testId}.json`);
    const file2 = path.join(testDataDir, `${testId2}.json`);
    if (fs.existsSync(file1)) fs.unlinkSync(file1);
    if (fs.existsSync(file2)) fs.unlinkSync(file2);

    const indexFile = path.join(testDataDir, 'index.json');
    if (fs.existsSync(indexFile)) {
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      index.students = index.students.filter((s: string) => s !== testId && s !== testId2);
      fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf-8');
    }
  });

  describe('hasStudent', () => {
    it('returns false for non-existent student', () => {
      expect(studentStore.hasStudent(testId)).toBe(false);
    });

    it('returns true after creating a student', () => {
      studentStore.createStudent({ studentId: testId, name: 'Test Student', pin: '1234' });
      expect(studentStore.hasStudent(testId)).toBe(true);
    });
  });

  describe('createStudent', () => {
    it('creates a student account with hashed PIN', () => {
      const account = studentStore.createStudent({
        studentId: testId,
        name: '陳小明',
        pin: '5678',
      });

      expect(account.studentId).toBe(testId);
      expect(account.name).toBe('陳小明');
      expect(account.pinHash).not.toBeNull();
      expect(account.pinHash).not.toBe('5678'); // should be hashed
      expect(account.createdAt).toBeDefined();
    });

    it('creates a student account without PIN (teacher pre-registration)', () => {
      const account = studentStore.createStudent({
        studentId: testId,
        name: '張三',
      });

      expect(account.studentId).toBe(testId);
      expect(account.name).toBe('張三');
      expect(account.pinHash).toBeNull();
    });

    it('adds studentId to the index', () => {
      studentStore.createStudent({ studentId: testId, name: 'Test', pin: '1111' });
      const list = studentStore.listStudents();
      expect(list).toContain(testId);
    });

    it('does not duplicate studentId in index', () => {
      studentStore.createStudent({ studentId: testId, name: 'First', pin: '1111' });
      studentStore.createStudent({ studentId: testId, name: 'Second', pin: '2222' });
      const list = studentStore.listStudents();
      const occurrences = list.filter((s) => s === testId).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('getStudent', () => {
    it('returns null for non-existent student', () => {
      expect(studentStore.getStudent(testId)).toBeNull();
    });

    it('returns the stored account', () => {
      studentStore.createStudent({ studentId: testId, name: '李四', pin: '9999' });
      const account = studentStore.getStudent(testId);
      expect(account).not.toBeNull();
      expect(account!.studentId).toBe(testId);
      expect(account!.name).toBe('李四');
      expect(account!.pinHash).not.toBeNull();
    });
  });

  describe('verifyPin', () => {
    it('returns false when student does not exist', () => {
      expect(studentStore.verifyPin(testId, '1234')).toBe(false);
    });

    it('returns false when student has no PIN set', () => {
      studentStore.createStudent({ studentId: testId, name: 'No PIN' });
      expect(studentStore.verifyPin(testId, '1234')).toBe(false);
    });

    it('returns true for correct PIN', () => {
      studentStore.createStudent({ studentId: testId, name: 'Test', pin: '1234' });
      expect(studentStore.verifyPin(testId, '1234')).toBe(true);
    });

    it('returns false for incorrect PIN', () => {
      studentStore.createStudent({ studentId: testId, name: 'Test', pin: '1234' });
      expect(studentStore.verifyPin(testId, '9999')).toBe(false);
    });

    it('returns false for empty PIN', () => {
      studentStore.createStudent({ studentId: testId, name: 'Test', pin: '1234' });
      expect(studentStore.verifyPin(testId, '')).toBe(false);
    });
  });

  describe('setPin', () => {
    it('sets PIN for a student who had no PIN', () => {
      studentStore.createStudent({ studentId: testId, name: 'No PIN' });
      const updated = studentStore.setPin(testId, '5555');
      expect(updated).not.toBeNull();
      expect(updated!.pinHash).not.toBeNull();
      expect(studentStore.verifyPin(testId, '5555')).toBe(true);
    });

    it('changes PIN for a student who had a PIN', () => {
      studentStore.createStudent({ studentId: testId, name: 'Test', pin: '1234' });
      studentStore.setPin(testId, '9999');
      expect(studentStore.verifyPin(testId, '1234')).toBe(false);
      expect(studentStore.verifyPin(testId, '9999')).toBe(true);
    });

    it('returns null for non-existent student', () => {
      expect(studentStore.setPin(testId, '1234')).toBeNull();
    });
  });

  describe('deleteStudent', () => {
    it('returns false for non-existent student', () => {
      expect(studentStore.deleteStudent(testId)).toBe(false);
    });

    it('deletes an existing student', () => {
      studentStore.createStudent({ studentId: testId, name: 'Delete Me', pin: '0000' });
      expect(studentStore.hasStudent(testId)).toBe(true);
      expect(studentStore.deleteStudent(testId)).toBe(true);
      expect(studentStore.hasStudent(testId)).toBe(false);
    });

    it('removes student from index', () => {
      studentStore.createStudent({ studentId: testId, name: 'Index Test', pin: '1111' });
      studentStore.deleteStudent(testId);
      const list = studentStore.listStudents();
      expect(list).not.toContain(testId);
    });
  });

  describe('listStudents', () => {
    it('returns an array of student IDs', () => {
      studentStore.createStudent({ studentId: testId, name: 'A', pin: '1111' });
      studentStore.createStudent({ studentId: testId2, name: 'B', pin: '2222' });
      const list = studentStore.listStudents();
      expect(Array.isArray(list)).toBe(true);
      expect(list).toContain(testId);
      expect(list).toContain(testId2);
    });
  });
});
