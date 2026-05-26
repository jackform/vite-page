/**
 * Coding page type definitions.
 * Separated from types.ts to keep page-specific concerns isolated.
 */

/** A single test case for validating student code. */
export interface TestCase {
  input: string;
  expected: string;
}

/** Problem difficulty levels. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** A coding problem definition (LeetCode-style). */
export interface CodeProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string; // HTML, rendered directly via innerHTML
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: string;
  testCases: TestCase[];
}

/** Execution status for a single code run. */
export type ExecutionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'running'
  | 'success'
  | 'error'
  | 'timeout';

/** Result of running code through Pyodide. */
export interface ExecutionResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  returnValue?: string;
  executionTime?: number; // milliseconds
}

/** Result for a single test case validation. */
export interface TestResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  index: number;
}

/** Result of running all test cases. */
export interface TestRunResult extends ExecutionResult {
  testResults?: TestResult[];
  passedCount?: number;
  totalCount?: number;
}

/**
 * Editor state snapshot.
 * In future Yjs integration this becomes a Y.Text binding.
 */
export interface EditorState {
  code: string;
  language: 'python';
  lastModified: number; // Unix timestamp ms
}

/**
 * Session role for future teacher/student distinction.
 * Currently only 'student' is used; 'teacher' is reserved
 * for the real-time monitoring feature.
 */
export type SessionRole = 'student' | 'teacher';

/**
 * Session configuration.
 * roomId and role are prepared for future Yjs room-based collaboration.
 */
export interface SessionConfig {
  roomId: string;
  role: SessionRole;
  userId: string;
}
