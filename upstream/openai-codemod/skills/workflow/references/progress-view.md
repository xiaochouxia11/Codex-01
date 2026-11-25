# Default workflow progress view

Use the [stored fragment](../assets/migration-progress-view.html) for a thread-local
summary of saved migration evidence. The coordinator owns the view; workers return
findings without registering separate views. Resolve the selected adapter through
[issue systems](../../codemod/references/records/issue-systems.md);
it prepares the normalized input below. The fragment neither retrieves records nor
interprets provider fields, labels, hierarchy, or report-store choices.

## Start or resume

For the default workflow, identify the migration and read useful saved evidence,
then open or reuse the view before substantial work. For a new migration, Initialize
begins without a view and establishes its migration home under its own prerequisites;
never substitute an older migration. Immediately after the home is established,
create and display the first view at step 0 before subsequent substantial work or
worker dispatch. The view does not block the initialization needed to reach that point.
A directly invoked stage may refresh an existing workflow view; invoking a stage
alone does not open the workflow strip. Status may open or refresh it when reporting
on this default workflow.

The view is standard output for the default workflow; do not use a separate
suggestion or opt-in flow. Use the standard style automatically. In a supported
client, follow the available `visualize:live` creation and update contract, reading
its creation guide. Populate the asset in its
permitted durable, thread-owned location outside migration repositories. Register
it once with the migration name as the host title; do not repeat the name inside.
Reuse the file in this thread; a new coordinating thread builds its own view from
current records in the selected provider and report store. Rebuild from those
records when using an updated fragment; older migration records need no conversion.

### Stage entry

After the startup exception for a new migration above, before workflow stage work
or worker dispatch, the coordinator updates the registered
fragment to the selected stage and scope: set `CURRENT_STEP`, move the single
`STEP_n_CURRENT` marker, and refresh `CURRENT_SCOPE`, insights, and issue states from
current records. For another Transform phase, keep step 5 and change its scope.
Mark earlier stages completed only when their acceptance rules are met.

Use `apply_patch` to update the existing registered fragment so the host refreshes
it. An already open view or an earlier reading of this guide does not satisfy stage
entry; creating and registering a first view follows the startup contract above.

Before each coordinator hands off, confirm the populated fragment exists and its initial
live content reference has been emitted in this coordinating thread. Reading the
guidance, writing the file, or opening the migration home does not display the view.

If visualization, a suitable path, or rendering is unavailable, use text updates.
Name the specific limitation at handoff instead of silently omitting the view.
Do not install a renderer, backend, or polling. Rendering—including status—changes
no migration records, repository files, or acceptance; it starts no work and replaces
neither chat updates nor reporting and human checkpoints.

## Refresh

