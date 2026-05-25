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

Only two devDependencies: `typescript` and `vite`.

## Architecture

Two standalone pages rendered with no framework — just TypeScript manipulating the DOM via `innerHTML` and template strings. No routing, state management, or component abstraction.

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

**Pixel icon system** (`src/poster.ts`): Icons are defined as 2D character grids where each character maps to a color in a palette (`.` = transparent, `#`/`1`/`2`/`3` = palette indices). `renderPixelIcon()` converts a grid to absolute-positioned `<span>` elements inside a container. Both pages use this pattern — the profile page has a smaller inline robot icon for the poster entrance card, and the poster page has a full suite of icons (robot, chip, monitor, brain, star, rocket, shield, calendar, clock, pin, people, speech, target, cap, laptop, certificate, trophy).

### Multi-page build

`vite.config.ts` configures a multi-page build via `rollupOptions.input` with two entries: `index.html` and `poster.html`. Both are deployed together to GitHub Pages.

This is a TypeScript learning/demo project — the verbose comments explaining TS concepts (type guards, function overloads, `as const`, generics) are intentional. Do not remove or shorten them.
