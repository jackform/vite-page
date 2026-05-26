import type { CodeProblem } from './code-types';

/**
 * Sample problem definitions.
 * In production this data would come from a backend API.
 */

const twoSum: CodeProblem = {
  id: 'two-sum',
  title: '1. Two Sum',
  difficulty: 'easy',
  description: `
    <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <strong>indices of the two numbers</strong> such that they add up to <code>target</code>.</p>
    <p>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.</p>
    <p>You can return the answer in any order.</p>
  `,
  examples: [
    {
      input: 'nums = [2, 7, 11, 15], target = 9',
      output: '[0, 1]',
      explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
    },
    {
      input: 'nums = [3, 2, 4], target = 6',
      output: '[1, 2]',
    },
    {
      input: 'nums = [3, 3], target = 6',
      output: '[0, 1]',
    },
  ],
  constraints: [
    '2 ≤ nums.length ≤ 10⁴',
    '-10⁹ ≤ nums[i] ≤ 10⁹',
    '-10⁹ ≤ target ≤ 10⁹',
    'Only one valid answer exists.',
  ],
  starterCode: `def two_sum(nums, target):
    # Write your solution here
    pass
`,
  testCases: [
    { input: '[2, 7, 11, 15]\n9', expected: '[0, 1]' },
    { input: '[3, 2, 4]\n6', expected: '[1, 2]' },
    { input: '[3, 3]\n6', expected: '[0, 1]' },
  ],
};

const fizzBuzz: CodeProblem = {
  id: 'fizzbuzz',
  title: '412. Fizz Buzz',
  difficulty: 'easy',
  description: `
    <p>Given an integer <code>n</code>, return a <strong>list of strings</strong> where:</p>
    <ul>
      <li>For multiples of 3, use <code>"Fizz"</code> instead of the number.</li>
      <li>For multiples of 5, use <code>"Buzz"</code> instead of the number.</li>
      <li>For numbers which are multiples of both 3 and 5, use <code>"FizzBuzz"</code>.</li>
      <li>Otherwise, use the number as a string.</li>
    </ul>
  `,
  examples: [
    {
      input: 'n = 3',
      output: '["1", "2", "Fizz"]',
    },
    {
      input: 'n = 5',
      output: '["1", "2", "Fizz", "4", "Buzz"]',
    },
    {
      input: 'n = 15',
      output: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]',
    },
  ],
  constraints: ['1 ≤ n ≤ 10⁴'],
  starterCode: `def fizz_buzz(n):
    # Write your solution here
    pass
`,
  testCases: [
    { input: '3', expected: "['1', '2', 'Fizz']" },
    { input: '5', expected: "['1', '2', 'Fizz', '4', 'Buzz']" },
    { input: '15', expected: "['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz']" },
  ],
};

/** All available problems keyed by id for easy lookup. */
export const problems: Record<string, CodeProblem> = {
  'two-sum': twoSum,
  fizzbuzz: fizzBuzz,
};

/** Default problem loaded on page open. */
export const defaultProblem = twoSum;
