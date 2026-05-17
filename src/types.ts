/*
 * ========================================
 * 本文件展示 TypeScript 的核心类型系统
 * 包括：基础类型、接口、类型别名、联合类型、
 *       泛型、工具类型 等
 * ========================================
 */

// ========== 1. 联合类型 & 字面量类型 ==========
// 用 | 符号连接多个类型，意味着值只能是其中之一
// 字面量类型：直接把具体的字符串值当成类型
export type Proficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// ========== 2. Enum（枚举）==========
// 枚举适合用在"一组有限的常量"的场景
// 编译后会生成对象，所以运行时也存在
export enum ThemeMode {
  Light = 'light',
  Dark = 'dark',
}

// ========== 3. Interface（接口）==========
// 接口用于描述对象的"形状"（Shape）
// 和 type 最大的区别：interface 可以被 extends 扩展，type 不能

export interface Skill {
  name: string;
  proficiency: Proficiency; // 使用上面定义的联合类型
  // ? 表示可选属性 —— 这个字段可以不存在
  years?: number;
}

export interface Experience {
  company: string;
  role: string;
  startDate: string; // 日期在 JSON 数据中用字符串更方便
  // endDate 为可选：如果不存在，说明"至今"
  endDate?: string;
  description: string;
  // readonly 数组：数组本身不能被重新赋值（但元素可以访问）
  highlights: readonly string[];
}

export interface Education {
  school: string;
  degree: string;
  field: string;
  startYear: number;
  endYear: number;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

// ========== 4. 核心接口 —— 个人档案 ==========
export interface Person {
  // readonly 表示该属性只能在对象创建时赋值，之后不可修改
  readonly id: string;
  name: string;
  title: string; // 职位/头衔
  avatar?: string; // 可选：头像 URL
  bio: string; // 个人简介
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  socialLinks: SocialLink[];
}

// ========== 5. 泛型接口 ==========
// <T> 是类型参数，类似于函数的形参，但传的是"类型"而不是"值"
// 使用场景：API 响应、容器、状态管理等
export interface ApiResponse<T> {
  success: boolean;
  data: T; // T 会被替换成实际的类型
  message?: string;
}

// ========== 6. 工具类型（Utility Types）==========
// TypeScript 内置的类型变换工具，无需定义，这里仅演示用法

// Partial<Person>：把 Person 的所有属性变成可选的
// 常用于编辑表单场景（用户可能只修改部分字段）
export type PersonUpdate = Partial<Person>;

// Pick<Person, 'name' | 'title' | 'avatar' | 'bio'>：
// 只从 Person 中选取指定的几个属性，组成新类型
// 常用于列表摘要、卡片展示
export type PersonCard = Pick<Person, 'name' | 'title' | 'avatar' | 'bio'>;

// Omit<Person, 'id'>：从 Person 中排除 'id' 属性
// 常用于"创建新对象"的场景（id 由后端生成）
export type PersonInput = Omit<Person, 'id'>;

// Record<string, Skill[]>：
// 创建一个对象类型，key 是 string，value 是 Skill[]
// 等价于 { [key: string]: Skill[] }
export type SkillCategoryMap = Record<string, Skill[]>;