Refresh at existing progress checkpoints and on resume when evidence or scope
changes. Reuse record readback and reconcile other threads through saved records; idle
views do not synchronize automatically.
If this thread has no registered view yet, follow [startup](#start-or-resume).

Preserve the asset's order: full-width primary migration-home button,
current step and 0–6 strip, divider, insights and unresolved decisions/blockers,
divider, issue/resource disclosures, then any freshness warning. Keep labels short
and content readable at 240–300px, normally under 440px collapsed. Expanded lists
may grow.

Both disclosures start collapsed and include every entry with a verified HTTPS
link. Follow pagination where applicable; never cap lists or add Showing N or View
all links. Keep unlinked work in aggregate counts, explain the limit, and link
relevant work or decisions in chat through the bound adapter. Give the full inventory
only when requested. Qualify incomplete inventories and counts.

- **Active issues:** link as **ID — readable title**, ordered by user action,
  failure, then work in progress. Flag unfinished
  [User Required](../../codemod/references/records/reviews.md#human-action-required) issues with
  **🚩** and a summary count, e.g. **Active issues · 5 · 🚩 2**; omit zero flags.
  Preserve descriptive accessible labels and tooltips. The flag covers human
  input, execution, review, and approval. Use the adapter's explicit normalized
  human-action signal; do not infer it from a review state, count completed/canceled
  issues or waiting dependents, or change labels. Artifact-only report issues belong
  in Recent resources, not Active issues or execution counts. Include only issues
  in the current workflow scope and show unresolved blockers without editing records.
- **Recent resources:** include all resources in the migration's authoritative index
  across stages, including its selected report store and external evidence links,
  one link per artifact or external resource, newest first by its actual
  native update time (fallback creation time). Show the count and actual change time
  on hover; qualify missing timestamps. Use the underlying resource's time, not a
  container or remote-link update. Reading a resource does not update it, and its
  update time does not prove fresh verification.
  Do not create or refresh reports for the display.

Put **Last checked** in the step-heading tooltip, separately from execution times.
Show a freshness warning only when stale/unavailable evidence is not already clear.

## Step and insight selection

Highlight this thread's assignment; other stages can be active concurrently.
The **5. Transform** marker groups implementation with transform's independent
phase verification and repairs; **6. Verify target** is whole-migration Final
verification. Keep implementation acceptance distinct from full phase exit.
Workflow and status are coordinators or utilities, not additional steps.
Each marker uses its stage's completion rules, a name/state tooltip, and matching
accessible label; label done stages **completed**. Keep overall progress in the
strip, without a stage count, effort percentage, or Next line; actions stay in the
issue/chat handoff.

Use adapter-normalized workflow meanings and saved reports. Child completion,
passing tests, finished workers, and native percentages do not establish acceptance.
Keep **Awaiting review**
distinct from accepted work, and passed/failed/skipped/unrun checks separate.
Unreadable evidence is **Unknown**, not zero; stale evidence is **Needs recheck**,
with prior results historical. Awaiting-review, stale, and unreadable stages are not done.
Count each slice once, excluding parents, canceled work, and report artifacts; use
the latest applicable candidate, not accumulated retries, and explain scope/denominator changes.
Distinguish saved results from unsaved findings; do not scan source or run checks
for the view.

Show review separately from human action in meaningful metrics or status rows.
Native review states and an active state with a mapped review label produce the same
**Awaiting review** display. Delegated agent review does not add a human flag;
unfinished human clarification does not imply submitted work. The adapter preserves
mandatory human approvals, current acceptance despite stale markers, substantive
revisions requiring review, and cancellation distinct from acceptance. Missing or
unreadable review evidence stays unknown rather than becoming accepted work.

Metrics and rows are repeatable, with no quota. Show each consequential outcome,
gap, or decision once; omit resolved warnings, empty filler, and duplicate approval
or blocker text. Group related findings and link detail without hiding important
gaps. Metrics may be status text; charts require meaningful units and known
denominators. These are priorities, not mandatory rows:

| Step | Useful evidence |
| --- | --- |
| 0. Initialize | Intent readiness, open decisions, setup/access/tooling gaps. No conversation-progress percentage. |
| 1. Preflight | Established capabilities, check progress, blockers, failed/unrun checks, pending acceptance. Avoid redundant counts. |
| 2. Assess | Findings affecting difficulty, scope, or risk; investigation/synthesis progress, coupling and compatibility gaps. Explain why hotspots matter. |
| 3. Behaviors | Inspected scope, then catalog approval; unresolved candidates, source/consumer gaps, package progress. Behavior count is not completeness. |
| 4. Brief | Plan readiness and human acceptance; unresolved planning, guidance/design review, or scope decisions. One approval state may suffice. |
| 5. Transform | Implemented versus independently verified scope; accepted slices, pilot results, development failures, phase verification, repairs/integration gaps, and optional phase work burndown. |
| 6. Verify target | Target behavior and criterion outcomes, uncovered scenarios, independent challenges, specialist findings, and final criteria. Keep final and development checks distinct. |

## Populate the fragment

Expand `{{#NAME}}…{{/NAME}}` for `METRICS`, `ROWS`, `ISSUES`, and `RESOURCES`
once per item in supplied order; empty arrays remove their blocks. Replace scalar
placeholders, leaving no template markers. Keep layout/CSS intact and both
issue and resource disclosures closed; no template library is needed.

HTML-escape text/attributes; never insert evidence as markup/CSS or reinterpret
inserted values as template syntax. Links must be verified HTTPS URLs for this
migration. Omit issue/resource entries without URLs; optional metric/home links
use empty URLs and false visibility.

Use booleans for visibility and `USER_REQUIRED`. `STATE` is `is-done`,
`is-active`, `is-blocked`, or `is-pending`. Show bars only for current, known
counts with finite `0 ≤ NOW ≤ MAX`, positive `MAX`, and
`PERCENT = 100 × NOW / MAX`. Unknown, stale, zero-total, or text metrics use
`BAR_VISIBLE: false`, blank numeric fields, and explicit status text.

| Fields | Content |
| --- | --- |
| `MIGRATION_NAME` | Migration name for the host title, outside the fragment. |
| `MIGRATION_ID` | Stable identity qualified by provider and workspace/site, including the migration's native ID. Never use a native ID alone across providers or tenants. |
| `MIGRATION_HOME_URL`, `MIGRATION_HOME_VISIBLE`, `MIGRATION_HOME_LABEL` | Verified migration-home URL, boolean visibility, and a short accessible action selected by the adapter. Hide if URL unavailable. The adapter selects the migration home, not a broader container or an individual report. |
| `CURRENT_STEP`, `CURRENT_SCOPE`, `SCOPE_VISIBLE` | Step number/name and optional phase/concurrent-work scope. |
| `STEP_0_*` … `STEP_6_*` | `STATE`, descriptive `LABEL`, and `CURRENT`: `step` for this thread's stage, `false` otherwise. Preserve other active states; unknown/stale use pending. |
| `METRICS` | Items: `LABEL`, `VALUE`, `STATE`, `NOW`, `MAX`, `PERCENT`, `BAR_VISIBLE`, `URL`, `LINK_VISIBLE`. Link measure labels to evidence or show plain text; direct issue links belong in Active issues. |
| `ROWS` | Items: `STATE`, `LABEL`, `VALUE`. |
| `DECISIONS_BLOCKERS`, `DECISIONS_BLOCKERS_VISIBLE` | Unresolved action/blocker not already shown, otherwise empty/false. Unknown is not None; not every blocker needs a human. |
| `ISSUES_SUMMARY`, `ISSUES_SUMMARY_LABEL`, `ISSUES_VISIBLE` | Counts/limits; accessible label and tooltip spell out 🚩 as “need you.” Hide only when no useful context remains. |
| `ISSUES` | Executable work items: native ID/title `LABEL`, `URL`, and normalized boolean `USER_REQUIRED`. Review is independent of this flag. |
| `RESOURCES_SUMMARY`, `RESOURCES_VISIBLE` | Count and incomplete-inventory/recency limits; hide only when nothing useful remains. |
| `RESOURCES` | Items: title `LABEL`, `URL`, `RECENCY` (Created/Updated time or Update time unknown). |
| `FRESHNESS` | Last checked, or Not checked; full revision details remain in linked evidence. |
| `FRESHNESS_WARNING`, `FRESHNESS_WARNING_VISIBLE` | Stale/unavailable warning only when not already explicit, otherwise empty/false. |

## Transform work burndown

For step 5, use [tracked phase work](../../transform/references/work-burndown.md#derive-phase-progress)
when its evidence is complete and `CURRENT_SCOPE` identifies the phase and any
new baseline. The coordinator refreshes the view at existing checkpoints; do not
assign a separate monitor. Replace `<!-- TRANSFORM_BURNDOWN -->` with the
[burndown fragment](../assets/transform-burndown.html), or remove the marker when
evidence is insufficient. Insert only that trusted asset, never record text as markup.

Populate `BURNDOWN_POINTS` with an HTML-attribute-escaped JSON array of
`[elapsed hours, active hours, percent remaining, reopened]` points, starting at
`[0, 0, 100, false]`. Include work-interval boundaries and acceptance/reopen events,
combine simultaneous events, and end at the checkpoint. Set `reopened` to `true`
if any event at that time reopened work, even when the net remaining percentage
falls or stays the same; otherwise set it to `false`. Time must advance, active time
cannot decrease or exceed elapsed time, and percent must be between 0 and 100. The
chart starts open in active-time mode. `+ idle` shows elapsed time and idle intervals.

The optional forecast extrapolates the fastest and slowest observed completion rates
since the last reopening; it requires at least two positive rates and remaining work.
Matching rates produce an approximate single estimate. Elapsed mode scales the forecast
by the observed elapsed-to-active ratio. A forecast range is not a confidence interval;
**Left** stays unknown when the evidence cannot support a forecast.

## Validate the view

For asset changes, run the [rendering check](https://github.com/openai/openai-codemod/blob/main/tests/progress-view.cjs)
with existing Playwright and visualization host CSS (command in its header).
Cover supported providers and selected report stores, steps 0–6, phase verification,
native and fallback review, independent human-action flags, artifact exclusion,
unknown/stale/zero totals, empty/status-only insights, short and long repeatable
lists, order preservation, and Transform burndown states. Provider normalization
is verified separately from rendering; a synthetic display fixture does not prove
live record access or writes.
Check collapsed/expanded disclosures, labels, and narrow layouts in both themes.
Fixtures are **Dummy data**, not migration evidence or live-registration proof.
