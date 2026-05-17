/*
 * ========================================
 * 本文件演示 TypeScript 的类型标注在变量上的使用
 * 关键词：类型推断、as const、接口实现、数组泛型
 * ========================================
 */

// 导入类型（仅导入类型用 import type，编译后不会生成任何代码）
import type { Person, Skill, Experience, Education, SocialLink } from './types';

// ========== 1. 基础类型标注 ==========
// 变量名: 类型 = 值
// 这里显式标注了类型，但其实 TS 可以自动推断，写上是为了可读性
const age: number = 28;
const isOpenToWork: boolean = false;

// ========== 2. 数组类型 ==========
// 两种写法等价：string[] 是语法糖，Array<string> 是泛型写法
const hobbies: string[] = ['摄影', '徒步', '玩桌游', '写博客'];
// 泛型写法（和上面等价）：
// const hobbies: Array<string> = ['摄影', '徒步', '玩桌游', '写博客'];

// ========== 3. as const（常量断言）==========
// as const 告诉 TS："请把这个值推断为最窄的、不可变的类型"
// 不加 as const：类型是 string[]
// 加了 as const：类型是 readonly ["摄影", "徒步", "玩桌游", "写博客"]
const readonlyHobbies = ['摄影', '徒步', '玩桌游', '写博客'] as const;

// ========== 4. 使用接口定义数据 ==========
// 编辑器会提供自动补全，写错属性名/类型会立即报错
const skills: Skill[] = [
  { name: 'TypeScript', proficiency: 'intermediate', years: 1 },
  { name: 'JavaScript', proficiency: 'advanced', years: 5 },
  { name: 'React', proficiency: 'advanced', years: 4 },
  { name: 'Vue', proficiency: 'intermediate', years: 2 },
  { name: 'Node.js', proficiency: 'intermediate', years: 3 },
  { name: 'Python', proficiency: 'beginner', years: 1 },
  { name: 'Git', proficiency: 'advanced', years: 5 },
  { name: 'Docker', proficiency: 'beginner', years: 0.5 },
];

const experience: Experience[] = [
  {
    company: '字节跳动',
    role: '高级前端工程师',
    startDate: '2023-03',
    description: '负责内部组件库的维护与迭代，服务 20+ 业务线。',
    highlights: [
      '将组件库构建时间从 5 分钟优化到 30 秒',
      '主导 Monorepo 架构迁移',
      '推动团队代码规范落地，Code Review 覆盖率 100%',
    ] as const, // 数组也可以 as const
  },
  {
    company: '阿里巴巴',
    role: '前端工程师',
    startDate: '2021-07',
    endDate: '2023-02', // 有结束日期 = 已离职
    description: '参与电商中台前端开发。',
    highlights: [
      '核心业务模块开发（订单、商品管理）',
      '搭建前端监控体系',
    ] as const,
  },
  {
    company: '美团',
    role: '前端实习生',
    startDate: '2020-06',
    endDate: '2020-09',
    description: '参与商家端 H5 页面开发。',
    highlights: [
      '独立完成 3 个营销活动页',
    ] as const,
  },
];

const education: Education[] = [
  {
    school: '浙江大学',
    degree: '本科',
    field: '计算机科学与技术',
    startYear: 2017,
    endYear: 2021,
  },
];

const socialLinks: SocialLink[] = [
  { platform: 'GitHub', url: 'https://github.com/zhangsan', icon: '🐙' },
  { platform: '掘金', url: 'https://juejin.cn/user/zhangsan', icon: '📝' },
  { platform: 'Email', url: 'mailto:zhangsan@example.com', icon: '📧' },
];

// ========== 5. 组装 Person 对象 ==========
// 指定类型后，TS 会检查对象是否满足 Person 接口的定义
export const person: Person = {
  id: 'p_001', // readonly，后续不能 person.id = 'xxx'
  name: '张三',
  title: '前端工程师 · 热爱开源',
  bio: '一个充满好奇心的开发者，喜欢探索新技术，相信代码可以改变世界。工作之余喜欢摄影和徒步，用镜头记录生活，用脚步丈量世界。目前正在深入学习 TypeScript，这是通过本页面练手的第一个 TS 项目。',
  skills,
  experience,
  education,
  socialLinks,
};
