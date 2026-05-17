/*
 * ========================================
 * 本文件演示 TypeScript 函数相关的核心概念
 * 包括：泛型函数、类型守卫、keyof 约束、
 *       rest 参数、async/Promise、可选参数
 * ========================================
 */

import type { Person, Skill, Experience } from './types';

// ========== 1. 泛型函数 ==========
// <T> 让函数可以接受任意类型，同时保持类型安全
// keyof T 约束 key 必须是 T 的属性名之一
// 返回值 Record<string, T[]> 表示一个以分类名为 key、数组为 value 的对象
export function groupBy<T>(
  items: T[],
  key: keyof T,
): Record<string, T[]> {
  // as 在这里是类型断言：告诉 TS "我知道这个对象的类型"
  const result = {} as Record<string, T[]>;

  for (const item of items) {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
  }
  return result;
}

// ========== 2. 类型守卫（Type Guard）==========
// 语法：参数 is 类型
// 作用：在 if 分支中，TS 会认为参数已经被"缩小"为指定类型
export function isAdvanced(skill: Skill): skill is Skill & { proficiency: 'advanced' | 'expert' } {
  return skill.proficiency === 'advanced' || skill.proficiency === 'expert';
}

// 另一个类型守卫：判断值是否为 string
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// ========== 3. 带默认值的参数 ==========
// 参数后加 = 值，调用时可以不传
export function formatDate(dateStr: string, locale: string = 'zh-CN'): string {
  // 把 '2023-03' 这种格式转成更可读的形式
  const [year, month] = dateStr.split('-');
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月',
  ];
  const m = parseInt(month, 10);
  return `${year}年 ${monthNames[m - 1]}`;
}

// ========== 4. Rest 参数（剩余参数）==========
// ...args: string[] 表示可以传入任意多个字符串参数，它们会被收集成一个数组
export function concatUrl(base: string, ...paths: string[]): string {
  return [base, ...paths].join('/').replace(/([^:]\/)\/+/g, '$1');
}

// ========== 5. Promise 类型 & async 函数 ==========
// 模拟从 API 获取数据的异步函数
// Promise<Person> 表示这个函数返回一个 Promise，resolve 后得到 Person 类型的数据
export async function fetchPerson(): Promise<Person> {
  // 动态导入 data.ts，避免循环依赖
  const { person } = await import('./data');
  // 模拟网络延迟 —— 真实项目会是 fetch() 调用
  await delay(800);
  return person;
}

// 辅助函数：返回一个在指定 ms 后 resolve 的 Promise
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========== 6. 函数重载签名（演示概念）==========
// 同一个函数对不同参数类型返回不同的结果类型
// 注意：重载签名只是声明，真正的实现在最后
export function formatExperienceDate(exp: Experience): string;
export function formatExperienceDate(start: string, end?: string): string;
// 实现签名 —— 这个才是真正执行的代码
export function formatExperienceDate(
  expOrStart: Experience | string,
  end?: string,
): string {
  if (typeof expOrStart === 'object') {
    // 走第一个重载
    const start = formatDate(expOrStart.startDate);
    const endDate = expOrStart.endDate ? formatDate(expOrStart.endDate) : '至今';
    return `${start} — ${endDate}`;
  }
  // 走第二个重载
  const start = formatDate(expOrStart);
  const endDate = end ? formatDate(end) : '至今';
  return `${start} — ${endDate}`;
}

// ========== 7. 可选参数 ==========
// 参数后加 ? 表示可以传也可以不传
export function getSkillLevel(years?: number): string {
  if (years === undefined) return '未知';
  if (years < 1) return '入门';
  if (years < 3) return '熟练';
  if (years < 5) return '精通';
  return '专家';
}
