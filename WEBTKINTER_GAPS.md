# Webtkinter — tkinter Compatibility Gaps

本文档记录了 webtkinter 与标准 tkinter 之间的差异。所有参数均被接受（不会报错），但部分参数在渲染时被忽略或仅做空实现。

## Widget 通用参数

| tkinter 参数 | 状态 | 说明 |
|---|---|---|
| `font=(family, size, style)` | 部分支持 | family/size/bold 映射到 CSS font；italic/underline/overstrike 不支持 |
| `bg` | 支持 | 映射到 CSS `background-color` |
| `fg` | 支持 | 映射到 CSS `color` |
| `width` | 部分支持 | 字符宽度单位，近似映射到 CSS `ch` 单位 |
| `height` | 部分支持 | 行高单位，近似映射到 CSS `em` 单位 |
| `justify` | 支持 | left/center/right 映射到 CSS `text-align` |
| `relief` | 不支持 | CSS box-shadow 无法完全模拟 raised/sunken/groove/ridge 效果 |
| `padx/pady` (构造参数) | 不支持 | 建议使用 pack/grid 的 padx/pady |
| `cursor` | 不支持 | 鼠标指针样式，web 环境中意义有限 |
| `state` | 部分支持 | `disabled` 映射到 `readOnly`；`normal` 为默认行为 |
| `anchor` | 不支持 | 文本对齐方向 |
| `image` | 不支持 | 图片嵌入需要额外设计 |
| `textvariable` | 不支持 | Tkinter 变量绑定机制不在 web 环境中实现 |

## Widget 通用方法

| tkinter 方法 | 状态 | 说明 |
|---|---|---|
| `.pack()` | 支持 | side/fill/padx/pady 已映射。expand/anchor/ipadx/ipady 不支持 |
| `.grid()` | 部分支持 | row/column/padx/pady 已映射。sticky/columnspan/rowspan/weight 不支持 |
| `.place()` | 不支持 | 绝对定位与响应式 web 设计理念冲突 |
| `.configure()` / `.config()` | 部分支持 | 已知属性可更新；未知属性存储但无渲染效果 |
| `.bind(event, callback)` | 部分支持 | `<Button-1>`→click, `<Enter>`→mouseenter, `<Leave>`→mouseleave。`<Key>`, `<Motion>`, `<B1-Motion>` 等不支持 |
| `.destroy()` | 支持 | 移除 DOM 元素 |
| `.winfo_*()` 系列 | 不支持 | 窗口信息查询，web 环境无可查询的本机窗口系统 |
| `.focus_set()` | 不支持 | 可后续通过 DOM focus() 实现 |
| `.cget()` | 不支持 | 可通过 `_props` 访问但无公开 API |
| `.keys()` | 不支持 | 同上 |

## Tk (主窗口)

| tkinter 方法 | 状态 | 说明 |
|---|---|---|
| `Tk()` | 支持 | 创建 root 容器 |
| `.title(text)` | 部分支持 | 标题显示在 root 容器标题栏中，不修改浏览器 tab 标题 |
| `.geometry(geom)` | 部分支持 | 解析 `"WxH"` 格式，设置容器宽高 |
| `.configure(bg=...)` | 支持 | 设置背景色 |
| `.mainloop()` | 空实现 | web 环境无需事件循环，代码执行完毕后自动渲染 |
| `.destroy()` | 空实现 | 清除 root 容器 |
| `.withdraw()` | 不支持 | 窗口隐藏 |
| `.iconify()` | 不支持 | 窗口最小化 |
| `.resizable()` | 不支持 | 窗口大小可调性 |
| `.maxsize()` / `.minsize()` | 不支持 | 窗口大小限制 |

## Toplevel (弹窗)

| tkinter 方法 | 状态 | 说明 |
|---|---|---|
| `Toplevel(parent)` | 支持 | 渲染为 fixed 定位的浮层弹窗 |
| `.title(text)` | 支持 | 显示在弹窗标题栏 |
| `.geometry(geom)` | 部分支持 | 解析 `"WxH"` 格式 |
| `.mainloop()` | 空实现 | 同 Tk |
| `.destroy()` | 支持 | 关闭弹窗（点击 ✕ 按钮或调用 destroy） |
| `.transient()` | 不支持 | 设置弹窗的临时父窗口关系 |
| `.grab_set()` | 不支持 | 模态锁定，web 中通过 overlay 背景实现类似效果 |

## Frame / LabelFrame

