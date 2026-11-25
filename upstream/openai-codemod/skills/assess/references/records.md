# Queue assessment records

Follow [shared record setup](../../codemod/references/records/README.md#record-setup)
and the [bound provider's adapter](../../codemod/references/records/issue-systems.md#stage-adapters).
Create or repair the assessment records needed for the request.

## Records

Create or reuse **Assess migration — System — Migration** in Readiness using
the [parent template](../assets/assessment-issue.md). Link the intent and
an existing assessment document when available; omit the Assessment field otherwise.
This parent performs synthesis after investigation review. Assessment creates or
reuses **System — Migration assessment** at its first substantive, unblocked
[synthesis](reporting.md#synthesize-reviewed-findings).
Do not create an empty document during record setup. Preserve existing reports
and findings when repairing issues.

### Investigations

For full assessment, create or reuse these four children under the assessment parent using the
[investigation template](../assets/investigation.md):

| Issue | Procedure |
| --- | --- |
| Architecture and migration impact | [Architecture](investigations/architecture-and-impact.md) |
| Identify actors and user journeys | [Actors and journeys](investigations/actors-and-journeys.md) |
| Maintainability and verification | [Maintainability](investigations/maintainability-and-verification.md) |
| Security assessment | [Security](investigations/security.md) |

Read the [assessment skill](../SKILL.md) and each in-scope investigation procedure
to specialize its scope, limits, and required evidence. Procedure identifies
`codemod:assess`, with reporting for the parent and the matching reference for
each child.
The actor/journey issue owns roles, goals, journeys, evidence, and open questions;
architecture owns technical components, flows, and contracts. Synthesis joins
their findings in the existing assessment resource. Use the common review rules;
this adds no separate document or approval checkpoint.

**Maintainability and verification** owns [source-quality analysis](investigations/source-quality.md).
Select measurements that answer a migration question. Save the findings, coverage,
and implications on this child. Preflight checks tool availability.

## Dependencies

Apply the common [readiness dependencies](../../codemod/references/records/README.md#technical-work-prerequisites)
to affected assessment work. Link applicable producer issues when they exist; the
table describes the full assessment dependency graph. Otherwise use
[equivalent prerequisite evidence](../../codemod/references/records/README.md#prerequisite-evidence)
for that investigation without fabricating earlier work:

| Downstream issue | Upstream issues that block it |
| --- | --- |
| Architecture and migration impact | Source access; Detect the stack; Source completeness; Boundary crossings; Build source graph. |
| Identify actors and user journeys | Source access; Source completeness; Boundary crossings. |
| Maintainability and verification | Source access; Detect the stack; Source completeness. |
| Security assessment | Source access; Detect the stack; Source completeness; Boundary crossings. |
| Assess migration | All four assessment investigations. |

For **Maintainability and verification**, confirm current capability evidence for
each required source-analysis tool from Analysis tooling or equivalent verified
evidence before using it. Do not add the whole Analysis tooling issue as a native
blocker: an unrelated tool gap must not block this investigation. A missing required
capability keeps the affected analysis unfinished unless an adequate fallback is
agreed; continue independent work.

Actor/journey discovery can run alongside architecture. Reuse available technical
IDs; synthesis connects the reviewed journeys to architecture once both are ready.
Do not add a dependency between those children or require the source graph for
actor discovery.

Do not make children depend on the assessment parent or make preflight depend on
assessment. Do not block assessment on the entire Preflight parent or the combined
Build toolchain issue: unresolved target choices may be assessment inputs. Reuse
available source build results with their limits; do not claim execution proof
when they are absent. A specifically required additional prerequisite needs its
own agreed issue, not a blanket target-readiness gate.

## Update and hand off

Add the assessment parent to the Readiness work group's issue index and its review
to the completion criteria. After an accepted-intent revision, preserve prior
findings and identify which investigations and synthesis need refreshing; the
[intent revision procedure](../../initialize/references/records.md#intent-work-and-acceptance) restores blockers.
