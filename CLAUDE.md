# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Vite HMR)
npm run build    # Type-check then build for production
npm run preview  # Preview production build locally
```

No test runner or linter is configured.

The project deploys to GitHub Pages with `base: '/vite-page/'` configured in `vite.config.ts`. All asset paths in production are prefixed with `/vite-page/`. Pushing to `main` triggers the deploy via `.github/workflows/deploy.yml`.

`npm run build` runs `tsc && vite build` — `tsc` does type-checking only (no emit), while `vite build` produces the actual output in `dist/`.

## Architecture

Three standalone pages rendered with no framework — just TypeScript manipulating the DOM via `innerHTML` and template strings. No routing, state management, or component abstraction.

Dependencies: `typescript`, `vite`, `codemirror` + `@codemirror/*` (editor, Python language, one-dark theme).

### Multi-page build

`vite.config.ts` configures a multi-page build via `rollupOptions.input` with three entries: `index.html`, `poster.html`, and `code.html`. All three are deployed together to GitHub Pages.

### Main profile page (`index.html` → `src/main.ts`)

- `src/types.ts` — all type definitions (Person, Skill, Experience, etc.) and utility types
- `src/data.ts` — hardcoded profile data, exported as a typed `Person` object
- `src/utils.ts` — helper functions (generic `groupBy`, type guards, date formatting, simulated async fetch)
- `src/style.css` — light theme, Apple-style design, CSS custom properties

The `init()` function simulates an async API call via `fetchPerson()` — this uses dynamic `import('./data')` (not a static import) with an artificial 800ms delay, demonstrating how real async data fetching would work. It shows a loading state, then calls `renderPage()`, with error handling for failed loads. `renderPage()` assembles the full page by concatenating the output of individual `render*()` functions into `app.innerHTML`.

### Poster page (`poster.html` → `src/poster.ts`)

A dark sci-fi themed course promotion poster targeting Hong Kong students. Renders synchronously on `DOMContentLoaded` — no async simulation.

- `src/poster.css` — dark theme with animated grid background, floating particles, and glow effects
- `src/poster.ts` — hardcoded `PosterData` object with course modules, highlights, and info bar details

**Pixel icon system** (`src/poster.ts`): Icons are defined as 2D character grids where each character maps to a color in a palette (`.` = transparent, `#`/`1`/`2`/`3` = palette indices). `renderPixelIcon()` converts a grid to absolute-positioned `<span>` elements inside a container. Both the profile and poster pages use this pattern.

### Coding lab page (`code.html` → `src/code.ts`)

A Python coding problem platform (LeetCode-style) with a CodeMirror 6 editor, Pyodide-based Python execution in a Web Worker, and a test runner. Chinese-localized (zh-HK), dark theme.

Five source modules for this page, all prefixed `code-`:
- `src/code-types.ts` — types for CodeProblem, ExecutionResult, TestRunResult, SessionConfig, etc.
- `src/code-problems.ts` — hardcoded problem definitions (Two Sum, FizzBuzz) with starter code and test cases
- `src/code-session.ts` — session abstraction that wraps code state; currently local-only but designed as a seam for future Yjs real-time collaboration (roomId, role, userId fields are already wired)
- `src/code-editor.ts` — wraps CodeMirror 6 (Python mode, one-dark theme, indentWithTab); exposes `getCode()`, `setCode()`, `onChange()` (debounced at 300ms). The rest of the app never touches CodeMirror APIs directly
- `src/code-executor.ts` — manages a Pyodide Web Worker. Loads Pyodide once, then accepts `execute(code)` and `runTests(code, testCases)` with configurable timeouts. On timeout, terminates and auto-recreates the worker
- `src/code.css` — dark theme CSS custom properties

**Web Worker** (`public/code-worker.js`): A classic Web Worker (using `importScripts`, not ESM) that loads Pyodide from CDN and runs `pyodide.runPython()`. Placed in `public/` so Vite serves it as-is without processing. The main thread communicates via `postMessage` (`{ type: 'run', code }` → `{ type: 'result', stdout, stderr, ... }`).

**Lifecycle**: On `DOMContentLoaded`, `init()` renders the layout, mounts CodeMirror, starts Pyodide loading (async, non-blocking), and wires up Run/Tests buttons. The Run button executes code directly; the Run Tests button generates a Python test harness that iterates test cases and prints structured `TEST_RESULT:` JSON lines for parsing.

This is a TypeScript learning/demo project — the verbose comments explaining TS concepts (type guards, function overloads, `as const`, generics) are intentional. Do not remove or shorten them.
