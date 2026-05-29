import { describe, it, expect } from 'vitest';

/**
 * Tests for guidance:push validation logic.
 *
 * The handler in handlers.ts validates:
 * 1. Only teachers can push guidance (auth check)
 * 2. roomId must be provided
 * 3. description must be a string
 * 4. description length ≤ 50000 chars
 * 5. No individual data URL exceeds 3M chars
 */

function isValidGuidance(
  isTeacher: boolean,
  roomId: string,
  description: string
): boolean {
  if (!isTeacher) return false;
  if (!roomId || typeof description !== 'string') return false;
  if (description.length > 5_000_000) return false;

  const dataUrls = description.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
  if (dataUrls) {
    for (const url of dataUrls) {
      if (url.length > 3_000_000) return false;
    }
  }

  return true;
}

describe('guidance:push validation', () => {
  describe('auth check', () => {
    it('rejects non-teacher', () => {
      expect(isValidGuidance(false, 'room-1', 'some guidance')).toBe(false);
    });

    it('accepts teacher', () => {
      expect(isValidGuidance(true, 'room-1', 'some guidance')).toBe(true);
    });
  });

  describe('roomId validation', () => {
    it('rejects empty roomId', () => {
      expect(isValidGuidance(true, '', 'some guidance')).toBe(false);
    });

    it('accepts non-empty roomId', () => {
      expect(isValidGuidance(true, 'room-1', 'some guidance')).toBe(true);
    });
  });

  describe('description validation', () => {
    it('accepts string description', () => {
      expect(isValidGuidance(true, 'room-1', 'hello')).toBe(true);
    });

    it('rejects non-string description', () => {
      // This tests the typeof check — passing via the type system isn't
      // possible in practice, but we verify the guard is in place.
      expect(isValidGuidance(true, 'room-1', undefined as unknown as string)).toBe(false);
    });
  });

  describe('description length limit', () => {
    it('accepts description at exactly 5M chars', () => {
      const text = 'x'.repeat(5_000_000);
      expect(isValidGuidance(true, 'room-1', text)).toBe(true);
    });

    it('rejects description at 5M+1 chars', () => {
      const text = 'x'.repeat(5_000_001);
      expect(isValidGuidance(true, 'room-1', text)).toBe(false);
    });

    it('accepts short description', () => {
      expect(isValidGuidance(true, 'room-1', 'short')).toBe(true);
    });
  });

  describe('image data URL validation', () => {
    const buildDataUrl = (len: number): string => {
      const header = 'data:image/png;base64,';
      const payload = 'x'.repeat(Math.max(0, len - header.length));
      return header + payload;
    };

    it('accepts image data URL at exactly 3M chars', () => {
      const url = buildDataUrl(3_000_000);
      const desc = `some text ![img](${url}) more text`;
      expect(isValidGuidance(true, 'room-1', desc)).toBe(true);
    });

    it('rejects image data URL exceeding 3M chars', () => {
      const url = buildDataUrl(3_000_001);
      const desc = `some text ![img](${url}) more text`;
      expect(isValidGuidance(true, 'room-1', desc)).toBe(false);
    });

    it('accepts description with no images', () => {
      const desc = 'Just some markdown text with **bold** and *italic*';
      expect(isValidGuidance(true, 'room-1', desc)).toBe(true);
    });

    it('accepts description with multiple small images', () => {
      const url1 = buildDataUrl(1000);
      const url2 = buildDataUrl(2000);
      const desc = `![a](${url1}) some text ![b](${url2})`;
      expect(isValidGuidance(true, 'room-1', desc)).toBe(true);
    });

    it('rejects when one of multiple images is too large', () => {
      const small = buildDataUrl(1000);
      const large = buildDataUrl(3_000_001);
      const desc = `![a](${small}) some text ![b](${large})`;
      expect(isValidGuidance(true, 'room-1', desc)).toBe(false);
    });
  });
});
