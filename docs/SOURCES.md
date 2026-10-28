# Source and attribution

Session Studio is Group 4's course prototype for IDEM307 Generative AI and Design. The packaged application combines the group interface/boards/runner/native voice work with the Delft facilitator and planning integration. Exact provenance is in `SUBMISSION.json`; the source integration commit is `65d7bfa15a9ac97c764eb5bda4a1f6fa1b609b44` in `esmayyork/gen-ai-course`.

The maintained facilitator skill and its references are included unchanged from that snapshot. Their source bibliography is [references/sources.md](../skills/lead-creative-session-facilitator/references/sources.md). The Delft Design Guide PDF is included because the implemented assistant inspects source scans at runtime; it is not a newly authored textbook. Preserve attribution and applicable rights. No blanket open-source license is asserted over third-party books, images or assets by this submission.

JavaScript dependencies retain their own upstream licenses in the installed packages and their exact versions/integrity in `session-planner/package-lock.json`. Python PDF tools are pinned in `session-planner/requirements-local.txt`. Optional Codex is downloaded from the official `@openai/codex` npm package; binaries and credentials are not committed here.

Official setup references: [ChatGPT download](https://chatgpt.com/download/), [Codex local/cloud modes](https://learn.chatgpt.com/docs/environments/modes), [Codex CLI/sign-in](https://learn.chatgpt.com/docs/cli), [Node.js](https://nodejs.org/en/download), [Python](https://www.python.org/downloads/).
