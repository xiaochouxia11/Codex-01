# Workflow access

Verify that this task can use the CodeMod plugin, selected extra skills, and
the migration's saved record provider and report store. Run first in the same execution
task as the other requested checks. No source checkout is needed; the provider's
own record-access requirements still apply.

## Self-contained issue steps

During setup, copy and specialize these steps in the check issue. Use the bound
provider adapter and available operations to insert concrete native actions and
required parameters for reading records, comments, blockers, and indexed documents;
applying mapped states and human-action markers; and saving the Result and required
comments. Include verified provider and destination context, migration-home, parent/check,
intent/environment and report-store identities or references, selected skill references,
and expected plugin version when known. Include only the saved report-store path.
Read back the completed issue: it must be executable without this plugin or its
adapter files and contain no unresolved template markers. Name missing operations
as gaps; never invent them.

1. Read this issue, all relevant comments, directed blockers and their states,
   the migration home and binding, complete indexed intent and Execution environment
   including required linked parts, parent, and requested checks. Use only the saved
   provider and report store; make no optional store discovery calls. Conflicting or
   inaccessible records are gaps. Unresolved
   blockers or human decisions keep the check unstarted. If the provider is unavailable,
   return unsaved findings in chat and do not start other checks.
2. Once eligible, apply the mapped active state and record this task's actual Local
   or Cloud context and available identity. An earlier task or configuration name
   does not prove this task's capabilities.
3. Verify these skills are exposed and their `SKILL.md` files are readable from one
   package: codemod, workflow, initialize, status, preflight, assess, behaviors,
   brief, transform, and verify-target. Record the plugin identifier, version and
   location; compare any expected version. Cloud uses the published plugin; Local
   may use the selected development installation. Read preflight and the supporting
   check procedures, templates, shared record and execution guidance, selected provider
   adapter, and CodeGraph guidance. A listing alone is insufficient. If plugin files
   cannot be loaded, record the gap and continue to the Result save and review steps;
   do not install or copy files to bypass it.
4. Read each extra skill selected in intent and its Execution environment setup
   entry; compare the available content with the recorded reference or snapshot.
   Record identity, setup mode, availability, applicability, and gaps. In Cloud,
   check in a new task after publication. Inspect later-stage-only instructions
   without activating them; their gaps block only consumers. `None` or `Open`
   enables no extra skills. Return missing setup to initialize.
5. Record task/runtime, plugin and skill findings, selected provider and report-store
   reads, gaps, and affected work in this check's Result; save and read it back.
   Preserve unrelated content and labels. This substantive save proves issue-write
   access only; apply any provider checkpoint without implying remote publication.
   Report-store read access, exposed create/edit operations, permission
   evidence, and actual substantive writes are separate. Do not create a dummy record,
   probe unused removal/upload operations, or expose credentials. A failed save leaves
   findings unsaved in chat.
6. Apply the mapped review and acceptance state under saved authority. Missing required
   plugin files, version mismatches, unreadable required records, or unavailable selected
   skills applicable to preflight keep the check unfinished; state the fix and retry.
   For human action, apply the mapped marker and comment with the action and owner when
   known. Do not change siblings, execution choices, or application source; install,
   build, and graph work belong elsewhere. If Workflow access was the requested
   check, stop here; otherwise continue only after this check is accepted.
