# Gerd controls and automatic planning

Microphone toggles mute during a voice conversation. Muting does not stop planning. The separate Stop control interrupts the current response and pending actions while retaining the voice connection; End voice conversation is in Microphone & voice settings.

Hiding Gerd with X, Escape or the pet does not cancel work. Planning jobs run in the local companion, serialize with text and voice requests, and continue source inspection without frontend follow-up commands. The chat stays hidden when results arrive. A result for another project is retained with an Open goal recovery action. Closing the entire site does not cancel server work, but applying a result requires the original project to be open. Server restarts expose interrupted work for explicit retry instead of replaying uncertain changes.

Confirmed briefs queue planning with an acknowledgement. Clarification answers from text and final voice transcripts resume the original request. Duplicate triggers are idempotent. A conversational acknowledgement alone is not treated as a completed planning result. Existing validation, approval, stale revision protection and undo remain in place.

Reconnect and Microphone & voice are in the header. Agent operations is collapsed initially. Status reports planning, source review, speaking, listening, waiting and proposal review separately from microphone state. Recoverable errors include fixed application recovery buttons.

## Setup

Use the existing local ChatGPT subscription companion setup described in the integration handoff. No API key, paid fallback or new dependency is required. Restart an already running dev server after updating companion server files, then reload the preview. Browser project storage and existing companion history are retained.

## Verification (28 October 2026)

- 165 automated tests passed, including planning deduplication, source continuation, typed/spoken clarification resumption, Stop without voice disconnection, late result suppression, result retention and restart recovery.
- TypeScript checking and production build passed.
- Isolated browser check with deterministic model responses verified confirmed brief acknowledgement, automatic proposal delivery without another prompt, hidden chat staying hidden and consolidated controls. This checks orchestration, not live model design quality.
- Workspace API smoke checks passed for sign-in/origin boundaries, project/session sync, stable references, uploads, comments, templates and imports.
- The user previously verified physical microphone and speaker operation. Physical audio interruption/muting on this follow-up has not been reverified. No additional live model calls were made for these checks.

No deployment or main-branch change is included.
