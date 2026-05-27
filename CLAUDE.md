# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Vite dev server (HMR, port 5173)
npm run build         # tsc type-check + vite build → dist/
npm run preview       # Preview production build locally
npm run server:dev    # Start backend dev server (tsx watch, port 3001)
npm run server:build  # Compile server TypeScript → server/dist/
```

No test runner or linter is configured.

## Architecture

Four standalone pages, no framework — TypeScript manipulating the DOM via `innerHTML` and template strings. Dependencies: `vite`, `codemirror` + `@codemirror/*`.

`vite.config.ts` multi-page build has four entries: `index.html`, `poster.html`, `code.html`, `teacher.html`. Base path is `/vite-page/` (for GitHub Pages). Dev server proxies `/socket.io` to `localhost:3001` so the Socket.io client connects to the same origin. `npm run build` runs `tsc && vite build`.

### Backend (`server/`)

Node.js + Express + Socket.io server that powers the real-time student-teacher system. Compiles to `server/dist/server/src/`. ESM with `.js` extensions required on all local imports (`import { x } from './foo.js'`). Run with `node dist/server/src/index.js` in production.

**Key files:**
- `server/src/index.ts` — Express app, Socket.io setup, serves frontend `dist/` (tries multiple candidate paths), health endpoint at `/health`
- `server/src/handlers.ts` — all Socket.io event handlers (see protocol below)
- `server/src/room-manager.ts` — tracks student sessions (socketId → record with `currentCode`, `lastExecution` snapshots)
- `server/src/auth.ts` — constant-time teacher password validation against `TEACHER_PASSWORD` env var

**Env vars:** `PORT` (default 3001), `TEACHER_PASSWORD`, `CORS_ORIGIN` (comma-separated, defaults to `*`).

**Socket.io event protocol:**

| Event | Direction | Purpose |
|---|---|---|
| `student:register` | Student → Server | Join with `{ name, studentId }` |
| `session:registered` | Server → Student | Confirmed with `{ roomId, userId }` |
| `code:update` | Student → Server | Debounced code change |
| `code:broadcast` | Server → Teacher | Pushed to subscribed teachers |
| `execution:result` | Student → Server | After running code |
| `execution:broadcast` | Server → Teacher | Forwarded to subscribed teachers |
| `teacher:auth` | Teacher → Server | Password authentication |
| `room:subscribe` / `room:unsubscribe` | Teacher → Server | Watch/unwatch a student |
| `roster:update` | Server → Teacher | Full student list |

Server stores latest code and execution result per student in `RoomManager`. When a teacher subscribes to a room, the cached state is sent immediately.

### Coding lab page (`code.html` → `src/code.ts`)

A LeetCode-style Python coding platform with CodeMirror 6 editor, Pyodide-based Python execution in a Web Worker, real-time code sync to backend, and a test runner. Chinese-localized (zh-HK), dark theme.

**Lifecycle:** `DOMContentLoaded` → renders registration overlay (name + studentId) → on submit, `CodeSocket.register()` connects to backend via Socket.io → on success, renders editor layout, mounts CodeMirror, loads Pyodide, wires Run/Tests buttons.

**Source modules (all prefixed `code-`):**
- `src/code-types.ts` — types for CodeProblem, TestCase, ExecutionResult, SessionConfig, etc.
- `src/code-problems.ts` — hardcoded problems (Two Sum, FizzBuzz) with starter code and test cases
- `src/code-session.ts` — `CodeSession` class wraps local code state and syncs to server via `CodeSocket`. `updateCode()` sends `code:update` over socket. Student does NOT listen to `code:broadcast` (only teacher does).
- `src/code-socket.ts` — Socket.io client wrapper. `register(identity)` connects and waits for `session:registered`. `sendCodeUpdate()`, `sendExecutionResult()`, `onDisconnect()`/`onConnect()` for built-in events. Uses `VITE_SERVER_URL` env var or falls back to `window.location.origin`.
- `src/code-editor.ts` — CodeMirror 6 wrapper with Python mode, indentWithTab. Exposes `getCode()`, `setCode()`, `onChange()` (debounced 300ms), `setTheme(isLight)`. Constructor accepts optional `readOnly` and `isLight` booleans. Theme is switched dynamically via a `Compartment` — no editor re-creation needed.
- `src/code-executor.ts` — manages Pyodide Web Worker. Handles execute and runTests with timeouts; on timeout terminates and auto-recreates the worker.
- `src/code-output.ts` — shared `renderOutput()`, `renderOutputLoading()`, `escapeHtml()` used by both student and teacher pages.
- `src/code.css` — dark theme CSS, registration overlay styles.

**Web Worker** (`public/code-worker.js`): Classic worker using `importScripts` to load Pyodide from CDN. Placed in `public/` so Vite serves it as-is without processing.

### Teacher dashboard (`teacher.html` → `src/teacher.ts`)

Real-time student monitoring page. Dark theme matching code.css.

**Lifecycle:** `DOMContentLoaded` → auth overlay (password form) → on success, renders dashboard: sidebar roster panel + main monitor area with read-only CodeMirror viewer and execution output panel.

- Roster updates via `roster:update` events. Click a student to subscribe to their room.
- Code viewer: read-only `CodeEditor` instance, updates on `code:broadcast`.
- Execution output rendered with shared `renderOutput()` from `code-output.ts`.
- Reconnect: re-authenticates and re-subscribes to selected room.

### Main profile page (`index.html` → `src/main.ts`) and Poster page (`poster.html` → `src/poster.ts`)

Static pages — see git history for unchanged architecture.

### Shared types (`shared/types.ts`)

Socket event payload types used by both frontend and backend: `StudentIdentity`, `SessionInfo`, `RosterEntry`, `RemoteExecutionResult`, `AuthRequest`/`AuthResult`, plus `ServerToClientEvents`/`ClientToServerEvents` interfaces for typed Socket.io usage.

The main `tsconfig.json` includes `"src"` and `"shared"` so frontend code can import from `../shared/types`.

## Deployment

**Frontend (GitHub Pages):** Push to `main` triggers `.github/workflows/deploy.yml`. Set `VITE_SERVER_URL` in GitHub Actions Variables to point to the backend server.

**Backend (standalone server):** Clone repo, `npm install && cd server && npm install`, `npx vite build && npm run server:build`, then `cd server && node dist/server/src/index.js`. The server serves frontend static files from `dist/` so a single port handles everything. Requires Node ≥20 (use `unofficial-builds.nodejs.org` glibc-217 builds for older Ubuntu).

### Theme system

Both `code.html` and `teacher.html` support light/dark theme toggle. CSS custom properties on `:root` define the dark palette; `[data-theme="light"]` overrides them with a light palette. Theme state is persisted to `localStorage` under key `python-lab-theme`. The toggle button (☀/🌙 in the nav bar) flips `document.documentElement.dataset.theme` between `"light"` and absent (dark). `CodeEditor.setTheme(isLight)` syncs the CodeMirror instance to the current theme via a Compartment swap.

This is a TypeScript learning/demo project — the verbose comments explaining TS concepts (type guards, function overloads, `as const`, generics) are intentional. Do not remove or shorten them.
