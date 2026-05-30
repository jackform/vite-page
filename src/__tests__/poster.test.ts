/**
 * @vitest-environment jsdom
 *
 * Tests for poster.ts page rendering.
 * The poster module captures #poster-app at import time
 * and renders on DOMContentLoaded. We set up DOM before import.
 */

import { describe, it, expect, beforeAll } from 'vitest';

let html = '';

beforeAll(async () => {
  // Create the poster-app element BEFORE importing the module
  // since the module captures the reference at import time
  const posterApp = document.createElement('div');
  posterApp.id = 'poster-app';
  document.body.appendChild(posterApp);

  // Import the module which registers the DOMContentLoaded handler
  await import('../poster.js');

  // Trigger page initialization
  document.dispatchEvent(new Event('DOMContentLoaded'));

  html = posterApp.innerHTML;
});

describe('Poster page — Hero section', () => {
  it('renders title and subtitle', () => {
    expect(html).toContain('AI與編程探索營');
    expect(html).toContain('激發創意，掌握未來科技的鑰匙');
  });
});

describe('Poster page — Info bar', () => {
  it('renders date, time and location', () => {
    expect(html).toContain('2026年7月15日 - 8月25日');
    expect(html).toContain('每週二、四 14:00 - 16:00');
    expect(html).toContain('香港九龍塘創新中心');
  });

  it('renders age range and language', () => {
    expect(html).toContain('10-15歲（小五至中三）');
    expect(html).toContain('粵語授課，輔以英文教材');
  });
});

describe('Poster page — Course modules', () => {
  it('renders all 6 course modules', () => {
    expect(html).toContain('什麼是人工智能？');
    expect(html).toContain('Python 程式設計入門');
    expect(html).toContain('訓練你的第一個AI模型');
    expect(html).toContain('提示工程與創意AI');
    expect(html).toContain('AI專案實戰');
    expect(html).toContain('AI倫理與未來');
  });

  it('renders English titles', () => {
    expect(html).toContain('What is AI?');
    expect(html).toContain('Python Programming');
    expect(html).toContain('Train Your First AI');
    expect(html).toContain('Prompt Engineering');
    expect(html).toContain('AI Project');
    expect(html).toContain('AI Ethics &amp; Future');
  });

  it('renders module numbers 01-06', () => {
    expect(html).toContain('01');
    expect(html).toContain('02');
    expect(html).toContain('03');
    expect(html).toContain('04');
    expect(html).toContain('05');
    expect(html).toContain('06');
  });

  it('renders section headers', () => {
    expect(html).toContain('課程大綱');
    expect(html).toContain('Course Outline');
  });
});

describe('Poster page — Highlights', () => {
  it('renders why join us section', () => {
    expect(html).toContain('為什麼選擇我們？');
    expect(html).toContain('Why Join Us');
  });

  it('renders highlight items', () => {
    expect(html).toContain('無需編程經驗');
    expect(html).toContain('小班教學');
    expect(html).toContain('每人一台電腦實操');
    expect(html).toContain('可獲頒證書');
  });
});

describe('Poster page — UI elements', () => {
  it('renders CTA button', () => {
    expect(html).toContain('立即報名');
  });

  it('renders back link to home', () => {
    expect(html).toContain('返回個人主頁');
  });

  it('renders footer', () => {
    expect(html).toContain('為下一代打造科技思維');
  });

  it('uses pixel-icon class for icons', () => {
    expect(html).toContain('pixel-icon');
  });

  it('contains highlight icons', () => {
    expect(html).toContain('highlight-icon');
    expect(html).toContain('highlight-text');
  });
});