| tkinter 方法 | 状态 | 说明 |
|---|---|---|
| `Frame(parent, bg=...)` | 支持 | 渲染为 `<div>` 容器 |
| `LabelFrame(parent, text=..., bg=..., fg=..., font=...)` | 支持 | 渲染为 `<fieldset>` + `<legend>` |
| 通用方法（pack/grid/configure） | 同上 | 见 Widget 通用方法表 |

## Label

| tkinter 参数 | 状态 | 说明 |
|---|---|---|
| `text` | 支持 | |
| `font, bg, fg, justify` | 支持 | 见 Widget 通用参数表 |
| `image` | 不支持 | 图片标签 |
| `compound` | 不支持 | 图文混排方式 |
| `wraplength` | 不支持 | 自动换行宽度 |

## Button

| tkinter 参数 | 状态 | 说明 |
|---|---|---|
| `text` | 支持 | |
| `command` | 支持 | 点击回调 |
| `font, bg, fg, width` | 支持 | 见 Widget 通用参数表 |
| `image` | 不支持 | 图片按钮 |
| `activebackground/activeforeground` | 不支持 | 可通过 CSS `:active` 伪类实现 |
| `disabledforeground` | 不支持 | 可通过 CSS 实现 |

## Entry

| tkinter 参数/方法 | 状态 | 说明 |
|---|---|---|
| `font, width, justify` | 支持 | 见 Widget 通用参数表 |
| `.insert(pos, text)` | 支持 | |
| `.get()` | 支持 | |
| `.delete(pos1, pos2)` | 支持 | 清除全部内容（忽略位置参数） |
| `show` (密码输入) | 不支持 | 可通过 HTML `type="password"` 实现 |
| `state="readonly"` | 不支持 | 仅支持 disabled 状态 |
| `validate` / `validatecommand` | 不支持 | 输入验证回调 |

## Text

| tkinter 参数/方法 | 状态 | 说明 |
|---|---|---|
| `font, width, height, bg, fg` | 支持 | 见 Widget 通用参数表 |
| `.insert(pos, text)` | 支持 | |
| `.get(pos1, pos2)` | 支持 | |
| `.delete(pos1, pos2)` | 支持 | 清除全部内容（忽略位置参数） |
| `.config(state="disabled")` | 支持 | 设置 readOnly |
| `wrap` | 不支持 | 换行模式 |
| `yscrollcommand` | 不支持 | 滚动条绑定 |
| `tag_*()` 系列 | 不支持 | 文本标记和样式 |
| `undo` | 不支持 | 撤销功能 |
| `spacing1/2/3` | 不支持 | 行间距 |

## messagebox

| tkinter 方法 | 状态 | 说明 |
|---|---|---|
| `showwarning(title, message)` | 支持 | 使用浏览器 `alert()` 实现 |
| `showinfo(title, message)` | 支持 | 使用浏览器 `alert()` 实现 |
| `showerror(title, message)` | 未实现 | 可类似实现 |
| `askyesno(title, message)` | 不支持 | 浏览器 `confirm()` 会阻塞同步 Python 执行，需要异步方式 |
| `askquestion(title, message)` | 不支持 | 同上 |
| `askokcancel(title, message)` | 不支持 | 同上 |

## 未实现的 tkinter 组件

以下组件在音乐转换器和消息加密器中未使用，但也未实现：

- `Canvas` — 需要 HTML5 Canvas 桥接
- `Scrollbar` — 可用 CSS `overflow: auto` 替代
- `Listbox` — 需要 `<select>` 组件
- `Combobox` / `ttk.Combobox` — 需要自定义下拉组件
- `Menu` — 需要自定义菜单系统
- `Radiobutton` — 需要 `<input type="radio">` 组件
- `Checkbutton` — 需要 `<input type="checkbox">` 组件
- `Scale` — 需要 `<input type="range">` 组件
- `Spinbox` — 需要 `<input type="number">` 组件
- `ttk.Notebook` — Tab 组件
- `ttk.Treeview` — 树形/表格组件
- `ttk.Progressbar` — 进度条
- `PanedWindow` — 分割面板

## 设计说明

webtkinter 的设计原则：
1. **接受所有参数** — 所有 tkinter 兼容参数都被存储在 `_props` 中，Python 侧不会因为参数不支持而报错
2. **静默忽略** — JS 渲染器只处理能映射到 CSS/DOM 的属性，其余忽略
3. **空实现方法** — 对于 web 环境无法实现的方法（如 `mainloop()`），提供空实现确保调用不报错
4. **渐进增强** — 优先支持两个目标应用使用的 API，其他 API 按需添加
