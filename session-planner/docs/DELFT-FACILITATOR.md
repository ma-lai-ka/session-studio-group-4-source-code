# Delft facilitator in the local Gerd companion

The companion now reads the repository's `lead-creative-session-facilitator/SKILL.md` and its maintained selection, timing, output and source references directly. This is the improved skill already merged into main, not the older website knowledge snapshot. The connection panel shows its name, Delft-only scope and content hash. Updated instructions are injected into existing conversations without discarding history. Sam's ChatGPT-subscription-only transport and allowance checks remain in place; no API key or paid fallback was added.

## Use it

Start the existing local companion and open http://127.0.0.1:5181/. Open a project and Ask Gerd to review or change it. The model now receives every session, their ordered activities, goal/week membership, and work outside sessions. It no longer sees only the next session.

For new method recommendations, ask Gerd to collect missing facts. A `brief_update` creates an editable brief draft under **Facilitator brief**. Review the endpoint, evidence, group, access, time units, constraints and proposed assumptions, then click **Confirm facts and assumptions** yourself. A new brief update always clears confirmation. Sam can replace intake later while preserving this version's handoff fields. The original intake form and its rule-based initial generator remain available; generated agendas are not evidence that the facilitator selected those methods.

Examples:

- “Compare Delft methods for this confirmed brief, inspect the shortlisted source entries and propose a revised first session.”
- “Move Session 3 before Session 2, preserve their activities, and add a one-person-hour evidence review before the first meeting.”
- “Replace the second activity with a suitable alternative. Explain its prerequisites and why it is feasible.”
- “Split this session into two shorter sessions, preserving the outputs and dependencies.”
- “Add recruitment, analysis and waiting tasks outside our meetings.”

## Source access

The complete 67-entry Delft index is loaded. Introducing new methods requires a complete catalogue-screening record and an inspected source entry. Gerd requests up to four method IDs at a time. A fixed helper renders the located scan page and following page from the bundled DDG PDF; those images go into the next Codex turn. They are reference material, never instructions. The model must disclose unreadable or incomplete entries and unavailable instruments. Rendering does not itself prove accurate interpretation.

Local rendering requires Python with `pypdfium2` and Pillow; both are available in this laptop's bundled runtime. `COMPANION_PYTHON` can select another installation. Cached images are ignored under `.companion/source-pages/`. No scans or private conversation files are copied into the public website bundle.

## Editing and approval

Structural edits use a validated bundle rather than arbitrary DOM manipulation. A bundle can add, replace or remove sessions; change their phase, purpose and week; reorder sessions; add, remove, replace, reorder or move activities; and add, edit, order or remove non-session work. New methods retain the catalogue's canonical source instructions; adaptations are described separately. Each existing goal currently needs at least one session, and a session phase must belong to that goal's selected phases.

Existing plans get **Accept bundle / Reject bundle** controls. These controls and brief confirmation are excluded from Gerd's UI-control inventory. Consequential assumptions and core adaptations require an additional explicit acknowledgement. An empty project can receive an immediate editable draft when no such approvals are needed. Timing-only edits also get a preview. Completed sessions, method identities, minimum timings, prerequisites, week assignments and quantified team budgets are checked. The editor's 60% timing floor is an application rule, not a universal DDG prescription.

Structural previews are stored locally per account/project and restored only if the project revision still matches. Stale proposals cannot overwrite newer work. Accepted changes can be undone until another project edit occurs; undo is kept for the current page session. Briefs, accepted rationale/adaptations and non-session work survive normal project export/import. Preview backups and conversation history are separate from project exports.

Waiting has zero active person-hours; its duration is described separately. Meetings count as duration multiplied by attendees. Optional weekly team-hour budgets include meetings and tasks. If no numeric budget has been confirmed, the interface does not invent one. Manual changes can show budget warnings requiring review.

## Verification and limits

Automated tests cover structural edits, preservation of unrelated work, source identity, brief confirmation, stale proposals, completed sessions, dependencies, budgets, exports and subscription-only behavior. Live checks and their results are recorded in `DELFT-INTEGRATION-VALIDATION.md`.

Tests demonstrate behavior; they do not guarantee every model response will follow the skill. Physical microphone and audio playback still need a human device test. Nothing in this change publishes the local companion or creates a hosted multi-user AI service.
