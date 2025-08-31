# Baseline & Diagnosis — ED-IA Personal Agent

This document captures the current state of the project and a proposed hardening roadmap to take it to production-grade quality without breaking existing behavior or public contracts.

## Stack Overview
- App type: SPA (React 18) built with Vite 7, TailwindCSS 3
- Language: JavaScript (ES modules)
- UI libs: framer-motion, lucide-react
- Persistence: Browser IndexedDB (offers + PDFs), localStorage/sessionStorage for settings
- Deployment: GitHub Pages workflow (`.github/workflows/deploy.yml`)
- CDN: `html2pdf.js` from jsDelivr in `index.html`

## Key Files
- package.json — build/dev scripts and deps
- vite.config.js — Vite config (base path set to `/ED-IA-Personal-Agent/`)
- index.html — app shell + CDN `html2pdf` loader
- src/main.jsx — React bootstrap
- src/app.jsx — primary app (routes, admin, offers, archive)
- src/ai/AIWizard.jsx, src/ai/wizardTree.js, src/ai/CatalogEditor.jsx — AI assistant features
- src/lib/db.js — IndexedDB wrapper used by the app
- src/lib/utils.js — utility `nextOfferRef`
- tailwind.config.js — Tailwind configuration
- .github/workflows/deploy.yml — Pages CI

Note: There are duplicate/unused files at repo root (e.g. `lib/db.js`, `pdf/exportPdf.js`) and several stray files with unusual names (likely accidental). These should be cleaned up in a controlled change.

## Immediate Risks / Findings
1) Hardcoded admin password in UI
   - `src/app.jsx` contains a hardcoded password `979851` in `PasswordModal`.
   - Risk: secret exposure, no rotation, no policy. Plan: allow `VITE_ADMIN_PASSWORD` with fallback for backward compatibility; optionally switch to hashed compare (PBKDF2/argon2) later.

2) Duplicate modules and dead files
   - `src/lib/db.js` (used) vs `lib/db.js` (unused alternative implementation). Also `src/pdf/exportPdf.js` and `/pdf/exportPdf.js` are empty/unused.
   - Risk: confusion, drift, accidental import. Plan: unify in `src/lib`, mark root duplicates for deletion in a follow-up PR.

3) Base path vs homepage mismatch
   - `vite.config.js` uses `base: '/ED-IA-Personal-Agent/'`; `package.json` has `homepage: 'https://jonat.github.io/pv-event-toolkit/'`.
   - Risk: broken asset URLs on Pages depending on repository slug. Plan: align `homepage` to repo path or remove it (Vite uses `base`). Keep runtime behavior unchanged.

4) No lint/format/test toolchain
   - No ESLint/Prettier; no tests. Risk: regressions and style drift. Plan: add ESLint + Prettier; introduce Vitest smoke tests (no logic changes).

5) CDN without SRI
   - `html2pdf.js` is loaded from CDN without Subresource Integrity.
   - Risk: supply chain attack via CDN tampering. Plan: pin version and add SRI; alternatively bundle via npm.

Additional notes
- Encoding artifacts (mojibake) in some source comments/strings; harmless but lint should surface them.
- A number of odd files at repository root (e.g. `reject(req.error)`, `resolve()`, `pv-event-toolkit@1.0.0`), likely created by a faulty copy/command; add cleanup plan.

## Top 5 Priorities
1) Add lint/format/test scaffold (ESLint, Prettier, Vitest) to prevent regressions.
2) Secure the admin password (env-based with safe default; later move to hashed compare).
3) Remove duplication/dead files (keep only `src/lib/db.js`), and guard imports.
4) Align deployment base path and homepage to avoid broken assets on Pages.
5) Add SRI to CDN script or switch to bundled dependency.

## Roadmap (7 steps)
1) Baseline & diagnosis (this document)
2) Build scripts & dependency hygiene (lockfile, scripts: `lint`, `format`, `test`, `build`, `preview`)
3) Lint/format setup (ESLint + Prettier) with non-invasive rules; apply fixes
4) Test harness (Vitest) with smoke tests for critical flows (offer create/save/load)
5) Security hardening (env-driven admin password w/ fallback, SRI for CDN; dependency audit)
6) Performance & bundle budget (analyzer, minor code-splitting where safe, assets policy)
7) CI/CD & pre-commit (GitHub Actions: install → lint → build → test → audit; Husky + lint-staged)

## Acceptance & Non-goals
- No breaking changes to public behavior, data formats, or persisted data.
- Cleanups staged in small, reviewable patches with clear rollback paths.

