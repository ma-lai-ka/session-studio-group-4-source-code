# Local setup — Windows and macOS

The preferred route is to paste [the professor setup prompt](PROFESSOR-PROMPT.md) into **local Codex in ChatGPT desktop**. The agent performs these steps; you normally supply only sign-in and unavoidable installation/microphone approvals. A regular chat without local command access cannot do this setup.

## Prerequisites

- Windows x64/ARM64 or current macOS on Apple Silicon/Intel, a writable folder, internet access and a modern browser. Chrome/Edge are the preferred browsers for the native WebRTC voice check; microphone access is required only for speaking.
- Node.js **22.13 or newer**, including npm. Node 22 is the CI target; Node 24 is also checked locally. Use [the official Node installer](https://nodejs.org/en/download). Close and reopen the terminal after installation if PATH has not refreshed.
- Python **3.11 or newer**, including pip and venv; Python 3.12 is the reference version. Use [python.org](https://www.python.org/downloads/). On Windows select the PATH option; the Python launcher (`py -3`) is supported too. An uninstalled Microsoft Store execution alias is not accepted as an interpreter.
- Your own ChatGPT subscription with available Codex allowance, signed in through Codex. The local website's test identity is separate from this actual AI sign-in. No Cloudflare account, deployment, API key or Sites invitation is required for local testing.
- Git is optional: **Code → Download ZIP**, then extract the complete repository. Do not copy only the application subfolder; its sibling `skills/` is required. If private, the repository owner must give your GitHub account access.

## Install and check

Open a terminal at the repository root (the folder containing this README and the root package.json):

```sh
npm run setup
npm run doctor
```

Setup uses the existing npm lockfile, installs pinned Python packages into an isolated environment and applies outstanding local migrations. It is safe to repeat; it never intentionally deletes saved projects, boards or conversation history. It does not install operating-system prerequisites or sign in for you. Allow several minutes for first-time downloads.

Doctor renders a real Delft page, queries the migrated database and, by default, checks the actual Codex subscription, allowance and voice catalogue. It does not capture a microphone, start a voice session or request a model response. `npm run doctor -- --offline` excludes account-dependent checks; it is not proof that Gerd is connected.

If the existing Codex cannot be found or its experimental interface is incompatible:

```sh
npm run setup:codex
npm run doctor
```

This installs **@openai/codex@0.165.0-alpha.1.2**, the reference integration build, privately for this checkout using the official npm package. It does not replace your global CLI or desktop application. Follow the exact login command it prints if sign-in is needed, and complete **your own ChatGPT sign-in** in the browser. Do not choose API-key authentication. Shared credentials are neither necessary nor included. [Official Codex installation/sign-in guidance](https://learn.chatgpt.com/docs/cli).

The setup agent can run these commands and install missing prerequisites from official sources. A corporate-managed computer may require its owner or administrator to approve installations; the scripts do not bypass those controls.

## Open and stop

```sh
npm run start:local
```

The launcher prints **READY: http://127.0.0.1:5181/** and opens the browser. Keep its terminal running. Ctrl+C stops the foreground launcher and website. If Codex starts it in the background, it must give you that process/session's stop instruction. Start it again with the same command; setup is normally unnecessary.

Windows alternative: double-click **Start Session Studio.cmd**. macOS alternative: from the extracted repository run `sh start-macos.sh`; executable permissions are not required for this invocation. A regular website build/start command is not the full AI companion: the subscription bridge runs with the documented local launcher.

If you deliberately want the planner without an AI connection:

```sh
npm run start:local -- --planner-only
```

Gerd and automatic tailoring are unavailable in that mode. It is a manual review option, never an automatic substitute for a failed AI connection.

## Saved data and overrides

- Projects live in the same browser/account/origin. Use project export/import for backup or transfer. A different port, browser or extracted folder does not automatically transfer a project or its board files.
- Database/uploads, isolated Python and optional Codex are scoped to this checkout. macOS defaults to `session-planner/.local/`. Windows uses `%LOCALAPPDATA%\SessionStudio\<checkout-id>\` to avoid native SQLite/Windows path-length failures. Startup and doctor print the exact runtime location. Moving the checkout changes its ID on Windows; export before moving it.
- Private conversation and rendered-source cache remain under ignored `session-planner/.companion/`. Private input documents belong in ignored `session-planner/graduation-context/`. Keep all this local.
- `COMPANION_PYTHON`: absolute path to a Python interpreter for initial setup. Subsequent launches prefer the prepared isolated Python environment.
- `COMPANION_CODEX_BIN`: explicit Codex executable or its `bin/codex.js` entrypoint. Correct an invalid override instead of silently falling back. Unset it if you want the private installed package to be detected.
- `SESSION_STUDIO_PORT`: explicit alternate port if 5181 belongs to something else. The launcher never kills that process. Reusing the original port preserves browser project storage.
- `SESSION_STUDIO_LOCAL_DIR`: explicit writable runtime directory. Set it consistently for setup, doctor, testing and startup; changing it selects a different database.
- `SESSION_STUDIO_NO_OPEN=1`: print the URL without opening a browser, useful for an agent or CI.

Set overrides in the launching terminal; no source edits or committed `.env` file are required. Never add authentication tokens to these variables or to GitHub.

Unexpected failure? Give the maintainer the failed command, concise error and doctor output. Do not include credentials, personal documents or raw conversation state. See [known limitations](KNOWN-LIMITATIONS.md).
