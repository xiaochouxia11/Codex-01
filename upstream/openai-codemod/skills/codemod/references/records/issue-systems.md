# Issue systems and adapter routing

Use this router before reading or changing migration records. The [shared record
policy](README.md) defines behavior; provider adapters implement native operations.

## Provider catalog

A migration home is the entry point for one migration. Each provider's adapter owns
work grouping, hierarchy, and migration updates.

| Provider ID | Access to discover | Migration home and adapter | Report stores |
| --- | --- | --- | --- |
| `linear` | Linear plugin and its available record operations | One project ([Linear adapter](linear/records.md)) | Native project documents |
| `jira` | Atlassian plugin with Jira access | One migration Epic in a selected Jira space ([Jira adapter](jira/records.md)) | Jira report issues; optional Confluence |
| `github` | GitHub integration; authenticated GitHub CLI for missing operations | One issue in a selected records repository; an optional existing Project organizes work ([GitHub Issues adapter](github/records.md)) | Dedicated report issues in the selected repository |
| `git` | Git and access to the selected migration repository | `README.md` in the migration directory ([Git adapter](git/records.md)) | Tracked Markdown in the migration directory |
| `chatgpt-space` | ChatGPT Space integration and authenticated Space or Page reads | Root Page of a new Space or dedicated Page in an existing Space ([Space adapter](chatgpt-space/records.md)) | Ordinary Pages under the migration home |

Follow each candidate adapter's discovery procedure. Git requires repository and
file access, not a tracker integration. For plugin-backed providers, match the
canonical integration identity and use the current tool catalog and supported
plugin-management discovery. Distinguish
installed state, exposed operations, authenticated access, and successful writes.
If installation cannot be inspected, report the limit; missing tools do not prove absence.
Discover exact operation signatures rather than guessing. Discovery does not authorize
writes or automatic installation, connection, or configuration.

## Resolve a migration

When a local project is identified, check whether it contains
`.codemod/state.sqlite3` before interpreting its files as migration records.
That format belongs to the previous application; follow the
[upgrade guidance](../../../../docs/UPGRADES.md#existing-sqlite-projects).
A request to resume or inspect that project does not authorize conversion or
new initialization. Preserve its files and report the unsupported format.
A separately bound migration may coexist only at a verified nonoverlapping home;
the old database never supplies its binding, issue state, or approvals.

1. For a new migration, follow [initialize's integration selection](../../../initialize/references/integration-setup.md)
   before intake or environment setup; do not resume an older migration.
2. [Locate existing work](README.md#find-and-save-records), then read the migration
   home's saved Tracking configuration and resource index. Never infer a binding
   from issue keys, recency, available tools, or a familiar workspace. If the
   configuration is missing or unreadable, report the gap and stop before downstream
   record access. Clarify conflicting, ambiguous, or unsupported bindings before writes.
3. Load the bound provider's catalog adapter and the owning stage's
   [record guidance](#stage-adapters). Revalidate reads in this chat/runtime. Access
   failure does not authorize switching, mirroring, or moving records; preserve
   unsaved findings.

## Binding and resource identity

Initialize saves a compact **Tracking configuration** on the migration home; this
is routing metadata, not another workflow-state file or approval gate:

| Field | Record |
| --- | --- |
| Provider | Stable catalog ID and integration name when applicable. |
| Migration home | Native stable identity and verified record reference, qualified by tenant/workspace or repository. |
| Destination | Selected tenant/site/workspace and native team/space identities; GitHub host, records repository, and optional Project; or Git repository, authoritative branch, and migration directory. No development-account defaults. |
| Report store | Adapter-supported choice and its exact destination; for an external store record its separate site/space/parent or explicit root placement. |
| Mappings | Discovered work types, native status identities, review/decision representation, logical work groups, report roles, and human-action marker. |
| Resource index | Purpose, phase, record role, native identity and verified record reference for saved reports/environment and durable external evidence. When the adapter uses a dedicated index, store its verified reference here and keep the entries there. Omit artifacts not yet saved. |

Use human-readable fields, not a new state protocol. Work and report artifacts may
share a native type; preserve their distinct roles. Include report-store metadata
and record references in [copied workflow prompts](../../../workflow/references/handoffs.md).

## Operations and capability evidence

Each adapter implements native discovery; migration-home, work, hierarchy, and group
operations; prerequisite read/add/remove; review, acceptance, and cancellation mapping;
report/resource storage; comments and updates; and [progress-view evidence](../../../workflow/references/progress-view.md).
Check read, create, edit, and remove independently. Prove writes through the first
authorized substantive save and readback, never a dummy probe. A missing operation
blocks only dependent work; name and verify a concrete manual action when appropriate.
Enumerate relevant records completely and label partial inventories. Apply the
[shared record setup](README.md#record-setup) and [review representation](lifecycle.md#review-representation)
rules to native operations.

## Stage adapters

Use the bound provider's [catalog adapter](#provider-catalog) with the owning
stage's record specification below. If that row also names a procedure for the bound
provider, follow it alongside the catalog adapter. For writes, follow the
[template and readback rules](README.md#write-migration-records). Coordinators
use the selected stage's guidance. Native mechanics never override shared dependencies, evidence,
authority, or stage stopping points.

| Stage | Record guidance |
| --- | --- |
| Initialize | [Setup](../../../initialize/references/records.md) |
| Preflight | [Readiness checks](../../../preflight/references/records.md) |
| Assess | [Assessment](../../../assess/references/records.md) |
| Behaviors | [Behavior catalog](../../../behaviors/references/records.md) |
| Brief | [Brief](../../../brief/references/records.md) |
| Transform | [Phase transformation](../../../transform/references/records.md) |
| Verify target | [Whole-migration verification](../../../verify-target/references/records.md) |
| Status | [Read-only status](../../../status/references/records.md) |
