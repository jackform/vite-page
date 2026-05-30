/**
 * Unit tests for server/src/auth.ts — teacher password validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to control process.env.TEACHER_PASSWORD before importing
// the auth module, since it reads the env at import time.

const originalEnv = { ...process.env };

describe('validateTeacherPassword', () => {
  let validateTeacherPassword: (password: string) => boolean;

  beforeEach(async () => {
    // Reset modules so auth.ts is re-imported with fresh env
    vi.resetModules();
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('when TEACHER_PASSWORD is not set', () => {
    beforeEach(async () => {
      delete process.env.TEACHER_PASSWORD;
      const auth = await import('../auth.js');
      validateTeacherPassword = auth.validateTeacherPassword;
    });

    it('accepts any password', () => {
      expect(validateTeacherPassword('anything')).toBe(true);
    });

    it('accepts empty password', () => {
      expect(validateTeacherPassword('')).toBe(true);
    });

    it('accepts undefined-like strings', () => {
      expect(validateTeacherPassword('undefined')).toBe(true);
    });
  });

  describe('when TEACHER_PASSWORD is set', () => {
    const correctPassword = 'secret123';

    beforeEach(async () => {
      process.env.TEACHER_PASSWORD = correctPassword;
      const auth = await import('../auth.js');
      validateTeacherPassword = auth.validateTeacherPassword;
    });

    it('returns true for correct password', () => {
      expect(validateTeacherPassword(correctPassword)).toBe(true);
    });

    it('returns false for wrong password', () => {
      expect(validateTeacherPassword('wrong_password')).toBe(false);
    });

    it('returns false for empty password', () => {
      expect(validateTeacherPassword('')).toBe(false);
    });

    it('returns false for case-different password', () => {
      expect(validateTeacherPassword('SECRET123')).toBe(false);
    });

    it('returns false for password with extra characters', () => {
      expect(validateTeacherPassword(correctPassword + 'x')).toBe(false);
    });

    it('returns false for password with fewer characters', () => {
      expect(validateTeacherPassword(correctPassword.slice(0, -1))).toBe(false);
    });

    it('handles special characters in password', async () => {
      const specialPwd = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      vi.resetModules();
      process.env.TEACHER_PASSWORD = specialPwd;
      const auth = await import('../auth.js');
      const fn = auth.validateTeacherPassword;
      expect(fn(specialPwd)).toBe(true);
      expect(fn('wrong')).toBe(false);
    });

    it('handles unicode characters', async () => {
      const unicodePwd = '密码123!@#';
      vi.resetModules();
      process.env.TEACHER_PASSWORD = unicodePwd;
      const auth = await import('../auth.js');
      const fn = auth.validateTeacherPassword;
      expect(fn(unicodePwd)).toBe(true);
      expect(fn('wrong密码')).toBe(false);
    });

    it('handles very long passwords', async () => {
      const longPwd = 'a'.repeat(1000);
      vi.resetModules();
      process.env.TEACHER_PASSWORD = longPwd;
      const auth = await import('../auth.js');
      const fn = auth.validateTeacherPassword;
      expect(fn(longPwd)).toBe(true);
    });
  });
});
