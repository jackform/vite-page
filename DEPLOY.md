# GitHub Pages 自动部署方案

## 背景

之前的做法是在本地 `npm run build` 后，把 `dist/` 产物推送到 `gh-pages` 分支，GitHub Pages 从这个分支部署。

现在希望：**push 代码到 main 分支后，GitHub Actions 自动构建并部署**，不再需要手动操作。

## 方案概览

使用 GitHub Actions + GitHub Pages 官方 Action（`actions/deploy-pages`），不依赖 `gh-pages` 分支。

### 工作流程

1. 推送代码到 `main` 分支
2. GitHub Actions 触发 `.github/workflows/deploy.yml`
3. Workflow 执行：checkout → 安装 Node.js → 安装依赖 → 构建 → 部署到 GitHub Pages
4. 站点自动更新

## 实施步骤

### 1. 创建 GitHub Actions Workflow

创建 `.github/workflows/deploy.yml`，内容如下：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

# 设置 GITHUB_TOKEN 权限
permissions:
  contents: read
  pages: write
  id-token: write

# 确保同一时间只有一个部署任务
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 2. 修改 GitHub Pages 源设置

在 GitHub 仓库的 **Settings → Pages** 中：

- **Source** 选择 **GitHub Actions**

（不需要再选择 gh-pages 分支）

### 3. 推送代码验证

将 workflow 文件和代码一起推到 main 分支，GitHub Actions 会自动开始构建部署。

## 新旧方案对比

| | 旧方案 (gh-pages 分支) | 新方案 (GitHub Actions) |
|---|---|---|
| 触发方式 | 手动 build + 手动 push | 推送 main 自动触发 |
| 部署源 | gh-pages 分支的根目录 | Actions 上传的 artifact |
| 维护成本 | 每次改完都要 build + push | 无需手动操作 |
| 分支管理 | 需要维护额外分支 | 只需 main 分支 |

## 注意事项

- `vite.config.ts` 中的 `base: '/vite-page/'` 保持不变，产物路径前缀正确
- 仓库的 GitHub Pages 源必须切换为 **GitHub Actions**（一次性操作）
- 如果仓库是私有的，需要确认 GitHub Pages 在私有仓库中是否可用（免费版不支持）
- 旧的 `gh-pages` 分支在新方案生效后可以删除
