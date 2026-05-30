import type { ExecutionResult, TestCase, TestRunResult } from './code-types';

/**
 * Extract the first function name from user code.
 * Matches patterns like "def function_name(...):"
 */
export function extractFunctionName(code: string): string | null {
  const match = code.match(/^\s*def\s+(\w+)\s*\(/m);
  return match ? match[1] : null;
}

/**
 * Build a Python script that:
 * 1. Includes the user's code (function definition)
 * 2. Iterates through test cases
 * 3. For each case: parses input, calls the function, prints JSON result line
 *
 * Input format per test case: first line is the first argument (as Python literal),
 * subsequent lines are additional arguments. Output is compared as Python literals.
 */
export function buildTestHarness(userCode: string, functionName: string, testCases: TestCase[]): string {
  const lines: string[] = [];

  lines.push('import json');
  lines.push('import sys');
  lines.push('');
  lines.push('# User code');
  lines.push(userCode);
  lines.push('');
  lines.push('# Test runner');
  lines.push('_test_cases = ' + JSON.stringify(testCases.map((tc) => [tc.input, tc.expected])));
  lines.push('_fn = ' + functionName);
  lines.push('');

  lines.push('for _idx, (_input, _expected) in enumerate(_test_cases):');
  lines.push('    try:');
  lines.push('        # Parse input (split by newline, each line is a Python literal)');
  lines.push('        _args = []');
  lines.push('        for _line in _input.strip().split("\\n"):');
  lines.push('            _line = _line.strip()');
  lines.push('            if _line:');
  lines.push('                _args.append(eval(_line))');
  lines.push('');
  lines.push('        # Call the user function');
  lines.push('        if len(_args) == 1:');
  lines.push('            _actual = _fn(_args[0])');
  lines.push('        else:');
  lines.push('            _actual = _fn(*_args)');
  lines.push('');
  lines.push('        # Print result as a JSON line (marker: TEST_RESULT)');
  lines.push('        print("TEST_RESULT:" + json.dumps({');
  lines.push('            "index": _idx,');
  lines.push('            "passed": str(_actual) == str(_expected),');
  lines.push('            "input": _input,');
  lines.push('            "expected": _expected,');
  lines.push('            "actual": str(_actual)');
  lines.push('        }))');
  lines.push('    except Exception as _e:');
  lines.push('        print("TEST_RESULT:" + json.dumps({');
  lines.push('            "index": _idx,');
  lines.push('            "passed": False,');
  lines.push('            "input": _input,');
  lines.push('            "expected": _expected,');
  lines.push('            "actual": "Error: " + str(_e)');
  lines.push('        }))');

  return lines.join('\n');
}

/** Parse TEST_RESULT lines from stdout into structured test results. */
export function parseTestOutput(result: ExecutionResult, testCases: TestCase[]): TestRunResult {
  const testResults = [];
  let passedCount = 0;

  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('TEST_RESULT:')) {
      try {
        const data = JSON.parse(line.slice('TEST_RESULT:'.length));
        testResults.push({
          passed: data.passed,
          input: data.input,
          expected: data.expected,
          actual: data.actual,
          index: data.index,
        });
        if (data.passed) passedCount++;
      } catch {
        // Malformed test result line — skip
      }
    }
  }

  // If no structured results were found, check if tests passed via simple comparison
  if (testResults.length === 0) {
    // Fallback: assume the output is the direct result
    const trimmed = result.stdout.trim();
    for (let i = 0; i < testCases.length; i++) {
      testResults.push({
        passed: false,
        input: testCases[i].input,
        expected: testCases[i].expected,
        actual: trimmed || '(no output)',
        index: i,
      });
    }
  }

  return {
    ...result,
    testResults,
    passedCount,
    totalCount: testCases.length,
  };
}
