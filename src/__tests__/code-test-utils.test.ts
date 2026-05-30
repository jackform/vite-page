import { describe, it, expect } from 'vitest';
import { extractFunctionName, buildTestHarness, parseTestOutput } from '../code-test-utils';
import type { ExecutionResult, TestCase } from '../code-types';

describe('extractFunctionName', () => {
  it('extracts simple function name', () => {
    expect(extractFunctionName('def hello():\n  pass')).toBe('hello');
  });

  it('extracts function name with parameters', () => {
    expect(extractFunctionName('def add(a, b):\n  return a + b')).toBe('add');
  });

  it('extracts function name with type hints', () => {
    expect(extractFunctionName('def greet(name: str) -> str:\n  return "hi"')).toBe('greet');
  });

  it('extracts function name with leading whitespace', () => {
    expect(extractFunctionName('  def foo():\n    pass')).toBe('foo');
  });

  it('extracts first function when multiple defined', () => {
    const code = 'def first():\n  pass\n\ndef second():\n  pass';
    expect(extractFunctionName(code)).toBe('first');
  });

  it('returns null when no function defined', () => {
    expect(extractFunctionName('x = 1\ny = 2')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractFunctionName('')).toBeNull();
  });

  it('handles function with underscores and numbers', () => {
    expect(extractFunctionName('def my_func_2(x):\n  return x')).toBe('my_func_2');
  });
});

describe('buildTestHarness', () => {
  const sampleCases: TestCase[] = [
    { input: '2\n3', expected: '5' },
    { input: '10\n20', expected: '30' },
  ];

  it('includes import json and import sys', () => {
    const result = buildTestHarness('def add(a,b): return a+b', 'add', sampleCases);
    expect(result).toContain('import json');
    expect(result).toContain('import sys');
  });

  it('embeds user code in output', () => {
    const result = buildTestHarness('def double(x): return x*2', 'double', [
      { input: '5', expected: '10' },
    ]);
    expect(result).toContain('def double(x): return x*2');
  });

  it('generates test case iteration loop', () => {
    const result = buildTestHarness('def f(x): pass', 'f', sampleCases);
    expect(result).toContain('for _idx, (_input, _expected) in enumerate(_test_cases)');
  });

  it('generates TEST_RESULT print lines', () => {
    const result = buildTestHarness('def f(x): pass', 'f', [
      { input: '1', expected: '2' },
    ]);
    expect(result).toContain('TEST_RESULT:');
  });

  it('handles single test case', () => {
    const result = buildTestHarness('def f(x): return x', 'f', [
      { input: '42', expected: '42' },
    ]);
    const lines = result.split('\n');
    const testResultLines = lines.filter((l) => l.includes('TEST_RESULT:'));
    // One for success, one for exception — but only one test case
    expect(result).toContain('_test_cases = [["42","42"]]');
  });

  it('handles multiple test cases', () => {
    const result = buildTestHarness('def f(x): return x', 'f', [
      { input: '1', expected: '1' },
      { input: '2', expected: '2' },
      { input: '3', expected: '3' },
    ]);
    // All three input/expected pairs should be present in the JSON array
    expect(result).toContain('["1","1"]');
    expect(result).toContain('["2","2"]');
    expect(result).toContain('["3","3"]');
  });

  it('handles empty test cases', () => {
    const result = buildTestHarness('def f(x): pass', 'f', []);
    expect(result).toContain('_test_cases = []');
  });

  it('includes exception handling for each test case', () => {
    const result = buildTestHarness('def f(x): pass', 'f', [
      { input: '1', expected: '1' },
    ]);
    expect(result).toContain('except Exception as _e:');
  });

  it('uses the function name as _fn variable', () => {
    const result = buildTestHarness('def my_func(x): pass', 'my_func', [
      { input: '1', expected: '1' },
    ]);
    expect(result).toContain('_fn = my_func');
  });
});

