# 从零到一：TypeScript + Vite 入门完全指南

本指南为你逐行解释这个个人主页项目的每一个文件、每一行代码。

---

## 目录

- [第一部分：背景知识](#第一部分背景知识)
  - [1.1 什么是 Node.js](#11-什么是-nodejs)
  - [1.2 什么是 npm](#12-什么是-npm)
  - [1.3 什么是 Vite](#13-什么是-vite)
  - [1.4 什么是 TypeScript](#14-什么是-typescript)
  - [1.5 TypeScript 和 JavaScript 是什么关系](#15-typescript-和-javascript-是什么关系)
- [第二部分：项目文件总览](#第二部分项目文件总览)
- [第三部分：代码执行流程](#第三部分代码执行流程)
  - [3.1 启动命令 `npm run dev` 到底发生了什么](#31-启动命令-npm-run-dev-到底发生了什么)
  - [3.2 浏览器打开后发生了什么](#32-浏览器打开后发生了什么)
- [第四部分：逐文件、逐行解释](#第四部分逐文件逐行解释)
  - [4.1 package.json](#41-packagejson)
  - [4.2 tsconfig.json](#42-tsconfigjson)
  - [4.3 vite.config.ts](#43-viteconfigts)
  - [4.4 index.html](#44-indexhtml)
  - [4.5 src/vite-env.d.ts](#45-srcvite-envdts)
  - [4.6 src/types.ts](#46-srctypests)
  - [4.7 src/data.ts](#47-srcdatats)
  - [4.8 src/utils.ts](#48-srcutilsts)
  - [4.9 src/main.ts](#49-srcmaints)
  - [4.10 src/style.css](#410-srcstylecss)
  - [4.11 .gitignore](#411-gitignore)
- [第五部分：核心概念字典](#第五部分核心概念字典)

---

## 第一部分：背景知识

### 1.1 什么是 Node.js

**一句话：Node.js 让 JavaScript 可以脱离浏览器运行。**

在 Node.js 出现之前，JavaScript 只能运行在浏览器里——你写了一个 `.js` 文件，必须放在 HTML 页面里用 `<script>` 标签引入，然后用浏览器打开才能执行。

Node.js 把 Chrome 浏览器里的 V8 JavaScript 引擎单独拿出来，打包成一个可以在命令行运行的程序。这意味着你可以：

```bash
node hello.js     # 在终端直接执行 hello.js 文件
```

因为这个能力，前端工程的工具链（编译、打包、代码检查等）全部可以用 Node.js 来写。你不需要另外学一门语言来做工具——用 JavaScript 就够了。

**本项目中 Node.js 的作用：**
- 运行 Vite 开发服务器（`npm run dev` 命令最终调用的是 Node.js 执行 Vite）
- 运行 TypeScript 编译器

### 1.2 什么是 npm

**一句话：npm 是 Node.js 的包管理器，相当于 App Store for JS 代码。**

- **npm** = Node Package Manager。它随 Node.js 一起安装。
- `package.json` 文件记录项目需要的第三方依赖包（比如 Vite、TypeScript）。
- `npm install` 读取 `package.json`，去云端仓库下载这些包到本地 `node_modules` 文件夹。
- `node_modules` 不应该提交到 Git，因为它体积很大且可以随时用 `npm install` 重新下载（所以被 `.gitignore` 忽略了）。

**本项目中 npm 的作用：**
- 我们通过 npm 安装了 `vite` 和 `typescript` 两个包
- 之后你想加什么库，也都是 `npm install <package-name>`

### 1.3 什么是 Vite

**一句话：Vite 是一个"前端开发服务器 + 构建工具"。**

Vite 做两件事：

**开发模式（`npm run dev`）：**
- 启动一个本地 HTTP 服务器（默认 `http://localhost:5173`）
- 你访问 `index.html`，Vite 识别到 `<script type="module" src="/src/main.ts">`
- 它**实时**把 TypeScript 编译成 JavaScript，然后发给浏览器
- 支持热更新（Hot Module Replacement）：你改代码，浏览器立刻刷新，不用手动重刷页面

**构建模式（`npm run build`）：**
- 把所有 TypeScript 编译成 JavaScript
- 把所有 CSS、图片等资源打包优化
- 输出到 `dist` 文件夹，可以直接部署到线上

### 1.4 什么是 TypeScript

**一句话：TypeScript = JavaScript + 类型标注。**

看一个例子你就懂了：

```js
// JavaScript（无类型，运行时才发现错误）
function add(a, b) {
  return a + b;
}
add(1, "2");  // 结果："12"（字符串拼接，不是你想要的！没有任何警告）
```

```ts
// TypeScript（有类型，写代码时就报错）
function add(a: number, b: number): number {
  return a + b;
}
add(1, "2");
//   ~~~~~ ❌ 编辑器立刻标红：类型 "string" 不能赋给类型 "number"
```

**TypeScript 的核心价值：**
- **提前发现错误**：不用等到浏览器跑起来才知道有 bug
- **编辑器的自动补全**：因为知道了类型，编辑器能智能提示
- **代码即文档**：看到函数签名就知道参数是什么类型，不用猜

### 1.5 TypeScript 和 JavaScript 是什么关系？

```
TypeScript 源文件 (.ts)
        │
        │  编译（tsc）—— TypeScript Compiler
        │
        ▼
JavaScript 文件 (.js)  ← 浏览器真正执行的是这个
```

TypeScript 是"写在前面"的代码，最终要编译成 JavaScript 才能在浏览器里运行。**你写的 `.ts` 文件永远不会直接被浏览器执行**。

类比：TypeScript 就像带着详细注释和校验规则的草稿，JavaScript 是最终交付的成品文件。

---

## 第二部分：项目文件总览

```
my-vite-page/
├── index.html              ← 浏览器访问的入口页面
├── package.json            ← 项目配置文件（依赖、脚本等）
├── tsconfig.json           ← TypeScript 编译器的配置
├── vite.config.ts          ← Vite 的配置文件
├── .gitignore              ← 告诉 Git 哪些文件不要提交
├── GUIDE.md                ← 你正在看的这份文档 📖
├── README.md               ← 项目说明
├── node_modules/           ← 下载的第三方依赖（npm install 后产生）
│
└── src/                    ← 源代码都在这个文件夹
    ├── vite-env.d.ts       ← 「告诉 TS .css 文件是可以导入的」
    ├── types.ts            ← 定义所有的「数据类型」
    ├── data.ts             ← 定义所有的「数据」（张三的个人信息）
    ├── utils.ts            ← 定义所有的「工具函数」
    ├── main.ts             ← 「入口文件」，把所有东西拼在一起
    └── style.css           ← 页面的样式
```

---

## 第三部分：代码执行流程

### 3.1 启动命令 `npm run dev` 到底发生了什么

**第 0 步 —— 你在终端输入：**

```bash
npm run dev
```

**第 1 步 —— npm 查找 package.json：**

npm 打开 `package.json`，在里面找到 `scripts` 部分：

```json
"scripts": {
  "dev": "vite",
  ...
}
```

`dev` 对应的值是 `"vite"`，所以 `npm run dev` 实际执行的是：

```bash
vite
```

**第 2 步 —— 找到 vite 可执行文件：**

npm 去 `node_modules/.bin/vite` 找到 Vite 的命令行入口（这是 `npm install` 时安装的）。

**第 3 步 —— Vite 启动：**

1. Vite 读取 `vite.config.ts`，拿到配置
2. Vite 启动一个 HTTP 服务器，监听 `localhost:5173` 端口
3. 终端输出类似这样的信息：

```
VITE v8.0.13  ready in 300 ms
➜  Local:   http://localhost:5173/
```

**现在，你可以在浏览器打开 `http://localhost:5173/` 了。**

### 3.2 浏览器打开后发生了什么

你访问 `http://localhost:5173/`，整个流程如下：

```
浏览器请求 GET / 
    │
    ▼
Vite 收到请求，默认返回 index.html
    │
    ▼
浏览器解析 index.html，看到：
<script type="module" src="/src/main.ts"></script>
    │
    ▼
浏览器再次请求 GET /src/main.ts 
    │
    ▼
Vite 收到请求：
  1. 读到 src/main.ts 的内容
  2. 发现里面有 import './style.css' —— 于是也编译 CSS
  3. 发现里面有 import { person } from './data' —— 于是找到 data.ts
  4. 发现 data.ts 里有 import type { ... } from './types' —— 于是找到 types.ts
  5. 同理会找到 utils.ts
    │
    ▼
Vite 把所有的 .ts 文件编译成 .js，把 .css 处理成浏览器能识别的格式
    │
    ▼
Vite 把编译后的 JS 和 CSS 返回给浏览器
    │
    ▼
浏览器执行 JS 代码：
  1. main.ts 第 29 行：找到 <div id="app"> 元素
  2. main.ts 最后一段：监听 DOMContentLoaded 事件
  3. 页面加载完成后，调用 init() 函数
  4. init() 显示"加载中..."，然后调用 fetchPerson()
  5. fetchPerson() 模拟 0.8 秒的网络请求，返回 person 对象
  6. renderPage(person) 把所有 HTML 拼好，塞进 <div id="app">
  7. 页面渲染完成！
```

**关键理解：**
- Vite 在**运行前**不需要编译所有文件，它是在**浏览器请求时**才编译对应的文件
- 这叫"按需编译"（on-demand），比传统工具快很多
- `import` 语句形成了依赖链条，Vite 会自动追踪并编译链条上的所有文件

---

## 第四部分：逐文件、逐行解释

### 4.1 package.json

```json
{
  "name": "my-vite-page",    // 项目名称，随便取
  "private": true,           // 设为 true 避免意外发布到 npm 仓库
  "version": "1.0.0",        // 版本号
  "type": "module",          // 告诉 Node.js：这个项目使用 ES Module
                             // 有了它，才能用 import/export 语法
  "scripts": {               // 定义快捷命令
    "dev": "vite",           // npm run dev 会执行 vite 命令
    "build": "tsc && vite build",
    // tsc        → 先用 TypeScript 编译器检查所有类型
    // &&         → 前面成功才执行后面的
    // vite build → 用 Vite 打包项目
    "preview": "vite preview" // 预览打包后的结果
  },
  "devDependencies": {       // 开发依赖（只在开发时需要，上线后不需要）
    "typescript": "^6.0.3",  // ^ 表示可以自动升级次版本
    "vite": "^8.0.13"
  }
}
```

**补充说明 —— `dependencies` vs `devDependencies`：**

| 类型 | 用途 | 举例 |
|------|------|------|
| `dependencies` | 运行时需要（网页代码会引用） | React, Vue, axios |
| `devDependencies` | 只在开发时需要（构建工具等） | TypeScript, Vite, ESLint |

我们的项目没有 `dependencies`，因为代码用的是浏览器原生 API（querySelector, addEventListener），不需要任何框架。

---

### 4.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    // TypeScript 编译成的 JS 版本。ES2020 兼容所有现代浏览器。
    // 如果你需要支持很老的 IE，可以改成 "ES2015"。

    "module": "ESNext",
    // 模块系统。ESNext 表示用最新的 import/export 标准。
    // Vite 会用 ESNext 因为它要兼容浏览器的 import。

    "moduleResolution": "bundler",
    // 模块查找方式。"bundler" 告诉 TS：Vite 会处理模块解析，
    // 你不需要模拟 Node.js 的文件查找规则。

    "strict": true,
    // ⭐ 最重要的选项！开启严格模式。
    // 会启用所有严格检查规则（null 检查、this 检查等）。
    // 这是 TS 新手保护你的最强武器，强烈建议始终开启。

    "esModuleInterop": true,
    // 允许用 import 语法导入 CommonJS 模块（老式 require 模块）

    "skipLibCheck": true,
    // 跳过 .d.ts 声明文件的类型检查，加快编译速度

    "forceConsistentCasingInFileNames": true,
    // 强制文件名大小写一致。Windows 不区分大小写，
    // Mac/Linux 区分。开启后能避免跨平台的文件名问题。

    "outDir": "dist"
    // 编译输出目录（Vite 实际不用这个，Vite 有自己的输出逻辑）
  },
  "include": ["src"]
  // 只编译 src 文件夹里的文件
}
```

---

### 4.3 vite.config.ts

```ts
import { defineConfig } from 'vite';
// defineConfig 是 Vite 提供的辅助函数。
// 它的作用是：让你在写配置时获得编辑器的智能提示。
// 不用它也不影响运行，但用了能少犯错。

export default defineConfig({
  root: '.',
  // 项目根目录。'.' 表示当前文件夹。
  // Vite 从这里寻找 index.html。

  build: {
    outDir: 'dist',
    // 构建输出目录。npm run build 之后产物会放到 dist 文件夹。
  },
});
```

**为什么配置这么少？** Vite 的设计哲学是"约定优于配置"：
- 你不说入口文件？Vite 默认找 `index.html`
- 你不说端口号？Vite 默认用 `5173`
- 你不说 TypeScript 配置？Vite 自动读取 `tsconfig.json`

---

### 4.4 index.html

```html
<!DOCTYPE html>
<!-- 声明这是 HTML5 文档 -->

<html lang="en">
<!-- <html> 是所有 HTML 内容的根标签 -->
<!-- lang="en" 告诉浏览器和搜索引擎页面语言是英语 -->

  <head>
    <meta charset="UTF-8" />
    <!-- 告诉浏览器使用 UTF-8 编码，支持中文、emoji 等各种字符 -->
    <!-- /> 是自闭合写法，等价于 ></meta> -->

    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- 让移动端浏览器正确显示页面 -->
    <!-- width=device-width  → 页面宽度 = 设备宽度，不自作主张缩放 -->
    <!-- initial-scale=1.0   → 初始缩放比例为 1（不放大也不缩小） -->

    <title>张三 - 个人主页</title>
    <!-- 浏览器标签页上显示的文字 -->
  </head>

  <body>
    <div id="app"></div>
    <!-- 这是页面的"容器" -->
    <!-- 一开始是空的，等 JS 代码执行后，会把 HTML 内容填进去 -->
    <!-- id="app" 是唯一标识，JS 用 getElementById 或 querySelector 找到它 -->

    <script type="module" src="/src/main.ts"></script>
    <!-- type="module" 告诉浏览器：这个脚本是一个 ES Module -->
    <!-- 有了 type="module"，才可以在 JS 中用 import/export -->
    <!-- src="/src/main.ts" 指向 Vite 处理的入口 TS 文件 -->
  </body>
</html>
```

---

### 4.5 src/vite-env.d.ts

```ts
/// <reference types="vite/client" />
```

**这行代码是干什么的？**

这是一个**三斜线指令**（triple-slash directive）。它告诉 TypeScript 编译器："去加载 Vite 客户端提供的类型声明"。

Vite 的类型声明里包含了对 `.css`、`.svg`、`.png` 等文件的导入声明。没有这行，`main.ts` 里的 `import './style.css'` 会让 TypeScript 报错：

```
TS2882: Cannot find module or declarations for side-effect import of './style.css'.
```

**通俗理解：** 这行代码就是一个"通行证"，告诉 TypeScript："CSS 文件可以被 import，Vite 已经给你盖过章了，不要报错了。"

**`.d.ts` 是什么？** 这是 TypeScript 的"类型声明文件"，里面只有类型信息，没有可执行的代码。类比：它是说明书，不是产品本身。

---

### 4.6 src/types.ts

这个文件是**纯类型的**，编译后不产生任何 JavaScript 代码，只存在于编译阶段。

---

**文件头注释：**

```ts
/*
 * ========================================
 * 本文件展示 TypeScript 的核心类型系统
 * ========================================
 */
```

---

```ts
// ========== 1. 联合类型 & 字面量类型 ==========
// 用 | 符号连接多个类型，意味着值只能是其中之一
// 字面量类型：直接把具体的字符串值当成类型
export type Proficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';
```

**逐词解释：**

| 关键词 | 含义 |
|--------|------|
| `export` | 导出这个类型，其他文件可以通过 `import { Proficiency } from './types'` 使用它 |
| `type` | 定义一个**类型别名**（给一个类型起名字） |
| `Proficiency` | 类型名称（可以自定义，一般用 PascalCase 驼峰命名） |
| `=` | 把右边的类型赋给左边的名字 |
| `'beginner' \| 'intermediate' \| ...` | **联合类型 + 字面量类型** |

**为什么这样写？** 如果单单写 `string`，那么 `proficiency: string` 可以被赋值为任意字符串，包括 `"abc"` 这种无意义的值。用联合字面量类型限制了取值范围，编辑器会自动补全和校验。

**实际效果：**
```ts
const level: Proficiency = 'beginner';  // ✅ 正确
const level: Proficiency = 'expert';    // ✅ 正确
const level: Proficiency = 'abc';       // ❌ 报错：'abc' 不在类型联合中
```

---

```ts
// ========== 2. Enum（枚举）=========
// 枚举适合用在"一组有限的常量"的场景
// 编译后会生成对象，所以运行时也存在
export enum ThemeMode {
  Light = 'light',
  Dark = 'dark',
}
```

**逐词解释：**

| 关键词 | 含义 |
|--------|------|
| `enum` | 定义一个枚举 |
| `ThemeMode` | 枚举名称 |
| `Light = 'light'` | 枚举成员，`Light` 是名字，`'light'` 是值 |

**枚举 vs 联合类型：**
- 联合类型（`type Proficiency = 'a' | 'b'`）编译后**不存在**，只在类型检查阶段有用
- 枚举（`enum ThemeMode { ... }`）编译后**生成真正的 JS 对象**，运行时也能用

**编译后生成的 JS 代码：**
```js
var ThemeMode;
(function (ThemeMode) {
    ThemeMode["Light"] = "light";
    ThemeMode["Dark"] = "dark";
})(ThemeMode || (ThemeMode = {}));
```

**使用方式：**
```ts
const theme = ThemeMode.Light;  // 取值
console.log(theme);             // "light"
```

---

```ts
export interface Skill {
  name: string;
  proficiency: Proficiency; // 使用上面定义的联合类型
  years?: number;            // ? 表示可选属性 —— 这个字段可以不存在
}
```

**逐词解释：**

| 关键词 | 含义 |
|--------|------|
| `interface` | 定义一个接口——描述一个对象的"形状" |
| `Skill` | 接口名 |
| `name: string` | 属性 `name` 的类型是 `string` |
| `proficiency: Proficiency` | 属性 `proficiency` 的类型是上面定义的 `Proficiency` |
| `years?: number` | **`?`** 表示 `years` 是**可选属性**——这个对象可以有 `years`，也可以没有 |

**interface 和 type 的区别（重要）：**

| | `interface` | `type` |
|---|---|---|
| 描述对象形状 | ✅ | ✅ |
| 可以被继承/扩展 | ✅ `extends` | ❌ |
| 可以定义联合类型 | ❌ | ✅ `type A = string \| number` |
| 可以定义基础类型的别名 | ❌ | ✅ `type Name = string` |
| 同名会自动合并 | ✅ | ❌ |

**简单记忆：描述对象形状用 `interface`，其他用 `type`。**

---

接下来几个接口结构类似，一起解释：

```ts
export interface Experience {
  company: string;           // string 类型：公司名（字符串）
  role: string;              // string 类型：职位（字符串）
  startDate: string;         // 日期用字符串表示，如 '2023-03'
  endDate?: string;          // 可选：不写表示"至今"
  description: string;       // 工作描述
  highlights: readonly string[];
  // highlights 是一个 string 数组
  // readonly 表示这个数组本身不能被重新赋值
  // 比如 exp.highlights = [] 会报错
  // 但 exp.highlights[0] 可以读取
}

export interface Education {
  school: string;    // 学校名称
  degree: string;    // 学位（本科/硕士等）
  field: string;     // 专业
  startYear: number; // 入学年份
  endYear: number;   // 毕业年份
}

export interface SocialLink {
  platform: string;  // 平台名称
  url: string;       // 链接地址
  icon: string;      // 图标（emoji）
}
```

---

```ts
export interface Person {
  readonly id: string;
  // readonly：初始化后不能修改。person.id = 'xxx' 会报错。
  // 这相当于告诉团队："id 是唯一标识，创建后永远不要改"。

  name: string;
  title: string;     // 职位/头衔
  avatar?: string;   // 可选：头像 URL。没有的话用名字首字代替。
  bio: string;       // 个人简介
  skills: Skill[];   // Skill[] 是一个 Skill 类型的数组
  experience: Experience[];
  education: Education[];
  socialLinks: SocialLink[];
}
```

---

```ts
// ========== 5. 泛型接口 ==========
// <T> 是类型参数，类似于函数的形参，但传的是"类型"而不是"值"
export interface ApiResponse<T> {
  success: boolean;
  data: T;           // T 会被替换成实际的类型
  message?: string;
}
```

**泛型是什么？** 泛型就是"类型的占位符"。就像函数的参数 `(x)` 可以接收不同的值一样，泛型的 `<T>` 可以接收不同的类型。

**例子：**
```ts
// T = Person 时，这个接口相当于：
// { success: boolean; data: Person; message?: string }

// T = Skill[] 时，这个接口相当于：
// { success: boolean; data: Skill[]; message?: string }

// 同理 T 可以是任何类型，这让你写一个接口就能适用于所有场景
```

---

```ts
// ========== 6. 工具类型 ==========
// TypeScript 内置的类型变换工具

export type PersonUpdate = Partial<Person>;
// Partial<Person>：
// 把 Person 的所有属性变成可选
// 等效于 { id?: string; name?: string; title?: string; ... }
// 场景：编辑表单（用户只修改部分字段）

export type PersonCard = Pick<Person, 'name' | 'title' | 'avatar' | 'bio'>;
// Pick<Person, 'name' | 'title' | 'avatar' | 'bio'>：
// 从 Person 中只选取 name, title, avatar, bio 四个属性
// 场景：列表页的卡片（不需要完整信息）

export type PersonInput = Omit<Person, 'id'>;
// Omit<Person, 'id'>：
// 从 Person 中排除 id 属性
// 场景：创建新用户时，id 由后端生成，前端不需要传

export type SkillCategoryMap = Record<string, Skill[]>;
// Record<string, Skill[]>：
// 等价于 { [key: string]: Skill[] }
// 场景：按类别分组的技能，如 { '前端': [{...}], '后端': [{...}] }
```

---

### 4.7 src/data.ts

这个文件提供**数据**——张三的个人信息。

---

```ts
import type { Person, Skill, Experience, Education, SocialLink } from './types';
```

**逐词解释：**

| 部分 | 含义 |
|------|------|
| `import` | 导入 |
| `type` | 只导入类型（编译后不产生 JS 代码） |
| `{ Person, Skill, ... }` | 花括号里是从 `./types` 文件中导入的具体名称 |
| `from './types'` | 从 `types.ts` 文件导入。`./` 表示当前目录 |

**`import type` vs `import`：**

```ts
import type { Person } from './types';  // 只导入类型，编译后消失
import { person } from './data';        // 导入实际的值，编译后会保留
```

`import type` 是 TypeScript 的优化——既然类型在运行时不存在，就不要把它编译到 JS 里。

---

```ts
const age: number = 28;
const isOpenToWork: boolean = false;
```

**逐词解释：**

| 部分 | 含义 |
|------|------|
| `const` | 声明一个常量（不可重新赋值） |
| `age` | 变量名 |
| `: number` | **类型标注**——告诉 TS 这个变量是数字类型 |
| `= 28` | 赋值 |

**类型推断：** 实际上 `: number` 可以省略，因为 TypeScript 看到 `28` 就能推断出 `age` 是 `number` 类型。但显式标注能增加可读性。

---

```ts
const hobbies: string[] = ['摄影', '徒步', '玩桌游', '写博客'];
```

**`string[]` 是什么意思？** 就是"元素为字符串的数组"。

**两种等价的写法：**
```ts
string[]        // 语法糖，更常用
Array<string>   // 泛型写法，用到了 Array 这个泛型接口
```

---

```ts
const readonlyHobbies = ['摄影', '徒步', '玩桌游', '写博客'] as const;
```

**`as const` 做了什么？**

```ts
// 不加 as const
const hobbies = ['摄影', '徒步'];
// hobbies 的类型是 string[]
// hobbies[0] = 'abc'  ✅ 可以
// hobbies.push('新')  ✅ 可以

// 加了 as const
const readonlyHobbies = ['摄影', '徒步'] as const;
// readonlyHobbies 的类型是 readonly ["摄影", "徒步"]
// readonlyHobbies[0] = 'abc'  ❌ 报错
// readonlyHobbies.push('新')  ❌ 报错
```

`as const` 告诉 TypeScript："把这个值当成最具体、最不可变的类型"。适用场景：配置项、枚举值、不会变的数据。

---

```ts
const skills: Skill[] = [
  { name: 'TypeScript', proficiency: 'intermediate', years: 1 },
  { name: 'JavaScript', proficiency: 'advanced', years: 5 },
  // ...
];
```

**这里发生了什么？**
1. `const skills` 声明了一个变量
2. `: Skill[]` 注解了类型（Skill 数组）
3. 赋值为一个对象数组
4. TypeScript 会检查每个对象是否都满足 `Skill` 接口的定义
5. 如果某个对象少了 `name` 或多了不存在的属性，编辑器立刻标红

**`years: 0.5` 为什么能写小数？**
因为 `years?: number` 里 `number` 类型包含整数和小数。0.5 年 = 半年。

---

这一段解释了 Experience 数组中每个对象的含义：

```ts
{
  company: '字节跳动',
  role: '高级前端工程师',
  startDate: '2023-03',
  description: '负责内部组件库的维护与迭代，服务 20+ 业务线。',
  highlights: [
    '将组件库构建时间从 5 分钟优化到 30 秒',
    '主导 Monorepo 架构迁移',
    '推动团队代码规范落地，Code Review 覆盖率 100%',
  ] as const,
  // as const：这个数组的值不会变，类型推断会更精确
},
{
  company: '阿里巴巴',
  // ...
  endDate: '2023-02',
  // 这条有 endDate，表示已离职
  // 上一条没有 endDate，表示"至今"
},
```

---

```ts
export const person: Person = {
  id: 'p_001',      // readonly，创建后就不能改了
  name: '张三',
  // ...
};
```

**`export`**——把 `person` 导出，让 `main.ts` 可以 `import { person } from './data'`。

---

### 4.8 src/utils.ts

这个文件展示 TypeScript 函数的各种写法。

---

```ts
export function groupBy<T>(
  items: T[],
  key: keyof T,
): Record<string, T[]> {
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
```

**这个函数做什么？** 把一个数组按照某个属性分组：

```ts
const skills = [...];
const grouped = groupBy(skills, 'proficiency');
// 结果：{ beginner: [...], intermediate: [...], advanced: [...] }
```

**逐行解释：**

| 代码 | 含义 |
|------|------|
| `function groupBy<T>` | 定义泛型函数，`<T>` 是类型参数 |
| `(items: T[],` | 第一个参数：元素类型为 T 的数组 |
| `key: keyof T` | 第二个参数：必须是 T 的属性名之一。比如 T 是 `Skill`，那么 `key` 只能是 `'name'` 或 `'proficiency'` 或 `'years'` |
| `): Record<string, T[]>` | 返回值类型：一个以字符串为 key、T 数组为 value 的对象 |
| `{} as Record<string, T[]>` | `as` 是**类型断言**：告诉 TS "这个空对象就是我说的类型"。不加 `as` 的话，TS 认为 `{}` 是空对象，不能赋值 |
| `String(item[key])` | 把分组键转成字符串（比如 `years` 是数字，需要转） |
| `return result` | 返回分组结果 |

**`keyof` 的解释：**

```ts
// keyof Skill 的结果是：'name' | 'proficiency' | 'years'
// 所以 key 参数只能是这三个之一
// 你写 groupBy(skills, 'company') 会立刻报错，因为 'company' 不是 Skill 的属性
```

---

```ts
export function isAdvanced(skill: Skill): skill is Skill & { proficiency: 'advanced' | 'expert' } {
  return skill.proficiency === 'advanced' || skill.proficiency === 'expert';
}
```

**这是类型守卫（Type Guard）。**

**核心语法：** `参数名 is 类型`

```ts
// 在 main.ts 中调用：
if (isAdvanced(skill)) {
  // 在这个 if 块里，TS 知道 skill 的 proficiency 一定是 'advanced' 或 'expert'
  console.log(skill.proficiency);  // 类型被收窄为 'advanced' | 'expert'
}
```

**`skill is Skill & { proficiency: 'advanced' | 'expert' }`：**
- `is` 左边是参数名
- `is` 右边是更窄的类型（原始类型 + 更具体的 proficiency）
- 函数返回 `true` 时，TS 就认为 `skill` 是右边的类型

---

```ts
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
```

**`unknown` 是什么？** `unknown` 表示"我不知道这是什么类型"。

| 类型 | 含义 | 使用前需要 |
|------|------|-----------|
| `any` | 任意类型，关闭检查 | 不需要（不推荐使用） |
| `unknown` | 任意类型，但保持检查 | 必须先做类型检查（推荐） |

**示例：**
```ts
function process(val: unknown) {
  val.toUpperCase();  // ❌ 报错：类型 unknown 上不能直接用 toUpperCase
  if (isString(val)) {
    val.toUpperCase();  // ✅ 正确：TS 知道 val 是 string
  }
}
```

---

```ts
export function formatDate(dateStr: string, locale: string = 'zh-CN'): string {
  const [year, month] = dateStr.split('-');
  // 数组解构：把 split 返回的数组拆成两个变量
  const monthNames = ['1月', '2月', ...];
  const m = parseInt(month, 10);  // parseInt(str, 10) 把字符串转成十进制数字
  return `${year}年 ${monthNames[m - 1]}`;
}
```

**`locale: string = 'zh-CN'`** —— 参数带默认值，调用时可以不传：

```ts
formatDate('2023-03');               // 第二个参数用默认值 'zh-CN'
formatDate('2023-03', 'en-US');      // 显式传入第二个参数
```

---

```ts
export function concatUrl(base: string, ...paths: string[]): string {
  return [base, ...paths].join('/').replace(/([^:]\/)\/+/g, '$1');
}
```

**`...paths: string[]`** 是 **Rest 参数（剩余参数）**：

```ts
concatUrl('https://example.com', 'api', 'v1', 'users');
// base  = 'https://example.com'
// paths = ['api', 'v1', 'users']
// 结果  = 'https://example.com/api/v1/users'
```

---

```ts
export async function fetchPerson(): Promise<Person> {
  const { person } = await import('./data');
  await delay(800);
  return person;
}
```

**逐词解释：**

| 部分 | 含义 |
|------|------|
| `async` | 标记这是一个异步函数 |
| `function fetchPerson()` | 函数名。没有返回值类型，因为 async 函数自动返回 Promise |
| `: Promise<Person>` | 显式标注返回类型。`Promise<Person>` 表示一个"将来会返回 Person 对象"的承诺 |
| `await import('./data')` | **动态导入**：运行时才加载 `data.ts` |
| `await delay(800)` | 等待 800 毫秒（模拟网络延迟） |
| `return person` | 返回 Person 对象。async 函数自动把它包装成 Promise |

**async/await 是干什么的？**

```ts
// 不用 async/await（回调地狱）
fetchPerson().then(person => {
  console.log(person.name);
});

// 用 async/await（看起来像同步代码）
const person = await fetchPerson();
console.log(person.name);
```

`await` 会"暂停"当前函数的执行，等 Promise 完成后继续。代码读起来像同步的一样，但不会阻塞浏览器。

---

```ts
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**`Promise<void>`** 中的 `void` 表示这个 Promise 完成后没有返回值（只是等了 ms 毫秒）。

**`setTimeout`** 是浏览器/Node.js 的 API，`setTimeout(fn, ms)` 在 ms 毫秒后执行 `fn`。这里传入 `resolve` 作为回调，所以 ms 毫秒后 Promise 被 resolve。

---

```ts
export function formatExperienceDate(exp: Experience): string;
export function formatExperienceDate(start: string, end?: string): string;
export function formatExperienceDate(
  expOrStart: Experience | string,
  end?: string,
): string {
  if (typeof expOrStart === 'object') {
    // ...
  }
  // ...
}
```

**这是函数重载（Function Overload）：**

前两行是**重载签名**（只声明，不实现），告诉 TS 这个函数有两种调用方式：

1. 传入一个 `Experience` 对象 → 返回格式化后的日期字符串
2. 传入一个 `start` 字符串和可选的 `end` 字符串 → 返回格式化后的日期字符串

第三行开始是**实现签名**（真正执行的代码），参数类型要兼容所有重载。

---

```ts
export function getSkillLevel(years?: number): string {
  if (years === undefined) return '未知';
  if (years < 1) return '入门';
  if (years < 3) return '熟练';
  if (years < 5) return '精通';
  return '专家';
}
```

**`years?: number`** —— 参数是可选的，调用方可以不传。如果不传，`years` 的值是 `undefined`。

---

### 4.9 src/main.ts

这是**入口文件**——浏览器最终执行的就是这个文件里的代码。

---

```ts
import './style.css';
```

**这行是干什么的？** 导入 CSS 文件。

在普通 HTML 中，引用 CSS 是写 `<link rel="stylesheet" href="...">`。但 Vite 支持在 JS 中直接 `import` CSS 文件——Vite 会自动处理，把样式注入页面。

这是一个**副作用导入**（side-effect import），因为 CSS 没有 `export` 任何东西，我们导入它只是为了让它"生效"。

---

```ts
import type { Person, Skill, Experience, Education, SocialLink } from './types';
import { person } from './data';
import { groupBy, isAdvanced, formatExperienceDate, getSkillLevel, fetchPerson } from './utils';
```

这三行导入把其他文件的内容引入到当前文件：

| 导入来源 | 导入了什么 | 导入方式 |
|----------|-----------|---------|
| `./types` | 5 个类型 | `import type`（编译后消失） |
| `./data` | `person` 对象（值） | `import`（编译后保留） |
| `./utils` | 5 个函数（值） | `import`（编译后保留） |

**`./` 是什么意思？** 表示当前目录。`./data` 就是和 `main.ts` 同目录下的 `data.ts`。

---

```ts
const app = document.querySelector<HTMLDivElement>('#app')!;
```

**这是本文件最重要的行之一，展示了 TypeScript 在 DOM 操作中的三个关键点：**

| 部分 | 含义 |
|------|------|
| `document` | 浏览器全局对象，代表整个 HTML 文档 |
| `.querySelector()` | 用 CSS 选择器查找元素。`'#app'` 就是 id 为 `app` 的元素 |
| `<HTMLDivElement>` | **类型参数（泛型）**。TS 默认不知道 #app 是什么元素，通过泛型告诉它：这是一个 div |
| `!` | **非空断言**。`querySelector` 可能找不到元素（返回 `null`），`!` 告诉 TS："我确定它存在，忽略 null 的情况" |

**如果不加 `<HTMLDivElement>`：** TS 只知道 `app` 是 `Element` 类型，访问 `app.innerHTML` 可能报错。

**如果不加 `!`：** TS 会报错 `Object is possibly 'null'`，因为 `querySelector` 的返回类型是 `HTMLDivElement | null`。

---

```ts
function renderHeader(p: Person): string {
  const avatarContent = p.avatar
    ? `<img src="${p.avatar}" alt="${p.name}" class="avatar" />`
    : `<div class="avatar">${p.name.charAt(0)}</div>`;

  return `
    <div class="card header">
      ${avatarContent}
      <h1 class="name">${p.name}</h1>
      <p class="title">${p.title}</p>
      <div class="social-links">
        ${p.socialLinks.map(renderSocialLink).join('')}
      </div>
    </div>
  `;
}
```

**逐行解释：**

| 代码 | 含义 |
|------|------|
| `function renderHeader(p: Person): string` | 定义函数。参数 `p` 类型是 `Person`，返回类型是 `string` |
| `p.avatar ? ... : ...` | **三元运算符**。如果 `p.avatar` 有值（truthy），执行 `?` 后面的分支；否则执行 `:` 后面的分支 |
| `` `<img src="${p.avatar}" ...` `` | **模板字符串**（用反引号 `` ` `` 包裹）。`${}` 里面可以写 JS 表达式，结果会拼接到字符串中 |
| `p.name.charAt(0)` | 取名字的第一个字作为头像文字（如果没提供头像 URL） |
| `${p.socialLinks.map(renderSocialLink).join('')}` | 先对每个社交链接调用 `renderSocialLink` 返回 HTML 字符串，再用 `.join('')` 拼在一起 |
| `return \`...\`` | 返回拼接好的 HTML 字符串 |

---

```ts
function renderSkills(skills: Skill[]): string {
  const grouped = groupBy(skills, 'proficiency');

  return `
    <div class="card">
      <h2 class="section-title">🛠 技能</h2>
      <div class="skills-grid">
        ${skills.map((s) => {
            const label = isAdvanced(s) ? '🔥 精通' : getSkillLevel(s.years);
            return `<div class="skill-item">
                <span>${s.name}</span>
                <span class="skill-tag">${label}</span>
              </div>`;
          }).join('')}
      </div>
    </div>
  `;
}
```

**关键语法：**
- `skills.map((s) => { ... })` —— `map` 遍历数组，把每个元素转成新的值，返回新数组
- `(s) => { ... }` —— **箭头函数**，`s` 是参数（代指数组的每个元素）
- `isAdvanced(s) ? '🔥 精通' : getSkillLevel(s.years)` —— 使用类型守卫判断技能等级
- `.join('')` —— 把字符串数组用空字符串连接成一个字符串

---

```ts
function renderPage(p: Person): void {
  app.innerHTML = `
    <div class="container">
      ${renderHeader(p)}
      ${renderAbout(p)}
      ${renderSkills(p.skills)}
      ${renderExperience(p.experience)}
      ${renderEducation(p.education)}
      ${renderFooter()}
    </div>
  `;
}
```

**`: void` 是什么意思？** `void` 表示这个函数不返回任何值（只是做了一些事情，但没有 `return` 可以用的值）。

**`app.innerHTML = `** —— 把 HTML 字符串设置为 `#app` 元素的内容，浏览器会自动解析并渲染成页面。

---

```ts
async function init(): Promise<void> {
  app.innerHTML = '<div class="container"><div class="card" style="text-align:center">加载中...</div></div>';

  try {
    const data: Person = await fetchPerson();
    renderPage(data);
  } catch (error) {
    app.innerHTML = `
      <div class="container">
        <div class="card" style="text-align:center;color:red">
          加载失败：${error instanceof Error ? error.message : '未知错误'}
        </div>
      </div>
    `;
    console.error('个人页面加载失败:', error);
  }
}
```

**`try` / `catch` 是干什么的？**

```ts
try {
  // 尝试执行这里的代码
  // 如果出错，跳到 catch
} catch (error) {
  // 处理错误
  // error 是捕获到的错误对象
}
```

**`error instanceof Error`** 是运行时类型检查。`instanceof` 判断 `error` 是不是 `Error` 类的实例。如果是，读取 `error.message`；否则显示"未知错误"。

---

```ts
document.addEventListener('DOMContentLoaded', () => {
  init().then(() => {
    const header = document.querySelector<HTMLElement>('.header');
    header?.setAttribute('data-loaded', 'true');
  });
});
```

**逐词解释：**

| 代码 | 含义 |
|------|------|
| `document.addEventListener()` | 给整个文档添加一个"事件监听器" |
| `'DOMContentLoaded'` | 事件名称：DOM 树解析完成（但不一定所有图片都加载完） |
| `() => { ... }` | 事件触发时执行的回调函数 |
| `init()` | 调用 init 函数，返回一个 Promise |
| `.then(() => { ... })` | init 完成后执行的回调 |
| `document.querySelector<HTMLElement>('.header')` | 查找 class 为 `header` 的元素 |
| `header?.setAttribute(...)` | **可选链调用**：如果 `header` 存在，调用 `setAttribute`；如果不存在，什么都不做 |

**`.then()` 是 Promise 的链式调用：**

```ts
// 这两种写法等价：
init().then(() => { console.log('done'); });

// 或者
await init();
console.log('done');
```

**`header?.setAttribute()` —— 可选链（Optional Chaining）：**

```ts
// 不用可选链：
if (header !== null && header !== undefined) {
  header.setAttribute('data-loaded', 'true');
}

// 用可选链（更简洁）：
header?.setAttribute('data-loaded', 'true');
```

`?.` 前面的值如果是 `null` 或 `undefined`，整个表达式直接返回 `undefined`，不会继续调用。

---

### 4.10 src/style.css

CSS 文件不涉及 TypeScript，这里做简要解释：

```css
:root {
  --color-bg: #f5f5f7;
}
```

`--color-bg` 是 **CSS 自定义属性（CSS 变量）**。定义在 `:root` 下表示全局可用。其他选择器通过 `var(--color-bg)` 引用。

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

`*` 是**通配符**——选中所有元素。这四行是"CSS Reset"（样式重置），清除浏览器的默认样式，所有边距从零开始。

```css
.container {
  max-width: var(--max-width);
  margin: 0 auto;
}
```

`margin: 0 auto` 让容器水平居中。

```css
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}
```

`display: grid` 启用 CSS Grid 布局。`repeat(auto-fill, minmax(180px, 1fr))` 表示：自动填充列，每列最小 180px，最大 1fr（均分剩余空间）。

```css
.card {
  animation: fadeIn 0.5s ease both;
}
```

每个卡片有淡入动画。`nth-child(2)` 到 `nth-child(5)` 设置了不同的延迟，让卡片依次出现。

---

### 4.11 .gitignore

```
node_modules
dist
```

这两行告诉 Git：不要追踪这两个文件夹。

- `node_modules`：npm 安装的依赖，体积大，可随时用 `npm install` 重新下载
- `dist`：构建输出，可以随时用 `npm run build` 重新生成

---

## 第五部分：核心概念字典

| 概念 | 一句话解释 | 在哪学的 |
|------|-----------|---------|
| **类型标注** | `变量: 类型 = 值`，告诉 TS 这个变量是什么类型 | data.ts |
| **基础类型** | `string`, `number`, `boolean`, `Date` | types.ts |
| **数组** | `string[]` 或 `Array<string>` | data.ts |
| **接口 `interface`** | 定义对象的形状（有哪些属性、各自是什么类型） | types.ts |
| **类型别名 `type`** | 给一个类型起名字 | types.ts |
| **联合类型 `\|`** | 值可以是类型 A 或类型 B | types.ts |
| **字面量类型** | 把具体的值当成类型 | types.ts |
| **可选属性 `?`** | 这个属性可以不存在 | types.ts |
| **`readonly`** | 初始化后不能修改 | types.ts, data.ts |
| **枚举 `enum`** | 一组命名常量的集合 | types.ts |
| **泛型 `<T>`** | 类型的占位符，使用时再指定具体类型 | types.ts, utils.ts |
| **`keyof`** | 取一个类型的所有属性名组成的联合类型 | utils.ts |
| **类型守卫 `is`** | 在 if 分支中收窄类型 | utils.ts |
| **`unknown`** | 安全的"任意类型"，需要检查后才能用 | utils.ts |
| **类型断言 `as`** | 告诉 TS "我知道这是什么类型" | utils.ts |
| **非空断言 `!`** | 告诉 TS "我确定这个值不是 null" | main.ts |
| **可选链 `?.`** | 安全访问可能为 null 的属性/方法 | main.ts |
| **`as const`** | 把值推断为最窄的、不可变的类型 | data.ts |
| **函数重载** | 同一函数对不同参数返回不同类型 | utils.ts |
| **Rest 参数 `...`** | 把多个参数收集成一个数组 | utils.ts |
| **`Promise<T>`** | 一个"将来会返回 T 类型值"的承诺 | utils.ts |
| **`async/await`** | 用同步写法处理异步操作 | utils.ts, main.ts |
| **`Event` 类型** | 给事件处理函数标注类型 | main.ts |
| **`import type`** | 只导入类型，编译后消失 | main.ts, data.ts |
| **模板字符串** | 用反引号和 `${}` 拼接 HTML | main.ts |
| **`try/catch`** | 捕获并处理错误 | main.ts |
| **`Partial<T>`** | 把 T 的所有属性变成可选 | types.ts |
| **`Pick<T, K>`** | 从 T 中只选 K 指定的属性 | types.ts |
| **`Omit<T, K>`** | 从 T 中排除 K 指定的属性 | types.ts |
| **`Record<K, V>`** | 创建一个 key 为 K、value 为 V 的对象类型 | types.ts |

---

**恭喜！** 到这里你已经读完了一个完整 TypeScript + Vite 项目的每一行代码。建议的下一步：

1. 在浏览器运行 `npm run dev`，打开页面
2. 尝试修改 `data.ts` 中的内容（改成你自己的名字、技能等）
3. 尝试给 `Person` 接口新增一个属性（比如 `hobbies: string[]`），观察 TS 如何提示你还缺了什么
4. 在 `types.ts` 中新定义一个接口，并在 `data.ts` 中使用
