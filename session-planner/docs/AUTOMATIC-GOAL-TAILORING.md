# Automatic goal tailoring — 28 October 2026

## What happens

Creating a project or adding a goal saves preliminary sessions and queues Gerd through the existing local ChatGPT-subscription companion. Changing a goal's intake also queues tailoring, while preserving its current agendas until a proposal is accepted. Saving identical intake does not trigger new work.

Every new preliminary session contains Introduction (5 minutes) and Closing (5 minutes), with remaining availability shown as unplanned. Its card says “Awaiting tailored plan.” The start action opens review; it does not launch the runner. A human must review and confirm a session before running it. Manually added preliminary sessions use the same two blocks. Existing saved/imported/manual agendas are not simplified.

Gerd receives the goal, project description, intake constraints, complete session context and its Delft facilitator instructions. It clarifies consequential unknowns and prepares a brief draft. Each goal has its own brief. An older project-wide brief supplies starting information, with confirmation cleared; it is not treated as confirmation for a different goal.

Click **Confirm facts and assumptions** to continue automatically. Gerd screens the catalogue, inspects the strongest source candidates and proposes changes to session count, order, purpose, activities and preparation work. Review the proposal and click **Accept bundle** or **Reject bundle**. Accepted changes remain drafts until sessions are confirmed. Undo remains available until a newer project edit.

Opening an existing project does not start AI work. Use **Tailor this goal** for older goals, rejected proposals or interrupted attempts. Repeated renders and proposal acceptance do not regenerate plans. Active requests are deduplicated and serialized with chat and voice; microphone capture pauses during delegated agent work. Changing the project during a request makes its result stale.

## Boundaries

Automatic proposals are restricted to the target goal. Other goals, completed work, stable workspace links, uploads and runner records are preserved. Selected phases, intake meeting availability and confirmed team-hour budgets constrain proposals. If a phase is already used by saved sessions, move or tailor those sessions before removing the phase in intake. Completed work keeps its existing week schedule.

The local subscription companion powers tailoring. The old hosted FACILITATOR_ENDPOINT setting no longer determines this intake workflow. Disconnection, cancellation, allowance exhaustion and source-rendering failures remain visible, with explicit retry. There is no API key, automatic paid fallback, hosted companion deployment or background regeneration on reload.

## Verification

- Type checking and the combined 154-test suite pass. New tests cover minimal scaffolds, stable activity identities, goal-specific brief migration, request fingerprints, scope enforcement, session/labour budgets, export/import, runner protection, readable conversation entries and valid native startup context after large catalogues.
- Browser QA used an isolated deterministic model transport with the real companion validation and DDG scan renderer. It verified intake → automatic brief draft → human confirmation → source inspection → proposal, then Accept, Undo and Reject. The original agenda stayed unchanged until acceptance.
- Two synthetic live checks used the actual local subscription connection and separate test history. An interview-synthesis goal produced Problem Definition and List of Requirements sessions; a concept-exploration goal produced Brainwriting and Braindrawing sessions. Both proposals passed planner, scope and time-budget validation.
- An initial live attempt exceeded a two-minute turn limit. The successful checks used the app's normal three-minute turn limit and inspected one or two source candidates initially. Runtime errors now distinguish timeout from disconnection and do not expose renderer command lines.
- The user confirmed working microphone and speaker conversation on this installation. This confirmation is separate from model planning validation.

For another machine, follow GROUPMATE-AI-SETUP.md. Use your own Codex ChatGPT sign-in and keep private context, conversations, databases and test artifacts out of GitHub.