describe('parseTestOutput', () => {
  function makeResult(stdout: string): ExecutionResult {
    return { status: 'success', stdout, stderr: '', executionTime: 100 };
  }

  it('parses passing test result', () => {
    const stdout = 'TEST_RESULT:{"index":0,"passed":true,"input":"1","expected":"1","actual":"1"}';
    const result = parseTestOutput(makeResult(stdout), [
      { input: '1', expected: '1' },
    ]);

    expect(result.testResults).toHaveLength(1);
    expect(result.testResults![0].passed).toBe(true);
    expect(result.passedCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('parses failing test result', () => {
    const stdout = 'TEST_RESULT:{"index":0,"passed":false,"input":"1","expected":"2","actual":"1"}';
    const result = parseTestOutput(makeResult(stdout), [
      { input: '1', expected: '2' },
    ]);

    expect(result.testResults![0].passed).toBe(false);
    expect(result.passedCount).toBe(0);
  });

  it('parses mixed passing and failing results', () => {
    const stdout = [
      'TEST_RESULT:{"index":0,"passed":true,"input":"1","expected":"1","actual":"1"}',
      'TEST_RESULT:{"index":1,"passed":false,"input":"2","expected":"4","actual":"3"}',
      'TEST_RESULT:{"index":2,"passed":true,"input":"3","expected":"9","actual":"9"}',
    ].join('\n');

    const result = parseTestOutput(makeResult(stdout), [
      { input: '1', expected: '1' },
      { input: '2', expected: '4' },
      { input: '3', expected: '9' },
    ]);

    expect(result.testResults).toHaveLength(3);
    expect(result.passedCount).toBe(2);
    expect(result.totalCount).toBe(3);
  });

  it('ignores non-TEST_RESULT lines in stdout', () => {
    const stdout = [
      'Some debug output',
      'TEST_RESULT:{"index":0,"passed":true,"input":"1","expected":"1","actual":"1"}',
      'More output',
    ].join('\n');

    const result = parseTestOutput(makeResult(stdout), [
      { input: '1', expected: '1' },
    ]);

    expect(result.testResults).toHaveLength(1);
    expect(result.testResults![0].passed).toBe(true);
  });

  it('handles empty stdout with fallback', () => {
    const testCases: TestCase[] = [
      { input: '1', expected: '1' },
      { input: '2', expected: '2' },
    ];
    const result = parseTestOutput(makeResult(''), testCases);

    expect(result.testResults).toHaveLength(2);
    expect(result.testResults![0].passed).toBe(false);
    expect(result.testResults![1].actual).toBe('(no output)');
    expect(result.passedCount).toBe(0);
  });

  it('uses trimmed stdout as actual in fallback mode', () => {
    const result = parseTestOutput(makeResult('  hello  '), [
      { input: '1', expected: 'world' },
    ]);

    expect(result.testResults![0].actual).toBe('hello');
  });

  it('handles malformed JSON in TEST_RESULT lines gracefully', () => {
    const stdout = 'TEST_RESULT:{broken json';
    const result = parseTestOutput(makeResult(stdout), [
      { input: '1', expected: '1' },
    ]);

    // Falls back because no valid TEST_RESULT lines were parsed
    expect(result.testResults).toHaveLength(1);
    expect(result.testResults![0].passed).toBe(false);
  });

  it('sets totalCount from testCases length', () => {
    const testCases: TestCase[] = [
      { input: 'a', expected: 'a' },
      { input: 'b', expected: 'b' },
      { input: 'c', expected: 'c' },
    ];
    const stdout = 'TEST_RESULT:{"index":0,"passed":true,"input":"a","expected":"a","actual":"a"}';
    const result = parseTestOutput(makeResult(stdout), testCases);

    expect(result.totalCount).toBe(3);
  });

  it('preserves original result metadata', () => {
    const execResult: ExecutionResult = {
      status: 'success',
      stdout: 'TEST_RESULT:{"index":0,"passed":true,"input":"1","expected":"1","actual":"1"}',
      stderr: '',
      executionTime: 123,
    };
    const result = parseTestOutput(execResult, [{ input: '1', expected: '1' }]);

    expect(result.status).toBe('success');
    expect(result.executionTime).toBe(123);
  });

  it('skips malformed TEST_RESULT lines but parses valid ones', () => {
    const stdout = [
      'TEST_RESULT:{broken',
      'TEST_RESULT:{"index":0,"passed":true,"input":"1","expected":"1","actual":"1"}',
    ].join('\n');

    const result = parseTestOutput(makeResult(stdout), [
      { input: '1', expected: '1' },
    ]);

    expect(result.testResults).toHaveLength(1);
    expect(result.testResults![0].passed).toBe(true);
  });
});
