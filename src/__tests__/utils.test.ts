import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  groupBy,
  isAdvanced,
  isString,
  formatDate,
  concatUrl,
  formatExperienceDate,
  getSkillLevel,
} from '../utils.js';
import type { Skill, Experience } from '../types.js';

describe('groupBy', () => {
  it('groups items by a key', () => {
    const items = [
      { name: 'a', category: 'x' },
      { name: 'b', category: 'y' },
      { name: 'c', category: 'x' },
    ];
    const result = groupBy(items, 'category');
    expect(result).toEqual({
      x: [
        { name: 'a', category: 'x' },
        { name: 'c', category: 'x' },
      ],
      y: [{ name: 'b', category: 'y' }],
    });
  });

  it('returns empty object for empty array', () => {
    const result = groupBy([], 'name' as any);
    expect(result).toEqual({});
  });

  it('groups by numeric key converted to string', () => {
    const items = [
      { id: 1, val: 'a' },
      { id: 1, val: 'b' },
      { id: 2, val: 'c' },
    ];
    const result = groupBy(items, 'id');
    expect(result['1']).toHaveLength(2);
    expect(result['2']).toHaveLength(1);
  });

  it('handles single item', () => {
    const items = [{ name: 'only', group: 'g1' }];
    const result = groupBy(items, 'group');
    expect(result).toEqual({
      g1: [{ name: 'only', group: 'g1' }],
    });
  });

  it('handles duplicate group keys', () => {
    const items = [
      { k: 'same', v: 1 },
      { k: 'same', v: 2 },
      { k: 'same', v: 3 },
    ];
    const result = groupBy(items, 'k');
    expect(result.same).toHaveLength(3);
  });
});

describe('isAdvanced', () => {
  it('returns true for advanced proficiency', () => {
    const skill: Skill = { name: 'React', proficiency: 'advanced' };
    expect(isAdvanced(skill)).toBe(true);
  });

  it('returns true for expert proficiency', () => {
    const skill: Skill = { name: 'TS', proficiency: 'expert' };
    expect(isAdvanced(skill)).toBe(true);
  });

  it('returns false for intermediate proficiency', () => {
    const skill: Skill = { name: 'Vue', proficiency: 'intermediate' };
    expect(isAdvanced(skill)).toBe(false);
  });

  it('returns false for beginner proficiency', () => {
    const skill: Skill = { name: 'Docker', proficiency: 'beginner' };
    expect(isAdvanced(skill)).toBe(false);
  });
});

describe('isString', () => {
  it('returns true for string values', () => {
    expect(isString('hello')).toBe(true);
    expect(isString('')).toBe(true);
  });

  it('returns false for numbers', () => {
    expect(isString(42)).toBe(false);
    expect(isString(0)).toBe(false);
  });

  it('returns false for objects', () => {
    expect(isString({})).toBe(false);
    expect(isString([])).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
  });

  it('returns false for booleans', () => {
    expect(isString(true)).toBe(false);
    expect(isString(false)).toBe(false);
  });
});

describe('formatDate', () => {
  it('formats a date string with Chinese locale', () => {
    const result = formatDate('2023-03');
    expect(result).toBe('2023年 3月');
  });

  it('formats January correctly', () => {
    const result = formatDate('2024-01');
    expect(result).toBe('2024年 1月');
  });

  it('formats December correctly', () => {
    const result = formatDate('2024-12');
    expect(result).toBe('2024年 12月');
  });

  it('works with default locale parameter', () => {
    // locale parameter exists but month names are hardcoded in Chinese
    const result = formatDate('2020-06', 'en-US');
    expect(result).toBe('2020年 6月');
  });
});

describe('concatUrl', () => {
  it('joins base with paths using slashes', () => {
    const result = concatUrl('http://example.com', 'api', 'v1', 'users');
    expect(result).toBe('http://example.com/api/v1/users');
  });

  it('handles single path', () => {
    const result = concatUrl('http://example.com', 'api');
    expect(result).toBe('http://example.com/api');
  });

  it('handles no additional paths', () => {
    const result = concatUrl('http://example.com');
    expect(result).toBe('http://example.com');
  });

  it('deduplicates consecutive slashes', () => {
    const result = concatUrl('http://example.com/', '/api/', '/v1');
    expect(result).toBe('http://example.com/api/v1');
  });

  it('preserves double slash after protocol', () => {
    const result = concatUrl('http://example.com', 'path');
    expect(result).toBe('http://example.com/path');
  });
});

describe('formatExperienceDate', () => {
  it('formats with an Experience object (overload 1)', () => {
    const exp: Experience = {
      company: 'TestCo',
      role: 'Dev',
      startDate: '2021-07',
      endDate: '2023-02',
      description: 'desc',
      highlights: ['h1'],
    };
    const result = formatExperienceDate(exp);
    expect(result).toBe('2021年 7月 — 2023年 2月');
  });

  it('formats with ongoing experience (no endDate)', () => {
    const exp: Experience = {
      company: 'TestCo',
      role: 'Dev',
      startDate: '2023-03',
      description: 'desc',
      highlights: [],
    };
    const result = formatExperienceDate(exp);
    expect(result).toBe('2023年 3月 — 至今');
  });

  it('formats with string parameters (overload 2)', () => {
    const result = formatExperienceDate('2020-01', '2021-12');
    expect(result).toBe('2020年 1月 — 2021年 12月');
  });

  it('formats with string start only', () => {
    const result = formatExperienceDate('2023-06');
    expect(result).toBe('2023年 6月 — 至今');
  });
});

describe('getSkillLevel', () => {
  it('returns 未知 when years is undefined', () => {
    expect(getSkillLevel()).toBe('未知');
    expect(getSkillLevel(undefined)).toBe('未知');
  });

  it('returns 入门 for less than 1 year', () => {
    expect(getSkillLevel(0)).toBe('入门');
    expect(getSkillLevel(0.5)).toBe('入门');
  });

  it('returns 熟练 for 1-2 years', () => {
    expect(getSkillLevel(1)).toBe('熟练');
    expect(getSkillLevel(2.9)).toBe('熟练');
  });

  it('returns 精通 for 3-4 years', () => {
    expect(getSkillLevel(3)).toBe('精通');
    expect(getSkillLevel(4.9)).toBe('精通');
  });

  it('returns 专家 for 5+ years', () => {
    expect(getSkillLevel(5)).toBe('专家');
    expect(getSkillLevel(10)).toBe('专家');
  });
});
