# Session Studio — Group 4 source submission

For **IDEM307 Generative AI and Design**. Session Studio helps a design team turn a project goal into reviewed sessions, agendas and preparation work with Gerd, a Delft-informed assistant. It includes local project backups, boards/uploads, method templates and a session runner.

## Start here: let ChatGPT/Codex set it up

Open **ChatGPT desktop**, choose **Codex**, then select **Work in → This computer**. Paste the prompt below. Codex handles the technical setup and opens the local website. You complete your own sign-in and any required installation/microphone approvals.

**Ordinary browser chat cannot install or launch this on your computer.** If needed, first install [ChatGPT desktop](https://chatgpt.com/download/). See [local Codex environment guidance](https://learn.chatgpt.com/docs/environments/modes). Repository access may require your own GitHub sign-in if private.

### Professor setup prompt — copy everything in this box

```text
Please set up and open Group 4's submitted Session Studio website locally from:
https://github.com/ma-lai-ka/session-studio-group-4-source-code

This is a request to run the submitted version, not develop or redesign it.

1. Work on THIS COMPUTER in local Codex mode. If you cannot run local commands, explain how I can switch to a local Codex chat; do not pretend a cloud preview is the full local website.
2. Download or clone the repository's main branch into a new folder. If an existing checkout is available, inspect its identity and uncommitted changes first; never reset, overwrite or delete my work. For a private repository, use my authorized GitHub connection or ask me to grant access. Do not request someone else's credentials. A complete extracted GitHub ZIP is also supported.
3. Read README.md, docs/SETUP.md and docs/KNOWN-LIMITATIONS.md. Use the repository root for the documented commands. Inspect supported Node.js (22.13+), npm and Python (3.11+, tested 3.12). Reuse compatible installations. If prerequisites are absent, install only what is required from nodejs.org and python.org/the official package registry using user-level installations where supported. Ask me for any unavoidable installer permissions. Do not disable security protections or bypass institutional restrictions. Reopen/refresh the command environment when required.
4. Run npm run setup. It installs locked website dependencies, prepares an isolated Python environment and initializes this checkout's own local database. Do not copy any author's local files, conversations, credentials, browser storage or databases. Do not upgrade dependencies or edit the application to get it to run.
5. Run npm run doctor. Gerd requires MY OWN ChatGPT/Codex subscription sign-in and remaining allowance. If Codex is missing or incompatible, use npm run setup:codex to install the repository's pinned official Codex package privately for this checkout, then run doctor again. If sign-in is required, launch the indicated Codex login command and let ME complete the browser sign-in. Never read, print or copy authentication tokens. Never add an API key, paid fallback or another person's account.
6. If a documented prerequisite or sign-in requirement is still missing, help me complete it and rerun the check. If an unexpected application/setup failure occurs, stop and give me the exact command, concise error and relevant prerequisite/version information; do not improvise source fixes. If experimental native voice is unavailable, state that explicitly and distinguish working text/planner functionality from unverified voice. Do not claim physical audio was tested automatically.
7. Run npm run start:local as a persistent background process and keep it alive while I test. On Windows use a hidden background process if needed. Wait for READY and open the printed localhost URL. If the port is occupied, reuse only a verified same-checkout listener; do not terminate unrelated programs or silently move my browser data to another port. Run with --planner-only only if I explicitly choose to review without Gerd; clearly label that limitation.
8. Report the local URL, installed/tested versions, doctor result and exact stop/restart instructions. Show me docs/PROFESSOR-WALKTHROUGH.md. Let me grant microphone permission and test the physical audio. Do not confirm my design brief, accept planning proposals, start a real session, publish the website or push code on my behalf.

My expected involvement is personal account sign-in, any unavoidable installation approvals and microphone permission. Handle the technical commands yourself and preserve the submitted source code.
```

## What happens next

Codex downloads this source, checks/installs prerequisites, runs the repeatable setup, verifies Gerd's own-account connection and opens **http://127.0.0.1:5181/**. First setup can take several minutes. There is no deployment or shared AI account. Account availability and experimental voice still require checks; no paid API fallback is provided.

Then follow the [professor walkthrough](docs/PROFESSOR-WALKTHROUGH.md). An [optional fictional project](examples/research-questions.json) can be imported explicitly. No author data or placeholder projects appear automatically.

## Manual setup and returning later

Requires Node.js 22.13+ with npm, Python 3.11+ (reference 3.12), and your own Codex ChatGPT access. From this repository root:

```sh
npm run setup
npm run doctor
npm run start:local
```

If Codex is missing/incompatible, `npm run setup:codex` installs the pinned official build privately for this checkout; follow its printed personal login command and repeat doctor. See [complete setup](docs/SETUP.md). Windows has **Start Session Studio.cmd**; macOS can run `sh start-macos.sh`. Keep the launcher running; Ctrl+C stops a foreground launch. Next time run only `npm run start:local`.

For intentionally reviewing without AI: `npm run start:local -- --planner-only`. This does not provide Gerd or automatic tailoring.

## Contents and verification

- `session-planner/` — complete website source, assets, tests, lockfile and migrations.
- `skills/` — required facilitator and Delft reference resources; keep this sibling folder.
- [Validation](docs/VALIDATION.md), [known limitations](docs/KNOWN-LIMITATIONS.md), [maintainer handoff](docs/MAINTAINER-HANDOFF.md), [source attribution](docs/SOURCES.md).
- `SUBMISSION.json` — exact integration source commit and runtime reference.

Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:workspace` for verification. CI tests fresh/repeated setup on Windows/macOS without AI credentials. Physical audio and live account checks are separate.

Projects are saved in your browser/origin; boards/uploads have checkout-local storage. Export important projects and keep uploads separately. A GitHub copy does not synchronize private work. No credentials, conversations, private research or author databases are supplied.
