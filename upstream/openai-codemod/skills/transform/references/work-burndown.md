# Track Transform work

Track estimated work and measured time on the existing phase work records. This
evidence can support a [workflow burndown](../../workflow/references/progress-view.md#transform-work-burndown);
missing tracking evidence never blocks execution or acceptance.

## Record work evidence

Before execution, estimate each required work record on one phase-relative scale:
**1, 2, 3, 5, or 8**, or **Unknown**. Weight represents expected work, not hours or
percent complete. Include implementation, repairs, independent phase verification,
and separately owned integration. Estimate only the aggregate's own work, never
its children; use **Not applicable** for a pure container.

Capture UTC start and stop times for active work, including resumed sessions. Close
intervals at pauses, handoffs, checkpoints, or stops; waiting is not active work.
Workers return timings with their results; the coordinator saves them on the owning
issue at existing authorized checkpoints. Record actual active time from the union
of that issue's intervals, elapsed time from first start to acceptance or checkpoint,
and verified acceptance/reopen times. Keep incomplete evidence **Unknown**.

## Derive phase progress

Start with the complete phase inventory and its total weight. Count each required
responsibility once, excluding containers, reports, canceled work, and duplicates.
Remaining work is the weight not currently accepted divided by the baseline; an
in-review item retains its weight and reopening restores it. Phase active time is
the union of all intervals, so overlapping workers count once. Elapsed runs from
the first tracked start to the checkpoint; idle is elapsed minus active. Build the
timeline from interval boundaries, acceptance/reopen events, and the checkpoint.

Omit the chart if scope, weights, timing coverage, or acceptance history is
incomplete. If scope or weights materially change, start a new baseline for
remaining work and identify it in the displayed phase scope. Never invent timing
from issue age, commits, or chat activity. Zero weight does not prove phase exit;
a forecast is not a deadline or approval.
