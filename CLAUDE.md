# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Vite dev server (HMR, port 5173)
npm run build         # tsc type-check + vite build → dist/
npm run preview       # Preview production build locally
npm run server:dev    # Start backend dev server (tsx watch, port 3001)
npm run server:build  # Compile server TypeScript → server/dist/
npm run server:start  # Start backend in production mode
npm test              # Run all Vitest unit tests
npm run test:watch    # Vitest in watch mode
npm run test:coverage # Vitest with coverage report (v8 provider)
npx playwright test   # Run E2E tests (auto-starts dev servers)
```

### Running specific tests

```bash
npx vitest run src/chat/__tests__/chat-client.test.ts   # Single Vitest file
npx playwright test tests/chat.e2e.ts -g "teacher sends" # Single E2E test by name
npx playwright test --headed --debug                      # E2E with browser visible
```

## Test setup

**Vitest** (unit/integration): Config in `vitest.config.ts`. Uses `globals: true`, `environment: 'node'` by default. Browser tests use per-file `@vitest-environment jsdom` comments. Test files follow `*.test.ts` pattern.

**Playwright** (E2E): Config in `playwright.config.ts`. Tests live in `tests/`. Web server config auto-starts both the backend (port 3001) and frontend (port 5173) dev servers with `reuseExistingServer: true`.

## Architecture

Four standalone pages, no framework — TypeScript manipulating the DOM via `innerHTML` and template strings.

`vite.config.ts` multi-page build has four entries: `index.html`, `poster.html`, `code.html`, `teacher.html`. Base path is `/vite-page/` (for GitHub Pages). Dev server proxies `/socket.io` and `/api` to `localhost:3001`. `npm run build` runs `tsc && vite build`.

Frontend dependencies: `vite`, `codemirror` + `@codemirror/*`, `socket.io-client`, `marked`, `skulpt`. Dev/test dependencies: `vitest`, `@playwright/test`, `jsdom`.

### Backend (`server/`)

Node.js + Express + Socket.io server that powers the real-time student-teacher system. Compiles to `server/dist/`. ESM with `.js` extensions required on all local imports (`import { x } from './foo.js'`). Run with `node dist/index.js` in production.

**Key files:**
- `server/src/index.ts` — Express app, Socket.io setup, serves frontend `dist/` (tries multiple candidate paths), health endpoint at `/health`
- `server/src/handlers.ts` — all Socket.io event handlers (see protocol below)
- `server/src/room-manager.ts` — tracks student sessions (socketId → record with `currentCode`, `lastExecution` snapshots)
- `server/src/auth.ts` — constant-time teacher password validation against `TEACHER_PASSWORD` env var
- `server/src/chat-store.ts` — in-memory store of chat messages per room (`addMessage`, `getHistory`)
- `server/src/chat-handlers.ts` — `chat:send` handler with validation (text ≤2000 chars, image ≤600KB), routes messages to the correct room

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
| `problem:push` | Teacher → Server | Push a problem to one student's inbox |
| `problem:push-all` | Teacher → Server | Push a problem to all connected students |
| `problem:assigned` | Server → Student | New problem arrived in inbox |
| `chat:send` | Both → Server | Send a chat message `{ roomId, sender, text?, imageUrl? }` |
| `chat:message` | Server → Both | Broadcast a message to the room |
| `chat:history` | Server → Both | Full history delivered on subscribe (one-shot) |

Server stores latest code and execution result per student in `RoomManager` (also caches `assignedProblem`). When a teacher subscribes to a room, the cached state (code, execution, assigned problem, chat history) is sent immediately.

### Chat module (`src/chat/`)

Real-time text messaging between teacher and student within a monitored room. Chinese-localized UI.

**Components:**
- `src/chat/chat-client.ts` — `ChatClient` class wraps socket events. Constructor takes socket, roomId, senderType. Methods: `sendMessage(text?, imageUrl?)`, `onMessage(handler)`, `onHistory(handler)` (one-shot), `destroy()`. Filters incoming messages/history by roomId.
- `src/chat/chat-ui.ts` — DOM helpers: `createChatTabs(onChange)` renders a two-tab bar (輸出/訊息), `createChatPanel(senderType, onSend)` renders message list + input (Enter to send), `appendMessage()`, `renderHistory()`, `clearChat()`.
- `src/chat/chat.css` — chat panel styling, message bubbles (`.mine`/`.theirs` alignment), input area, empty state.
- `src/chat/__tests__/` — Vitest tests for ChatClient (event emission/listening/cleanup) and ChatUI (tab switching, message rendering, history, empty state). Uses jsdom environment.
- `tests/chat.e2e.ts` — Playwright E2E tests covering bidirectional messaging, tab switching, student switching.

**Server side:**
- `server/src/chat-store.ts` — `ChatStore` class: `addMessage(partial)` generates id+timestamp and stores per room, `getHistory(roomId)` returns a copy of all messages.
- `server/src/chat-handlers.ts` — `registerChatHandlers()` validates incoming messages (must have text or imageUrl, text ≤2000 chars, imageUrl ≤600KB), determines sender identity and target room, stores message, broadcasts to room.
- `server/src/__tests__/chat-store.test.ts` — Tests for message creation, per-room isolation, edge cases.
- `server/src/__tests__/chat-handlers.test.ts` — Tests for validation rules, permission logic, message flow.

The `ChatMessage` type (in `shared/types.ts`) has `id`, `roomId`, `sender` (`'student' | 'teacher'`), optional `text` and `imageUrl`, and `timestamp`.

### Coding lab page (`code.html` → `src/code.ts`)

A LeetCode-style Python coding platform with CodeMirror 6 editor, Pyodide-based Python execution in a Web Worker, real-time code sync to backend, and a test runner. Chinese-localized (zh-HK), dark/light theme.

**Lifecycle:** `DOMContentLoaded` → renders registration overlay (name + studentId) → on submit, `CodeSocket.register()` connects to backend via Socket.io → on success, loads problem list from `GET /api/problems`, renders editor layout, mounts CodeMirror, loads Pyodide, wires Run/Tests buttons.

**Source modules (all prefixed `code-`):**
- `src/code-types.ts` — types for CodeProblem, TestCase, ExecutionResult, SessionConfig, etc.
- `src/code-problems.ts` — hardcoded fallback problems, used only when the API is unreachable.
- `src/code-session.ts` — `CodeSession` class wraps local code state and syncs to server via `CodeSocket`. `updateCode()` sends `code:update` over socket. Student does NOT listen to `code:broadcast` (only teacher does).
- `src/code-socket.ts` — Socket.io client wrapper. `register(identity)` connects and waits for `session:registered`. Generic `on`/`off` methods for typed event listening (used for `problem:assigned`). Uses `VITE_SERVER_URL` env var or falls back to `window.location.origin`.
- `src/code-editor.ts` — CodeMirror 6 wrapper with Python mode, indentWithTab. Exposes `getCode()`, `setCode()`, `onChange()` (debounced 300ms), `setTheme(isLight)`. Constructor accepts optional `readOnly` and `isLight` booleans. Theme is switched dynamically via a `Compartment` — no editor re-creation needed. Also used by `ProblemManager` in teacher page.
- `src/code-executor.ts` — manages Pyodide Web Worker. Handles execute and runTests with timeouts; on timeout terminates and auto-recreates the worker.
- `src/code-output.ts` — shared `renderOutput()`, `renderOutputLoading()`, `escapeHtml()` used by both student and teacher pages.
- `src/code.css` — dark/light theme CSS, registration overlay styles, notification toast (`.lab-notification`).

**Web Worker** (`public/code-worker.js`): Classic worker using `importScripts` to load Pyodide from CDN. Placed in `public/` so Vite serves it as-is without processing.

**Problem loading:** On init, fetches `GET /api/problems` for the full list (storing metadata for the dropdown), then `GET /api/problems/:id` for the first problem's full content. Additional problems load on demand when selected from the dropdown. `marked` renders Markdown descriptions with GFM line breaks. A `problem:assigned` Socket listener handles teacher-pushed problems by adding them to the local cache and switching immediately.

### Teacher dashboard (`teacher.html` → `src/teacher.ts` + `src/problem-manager.ts`)

Real-time student monitoring page with two-tab layout: "學生監控" and "題目管理". Dark/light theme.

**Lifecycle:** `DOMContentLoaded` → auth overlay (password form) → on success, renders dashboard with tab bar. Monitor tab active by default; problem tab lazily initializes `ProblemManager` on first click.

**Monitor tab:**
- Sidebar roster panel (updates via `roster:update`). Click a student to subscribe to their room.
- Push bar below student info: dropdown to select a problem (populated from `ProblemManager.getProblems()`), "推送給此學生" and "推送給所有學生" buttons.
- Read-only `CodeEditor` viewer, updates on `code:broadcast`.
- Execution output rendered with shared `renderOutput()` from `code-output.ts`.
- Chat panel: tab bar (輸出/訊息) switches between execution output and chat. `ChatClient` handles messaging with the selected student.

**Problem management tab:**
- `ProblemManager` class (`src/problem-manager.ts`) — standalone component with three-column layout: problem list sidebar | edit form | live preview.
- Edit form fields: title, difficulty, category, tags, description (Markdown textarea), examples/constraints/testCases (dynamic add/remove rows), starter code (`CodeEditor`), solution & hints (collapsible details).
- Markdown preview rendered via `marked.parse()` with GFM line breaks enabled.
- CRUD via REST API (`GET/POST/PUT/DELETE /api/problems`). Import/export single `.json` files.
- `ProblemManager.setTheme(isLight)` syncs its two `CodeEditor` instances with the theme toggle.

### Problem storage (`server/data/problems/`)

Problems stored as individual JSON files (`{id}.json`) with an `index.json` manifest (scheme B: multi-JSON + index). Server module `server/src/problem-store.ts` handles file I/O with robust multi-path resolution for dev (`tsx`) and production (`node dist/`) environments.

The `CodeProblem` data model is shared: title, difficulty, description (Markdown, rendered via `marked`), examples, constraints, starterCode, testCases. Teacher-only fields: solution, hints.

### REST API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/problems` | List all problems (metadata only) |
| `GET` | `/api/problems/:id` | Get full problem detail |
| `POST` | `/api/problems` | Create new problem |
| `PUT` | `/api/problems/:id` | Update existing problem |
| `DELETE` | `/api/problems/:id` | Delete problem |

Vite dev server proxies `/api` to `localhost:3001`.

### Main profile page (`index.html` → `src/main.ts`) and Poster page (`poster.html` → `src/poster.ts`)

Static pages — see git history for unchanged architecture.

### Shared types (`shared/types.ts`)

Socket event payload types used by both frontend and backend: `StudentIdentity`, `SessionInfo`, `RosterEntry`, `RemoteExecutionResult`, `AuthRequest`/`AuthResult`, `ChatMessage`, `AssignedProblem`, plus `ServerToClientEvents`/`ClientToServerEvents` interfaces for typed Socket.io usage.

The main `tsconfig.json` includes `"src"` and `"shared"` so frontend code can import from `../shared/types`.

## Design docs (`docs/`)

Design proposals for planned features — implementation is NOT yet complete:
- `chat-testing.md` — testing strategy for the chat module (unit, integration, E2E)
- `problem-push-flow.md` — student inbox + active problem design, decoupling teacher pushes from immediate code override
- `teacher-intervention-proposal.md` — three proposals for teacher lock-and-edit student code flow

## Deployment

**Frontend (GitHub Pages):** Push to `main` triggers `.github/workflows/deploy.yml`. Set `VITE_SERVER_URL` in GitHub Actions Variables to point to the backend server.

**Backend (standalone server):** Clone repo, `npm install && cd server && npm install`, `npx vite build && npm run server:build`, then `cd server && node dist/index.js`. The server serves frontend static files from `dist/` so a single port handles everything. Requires Node >=20 (use `unofficial-builds.nodejs.org` glibc-217 builds for older Ubuntu).

### Theme system

Both `code.html` and `teacher.html` support light/dark theme toggle. CSS custom properties on `:root` define the dark palette; `[data-theme="light"]` overrides them with a light palette. All CSS variables must be defined in both `:root` and `[data-theme="light"]` — do not rely on hardcoded fallback colors, as they will break the light theme.

Variables: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-surface`, `--bg-hover`, `--bg-input`, `--accent-bg`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, `--border-color`, `--accent`, `--accent-green`, `--accent-red`, `--accent-yellow`.

Theme state is persisted to `localStorage` under key `python-lab-theme`. The toggle button (☀/🌙 in the nav bar) flips `document.documentElement.dataset.theme` between `"light"` and absent (dark). Any component with a `CodeEditor` instance must call `CodeEditor.setTheme(isLight)` on toggle; `ProblemManager` exposes a `setTheme(isLight)` method for this purpose.

This is a TypeScript learning/demo project — the verbose comments explaining TS concepts (type guards, function overloads, `as const`, generics) are intentional. Do not remove or shorten them.
