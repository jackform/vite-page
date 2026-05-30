/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { renderOutput, renderOutputLoading, escapeHtml } from '../code-output.js';
import type { TestRunResult } from '../code-types.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    const result = escapeHtml('a & b');
    expect(result).toContain('&amp;');
  });

  it('preserves double quotes (not escaped in text content)', () => {
    // textContent assignment escapes <>& but not quotes (they are safe in text nodes)
    const result = escapeHtml('say "hello"');
    expect(result).toBe('say "hello"');
  });

  it('returns plain text unchanged', () => {
    const result = escapeHtml('hello world');
    expect(result).toBe('hello world');
  });

  it('handles empty string', () => {
    const result = escapeHtml('');
    expect(result).toBe('');
  });

  it('handles Unicode characters', () => {
    const result = escapeHtml('你好世界');
    expect(result).toBe('你好世界');
  });
});

describe('renderOutputLoading', () => {
  it('returns a loading indicator with spinner', () => {
    const html = renderOutputLoading();
    expect(html).toContain('output-loading');
    expect(html).toContain('loading-spinner');
    expect(html).toContain('Running...');
  });
});

describe('renderOutput', () => {
  it('renders stdout when present', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: 'Hello World\n',
      stderr: '',
      executionTime: 42,
    };
    const html = renderOutput(result);
    expect(html).toContain('Hello World');
    expect(html).toContain('output-stdout');
  });

  it('renders stderr when present', () => {
    const result: TestRunResult = {
      status: 'error',
      stdout: '',
      stderr: 'NameError: name x is not defined\n',
    };
    const html = renderOutput(result);
    expect(html).toContain('NameError');
    expect(html).toContain('output-stderr');
  });

  it('renders return value when not None', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
      returnValue: '42',
    };
    const html = renderOutput(result);
    expect(html).toContain('⇒');
    expect(html).toContain('42');
  });

  it('does not render return value when it is "None"', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
      returnValue: 'None',
    };
    const html = renderOutput(result);
    expect(html).not.toContain('⇒');
  });

  it('does not render return value when undefined', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
    };
    const html = renderOutput(result);
    expect(html).not.toContain('⇒');
  });

  it('renders test results with all passed', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
      testResults: [
        { passed: true, input: '[2,7,11,15]\n9', expected: '[0,1]', actual: '[0,1]', index: 0 },
        { passed: true, input: '[3,2,4]\n6', expected: '[1,2]', actual: '[1,2]', index: 1 },
      ],
      passedCount: 2,
      totalCount: 2,
    };
    const html = renderOutput(result);
    expect(html).toContain('2/2 tests passed');
    expect(html).toContain('all-passed');
    expect(html).toContain('test-passed');
    expect(html).not.toContain('has-failures');
  });

  it('renders test results with some failed', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
      testResults: [
        { passed: true, input: '1', expected: '1', actual: '1', index: 0 },
        { passed: false, input: '2', expected: '4', actual: '2', index: 1 },
      ],
      passedCount: 1,
      totalCount: 2,
    };
    const html = renderOutput(result);
    expect(html).toContain('1/2 tests passed');
    expect(html).toContain('has-failures');
    expect(html).toContain('test-failed');
  });

  it('renders execution time when present', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
      executionTime: 150,
    };
    const html = renderOutput(result);
    expect(html).toContain('Execution time: 150ms');
  });

  it('renders timeout status', () => {
    const result: TestRunResult = {
      status: 'timeout',
      stdout: '',
      stderr: 'Execution timed out after 5000ms',
    };
    const html = renderOutput(result);
    expect(html).toContain('⏱');
    expect(html).toContain('Execution timed out after 5000ms');
  });

  it('renders empty output when no content', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
    };
    const html = renderOutput(result);
    expect(html).toBe('');
  });

  it('escapes HTML in stdout', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '<div>test</div>\n',
      stderr: '',
    };
    const html = renderOutput(result);
    expect(html).toContain('&lt;div&gt;test&lt;/div&gt;');
    expect(html).not.toContain('<div>test</div>');
  });

  it('renders test case details with input/expected/actual', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '',
      stderr: '',
      testResults: [
        { passed: false, input: 'nums=[1,2]\ntarget=3', expected: '[0,1]', actual: 'None', index: 0 },
      ],
      passedCount: 0,
      totalCount: 1,
    };
    const html = renderOutput(result);
    expect(html).toContain('Test 1');
    expect(html).toContain('nums=[1,2]');
    expect(html).toContain('[0,1]');
    expect(html).toContain('None');
    expect(html).toContain('actual-error');
  });

  it('trims leading and trailing whitespace from stdout/stderr', () => {
    const result: TestRunResult = {
      status: 'success',
      stdout: '  hello world  \n\n',
      stderr: '  error msg  \n',
    };
    const html = renderOutput(result);
    // trim() removes whitespace from both ends, preserving inner spaces
    expect(html).toContain('hello world');
    expect(html).toContain('error msg');
    expect(html).not.toContain('\n\n');
  });
});
