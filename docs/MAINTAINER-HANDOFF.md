# Maintainer handoff

This repository is Group 4's source submission for IDEM307 Generative AI and Design. `SUBMISSION.json` records the exact integration source and reference runtime. The destination's initial README commit remains an ancestor; the whole unrelated coursework repository/history was not copied.

## Layout and operation

- `session-planner/`: React/vinext application, API routes, database migrations and locked dependencies. Its `scripts/companion/` contains the ChatGPT-only Codex bridge, shared reply validation, native voice and persisted automatic-planning coordinator.
- `skills/lead-creative-session-facilitator/`: maintained skill, references, selection index and original source assets. Keep it adjacent to `session-planner/`; the bridge resolves it relative to its own module.
- `scripts/`: root setup, diagnostics, local launch and verification. `session-planner/scripts/local-runtime.mjs` owns executable discovery and per-checkout runtime locations.
- `docs/`: current submission instructions. Older development notes are under `session-planner/docs/`; their URLs, test counts and historical limitations are not the professor's setup instructions. Entry-point README/setup documents were updated.

Root commands: `npm run setup`, `npm run setup:codex` if needed, `npm run doctor`, `npm run start:local`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:workspace`. `doctor --offline` does not inspect an account. The workspace smoke test creates disposable API records in the current checkout's local database. Use a separate runtime directory for clean test data.

## Changes from integration source

Application features/validation are preserved. Packaging adds root automation, an isolated Python environment, Python/Codex discovery, optional private pinned Codex installation, local health/readiness identification, reusable launchers, CI and documentation. Codex JavaScript entrypoints run via Node without a shell. The hardcoded author-specific Python runtime assumption was removed. Hosting metadata retains DB/BUCKET bindings without the original hosted project ID. No deployment is configured.

Setup applies migrations without deleting records. Windows uses a short per-checkout runtime path for native SQLite compatibility; do not change a user's runtime location or port without explaining that it selects different local data. Source scans/private conversation still live under ignored `.companion/`. Do not commit generated state, environment files or private research.

## Maintainer AI prompt

> Work in a separate branch of this submission repository. Read README.md, docs/SETUP.md, SUBMISSION.json and docs/VALIDATION.md. Preserve local work and private state. Use existing root scripts and the lockfile; reproduce failures before making narrow changes. Preserve ChatGPT-subscription-only authentication, no paid fallback, goal scoping, source inspection, human brief/proposal approval, stale/completed-work protection, undo, board records and runner completion. Run relevant tests plus typecheck/build; keep account and physical-audio verification separate. Do not deploy, change repository visibility, force-push, update unrelated dependencies or copy credentials. Report actual test evidence and unresolved limits.

Do not treat the professor setup prompt as authorization to change application source. Unexpected installation failures should first be reported with the failing command and versions.
