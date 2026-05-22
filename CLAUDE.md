# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Vite HMR)
npm run build    # Type-check then build for production
npm run preview  # Preview production build locally
```

No test runner or linter is configured.

The project deploys to GitHub Pages with `base: '/vite-page/'` configured in `vite.config.ts`. All asset paths in production are prefixed with `/vite-page/`.

`npm run build` runs `tsc && vite build` — `tsc` does type-checking only (no emit), while `vite build` produces the actual output in `dist/`.

## Architecture

A single-page personal profile rendered entirely in the browser with no framework — just TypeScript manipulating the DOM.

- `index.html` — entry point, loads `/src/main.ts` as an ES module
- `src/main.ts` — DOM rendering: fetches data, then builds the page with template strings and `app.innerHTML`
- `src/types.ts` — all type definitions (Person, Skill, Experience, etc.) and utility types
- `src/data.ts` — hardcoded profile data, exported as a typed `Person` object
- `src/utils.ts` — helper functions (generic `groupBy`, type guards, date formatting, simulated async fetch)
- `src/style.css` — all styles, using CSS custom properties for theming

The `init()` function in `main.ts` simulates an async API call via `fetchPerson()` (which dynamic-imports `data.ts` with an artificial 800ms delay), then passes the result to `renderPage()`. There is no routing, state management, or component abstraction.

This is a TypeScript learning/demo project — the verbose comments explaining TS concepts (type guards, function overloads, `as const`, generics) are intentional. The `ThemeMode` enum in `types.ts` is currently unused (likely a planned dark mode feature).
