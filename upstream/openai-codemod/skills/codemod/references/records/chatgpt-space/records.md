# ChatGPT Space adapter

Use for candidate discovery or a confirmed `chatgpt-space` binding with the
[shared record policy](../README.md) and [owning stage](../issue-systems.md#stage-adapters).
The ChatGPT Space integration (Pages) stores work and reports as ordinary Pages.

## Discovery and binding

Before Initialize presents the provider choices, discover the current Space and
Page operations and check authenticated read access. For a supplied Space, use
`get_space` and pass its returned `root_page_id` to `read_page`. For a directly
shared parent, read that Page and check that its drive scope is Space. Otherwise call
`list_spaces`. Follow continuation cursors before declaring the list empty.

A successful read makes ChatGPT Space selectable, including a successful empty list.
Report missing operations, authentication failure, or an explicit workspace-policy
denial with the choices. Attribute a restriction to an admin only when the service
identifies the policy. An inconclusive read leaves access unverified. Discovery
is read-only. Neither tool presence nor a successful read proves permission to create.

After selection, confirm the destination and name under the
[home setup procedure](../../../../initialize/references/records.md#establish-the-migration-home).
For a new named Space (the default), call `create_space` once and read its returned
root Page as the home. For an existing Space, create a dedicated home with
`create_page(space_id)`. Under a supplied shared parent, use `parent_page_id`
instead. Verify the home's Space ID and parent on readback. If the shared parent
read omits the Space ID, use the child's metadata or the entry returned by
`list_pages(parent_page_id)`. An unresolved Space ID leaves the binding pending.

If `create_space` or creation of the home Page is explicitly denied before binding,
explain which write was denied. Offer another available destination, including an
existing Space or shared parent where the user can add Pages. If none is available,
return to the [provider chooser](../../../../initialize/references/integration-setup.md#confirm-one-provider).
Wait for the user's choice before writing. On access loss after binding, keep the saved destination.

Under the bound home, create or reuse two direct child Pages using the
[Issues template](../../../../initialize/assets/chatgpt-space/issues.md) and
[Resources template](../../../../initialize/assets/chatgpt-space/resources.md).
Save their verified IDs and links in the home's
[Tracking configuration](../issue-systems.md#binding-and-resource-identity)
alongside the workspace, Space ID, home Page ID and URL, and record mappings.
Resources serves as both the report store and the single resource index.
On resume, verify the saved binding.
For an older layout, follow existing record IDs. When reorganizing, move the
existing groups and resources under their respective parents and verify the
IDs and links. If the home has a legacy report table, reconcile its entries into
Resources and read them back before replacing the table with a link to Resources.
Read-only status uses the current tree.

## Native record mapping

| Record | Representation |
| --- | --- |
| Migration home | Use the [home template](../../../../initialize/assets/chatgpt-space/migration-home.md). Refresh its progress summary from the owning work Pages at [progress checkpoints](../lifecycle.md#progress-checkpoint) and apply the [migration lifecycle](../lifecycle.md#migration-lifecycle) to its state. |
| Work groups and hierarchy | Under Issues, use the [workflow group templates](../../../../workflow/references/setup.md#work-groups). Put work beneath its group and slices beneath their phase aggregate using actual parent Page IDs. For parent issues, apply the [owning stage's template](../README.md#write-migration-records), including its applicable child links. |
| Work item | An ordinary Page with **State**, **User Required** (Yes/No), **Blocked by**, and the owning stage's body and results. The Page ID is the stable identity. |
| Report or execution environment | Use the [owning stage's template](../README.md#write-migration-records) for each substantive report Page under Resources. Index it by purpose and phase on Resources and link it from the owning work Page for [report verification](../artifacts.md#create-documents-when-there-is-content). Put verified links to external resources on Resources. |
| Discussion and updates | Native comments on the work Page. At the first substantive migration update, create the updates Page under Resources, link it from the home, and maintain dated entries there. |

Use Backlog, In Progress, In Review, Done, and Canceled for work. Apply the
[shared review authority](../reviews.md) and the owning stage's acceptance
procedure. An authorized user may accept through Codex or set the owning work
Page's State to Done. A saved report or resolved comment does not grant approval.

Store each directed prerequisite once as a verified link in the downstream work
Page's **Blocked by** field. Use None when empty. For additions and removals,
verify both work Pages belong to this migration, check direction and cycles,
preserve other links, and read back the edited field. Derive reverse dependencies
from the relevant inventory. Only Done satisfies a dependency.

Use a Sheet under Resources when filtering or calculation helps, link it from the owning Page,
and keep required records, results, and approvals on Pages.

## Writes and checkpoints

When adding or changing a group or resource, update its named link on Issues or
Resources respectively. Read the saved index Page body and match the link label
and destination to the verified Page ID or external URL. A child listing alone
does not verify the link. Reconcile missing or misdirected links in place.

Read the current Page and relevant comments before editing. Use observed block
IDs and hashes for targeted edits. Inspect each operation receipt and read back
affected content, links, state, and parentage. On conflicts or partial writes,
reread the affected blocks and reconcile only outstanding changes, preserving
concurrent human edits. Verify new comments by thread/message ID.

Give each Page creation its own idempotency key. After an uncertain outcome,
reconcile against the selected parent and reuse the key and exact arguments for
any retry. Space creation takes no such key. Reconcile the listing and root
identity first. If ownership or the outcome is ambiguous, stop before creating
another Space. Follow the shared
[progress checkpoint](../lifecycle.md#progress-checkpoint).

## References, status, and progress

Use returned Page URLs and stable IDs in handoffs. Inventory the requested
home branch with `list_pages`, following child Pages and continuation cursors
within that branch. Read the owning records and unresolved prerequisites. Count
only work Pages. Exclude the two organizing Pages, groups, reports, updates, and Sheets from work totals.
Treat incomplete listings and unreadable records as partial coverage.

For the [progress view](../../../../workflow/references/progress-view.md),
qualify identity by provider, workspace, Space and home Page ID. Label the
verified home **Open ChatGPT Space migration**. Use Page update times for
resource recency and the work fields above for state and human action.
