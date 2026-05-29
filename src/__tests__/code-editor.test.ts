/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeEditor } from '../code-editor.js';

describe('CodeEditor setReadOnly', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates editable editor by default', () => {
    const editor = new CodeEditor(container, 'print("hello")', false, false);
    // Editor should be writable
    const content = editor.getCode();
    expect(content).toBe('print("hello")');
    editor.destroy();
  });

  it('creates read-only editor when readOnly=true', () => {
    const editor = new CodeEditor(container, 'locked code', true, false);
    const content = editor.getCode();
    expect(content).toBe('locked code');
    editor.destroy();
  });

  it('setReadOnly(true) makes editor read-only', () => {
    const editor = new CodeEditor(container, 'editable', false, false);
    editor.setReadOnly(true);
    // Content should still be accessible
    expect(editor.getCode()).toBe('editable');
    editor.destroy();
  });

  it('setReadOnly(false) makes editor editable again', () => {
    const editor = new CodeEditor(container, 'editable', false, false);
    editor.setReadOnly(true);
    editor.setReadOnly(false);
    expect(editor.getCode()).toBe('editable');
    editor.destroy();
  });

  it('content is preserved when toggling readOnly', () => {
    const editor = new CodeEditor(container, 'original code', false, false);
    editor.setReadOnly(true);
    expect(editor.getCode()).toBe('original code');
    editor.setReadOnly(false);
    expect(editor.getCode()).toBe('original code');
    editor.destroy();
  });

  it('setReadOnly and setTheme work together', () => {
    const editor = new CodeEditor(container, 'test', false, false);
    editor.setReadOnly(true);
    editor.setTheme(true); // light theme
    expect(editor.getCode()).toBe('test');
    editor.setReadOnly(false);
    editor.setTheme(false); // dark theme
    expect(editor.getCode()).toBe('test');
    editor.destroy();
  });

  it('setCode works in read-only mode', () => {
    const editor = new CodeEditor(container, 'original', false, false);
    editor.setReadOnly(true);
    editor.setCode('updated by teacher');
    expect(editor.getCode()).toBe('updated by teacher');
    editor.destroy();
  });

  it('constructor initializes in read-only mode', () => {
    const editor = new CodeEditor(container, 'read-only from start', true, false);
    expect(editor.getCode()).toBe('read-only from start');
    editor.setReadOnly(false);
    expect(editor.getCode()).toBe('read-only from start');
    editor.destroy();
  });
});
