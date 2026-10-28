# Delft / voice integration handoff — 28 October 2026

## Source and result

Repository: https://github.com/esmayyork/gen-ai-course. Result branch: `integration-branch`.

- Sam: `Final-V1.5.2-realy-this-one-now-final`, commit `e766964be67ef8d5c4f60f64de98287dcd26c87e`.
- Morning snapshot: `snapshot/website-oct28-morning`, commit `dbf45b926f07cbef58e410aa7a147cf2408ec584`.
- Common ancestor: `a8b24df20be152668ce2055b1a8f1ac959b7333b`.

The merge keeps both histories. Sam's interface, native voice transport, resizable chat, collaborative boards, uploads, PDF exports and session runner remain. The morning snapshot adds the maintained Delft facilitator skill, 67-entry selection index, source scans, complete project context, brief confirmation, structural proposals, approval controls, timing previews and undo. Placeholder projects remain absent.

Text and delegated voice replies use the same schema and `acceptReply` validation. Source scans are passed as images to the existing text continuation on the same backing conversation. Voice delegates method advice as well as edits. Approval controls remain excluded from the assistant's UI inventory. The browser reports the actual proposal/edit result to voice, rather than treating the model's proposed answer as proof of a saved change.

## Run locally

From `session-studio/session-planner`, with Node 22.13 or newer:

```sh
npm ci
npm run db:migrate:local
npm run companion
```

Open `http://127.0.0.1:5181/`. Each teammate uses their own Codex ChatGPT sign-in. Keep private files in `graduation-context/`; conversation state is ignored under `.companion/`. DDG scan rendering needs Python with pypdfium2 and Pillow. The launcher discovers the bundled runtime on this laptop; `COMPANION_PYTHON` and `COMPANION_CODEX_BIN` override discovery elsewhere. No API key or paid fallback is used.

For ordinary non-AI preview, use `npm run dev`. Project data remains local to the browser/account; export/import transfers it. Board data lives in the configured local database/storage during development. A GitHub push does not publish the site or create a hosted companion.

## Verification

- TypeScript type checking passed.
- Combined automated suite: 144 tests passed, including shared text/voice validation, human-only brief confirmation, unsourced-method refusal, duplicate completion rejection and actual DDG scan rendering into the voice-to-text continuation.
- Planner tests cover structural changes, canonical method content, completed sessions, stale proposals, dependencies and team-hour budgets.
- Runner completion and export/import retain the design brief, non-session work and accepted facilitator rationale alongside the workspace completion snapshot.
- Production build passed.
- All three existing database migrations passed against a disposable local database.
- Existing board API checks passed against that database: authentication/origin checks, project/session synchronization, stable activity frames, uploads, comments, templates and imported copies.
- Browser preview showed an empty home without placeholder projects, connected Delft assistant, native voice choices and microphone controls.
- Native Codex capability probe verified ChatGPT Plus authentication, included allowance and the native voice list without microphone capture.

The first sandboxed test run encountered a Windows `EPERM` replacing a private test-history file. The identical suite passed outside that filesystem sandbox; no persistence policy was weakened to bypass it. Dependencies were installed with the existing npm lockfile; it remains unchanged.

## Voice limitation and remaining human test

A microphone-free browser check connected, but no incoming reply audio was observed. Sam's earlier `transport_closed` failures remain relevant; this merge does not establish that the installed experimental native voice service is usable. The connection test now stops and reports failure after 15 seconds without incoming audio. Text chat remains available. No paid transport or browser-speech fallback is selected automatically.

Physical microphone capture, recognition, audible replies and naturalness are unverified. Before describing voice as working, a human must:

1. Select the microphone and verify its input level.
2. Start native voice; hold a short conversation and interrupt a reply.
3. Ask for a planning change in a disposable project. Check the proposal appears without altering the current plan, then accept/reject it manually.
4. Confirm the spoken result matches the planner and stopping voice releases microphone capture.

The integration preview used loopback port 5183 with separate disposable database state. Main and the source branches were not modified; no website was deployed.

## Automatic-tailoring follow-up

The user subsequently confirmed working microphone and speaker conversation. Automatic goal tailoring, two-block preliminary sessions and 154-test verification are recorded in [AUTOMATIC-GOAL-TAILORING.md](AUTOMATIC-GOAL-TAILORING.md). This supersedes the earlier physical-audio-unverified status above; the historical microphone-free observations remain recorded.
