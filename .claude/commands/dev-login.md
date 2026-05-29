---
name: dev-login
description: Start dev servers and log into the student and teacher sides
---

# Dev Login Skill

Start the project's dev servers and use Playwright MCP to log into both the student and teacher sides.

## Usage

Invoke this skill with:
```
/dev-login [studentName] [studentId]
```

If no arguments are provided, defaults to `Alice` / `001`.

## Steps

### 1. Start dev servers

Check if the backend (port 3001) is already running. If not, start it:

```bash
cd /Users/luoliren/Workspace/claude_code_demo/vite-page && npm run server:dev &
```

Check if the Vite dev server (port 5173) is already running. If not, start it:

```bash
cd /Users/luoliren/Workspace/claude_code_demo/vite-page && npm run dev &
```

Wait for both servers to be ready (backend responds to `/health`, Vite responds on port 5173).

### 2. Open student page and register

- Navigate to `http://localhost:5173/vite-page/code.html`
- Fill in the registration form:
  - 姓名 Name: `{studentName}` (default: `Alice`)
  - 學生編號 Student ID: `{studentId}` (default: `001`)
- Click "加入課堂"
- Wait for registration to complete

### 3. Open teacher page and login

- Open a new tab and navigate to `http://localhost:5173/vite-page/teacher.html`
- Fill in 密碼 Password: `test` (any value works when TEACHER_PASSWORD env is not set)
- Click "登入"
- Wait for dashboard to load

### 4. Select student

- Click the student's name in the roster list
- Verify the code monitor view appears with:
  - 鎖定編輯 button in the code toolbar
  - Push bar with problem dropdown
  - 代碼監控 / 指導編輯 view tabs
  - 輸出 / 訊息 chat tabs

### 5. Confirm

- Report: student count, selected student name, connection status
- Take a screenshot for visual verification
