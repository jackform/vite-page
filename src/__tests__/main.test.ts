/**
 * @vitest-environment jsdom
 *
 * Tests for main.ts page rendering.
 * Mocks fetchPerson to return test data synchronously,
 * then tests the rendered DOM output.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

const testPerson = {
  id: 'test_001',
  name: '测试用户',
  title: '前端工程师 · 热爱开源',
  bio: '这是一个测试用户的个人简介。',
  skills: [
    { name: 'TypeScript', proficiency: 'advanced' as const, years: 3 },
    { name: 'React', proficiency: 'intermediate' as const, years: 2 },
  ],
  experience: [
    {
      company: '测试公司',
      role: '高级开发',
      startDate: '2023-01',
      description: '开发工作描述。',
      highlights: ['完成项目A', '产出项目B'],
    },
  ],
  education: [
    {
      school: '测试大学',
      degree: '本科',
      field: '计算机科学',
      startYear: 2019,
      endYear: 2023,
    },
  ],
  socialLinks: [
    { platform: 'GitHub', url: 'https://github.com/test', icon: '🐙' },
  ],
};

// Mock utils module — replace fetchPerson only, keep everything else real
vi.mock('../utils.js', async () => {
  const actual = await vi.importActual<typeof import('../utils.js')>('../utils.js');
  return {
    ...actual,
    fetchPerson: vi.fn().mockResolvedValue(testPerson),
  };
});

let html = '';

beforeAll(async () => {
  // Create app element before import (module captures it at load time)
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);

  // Import the module — sets up DOMContentLoaded listener
  await import('../main.js');

  // Trigger the init flow
  document.dispatchEvent(new Event('DOMContentLoaded'));

  // Wait for async init (fetchPerson is mocked to resolve immediately)
  // Still need to wait for microtasks
  await new Promise((resolve) => setTimeout(resolve, 50));

  html = app.innerHTML;
});

describe('Main page — Header', () => {
  it('renders person name', () => {
    expect(html).toContain('测试用户');
  });

  it('renders person title', () => {
    expect(html).toContain('前端工程师');
  });

  it('renders social links', () => {
    expect(html).toContain('GitHub');
  });

  it('renders first letter avatar when no avatar image', () => {
    // testPerson has no avatar, so should render first char of name
    expect(html).toContain('测');
  });
});

describe('Main page — Sections', () => {
  it('renders about section', () => {
    expect(html).toContain('关于我');
    expect(html).toContain('这是一个测试用户的个人简介。');
  });

  it('renders skills section', () => {
    expect(html).toContain('技能');
    expect(html).toContain('TypeScript');
    expect(html).toContain('React');
  });

  it('renders experience section', () => {
    expect(html).toContain('工作经历');
    expect(html).toContain('测试公司');
    expect(html).toContain('高级开发');
  });

  it('renders education section', () => {
    expect(html).toContain('教育背景');
    expect(html).toContain('测试大学');
    expect(html).toContain('计算机科学');
  });

  it('renders code lab entrance card', () => {
    expect(html).toContain('Python 程式設計實驗室');
    expect(html).toContain('開始編程');
  });

  it('renders poster entrance card', () => {
    expect(html).toContain('AI與編程探索營');
    expect(html).toContain('查看海報');
  });

  it('renders footer', () => {
    expect(html).toContain('Built with Vite + TypeScript');
  });
});
