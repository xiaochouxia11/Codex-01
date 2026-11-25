# Boundary crossings

Verify the recorded system boundary against source references and the containing
workspace, solution, or repository. Inspect both directions:

- **Outbound:** code inside the boundary depends on shared libraries, parent build
  files, includes, schemas, services, or packages outside it.
- **Inbound:** outside consumers depend on affected APIs, data, packages, or components
  inside the boundary. Inspect accessible sibling manifests and direct references.

Name the crossing, direction, paths or contract, and affected component. Distinguish
crossings of the source boundary from dependencies on unchanged components inside
it. Compare findings with the consumers and compatibility requirements in intent.
A standalone repository can still have external consumers.

Keep this a bounded check of immediate relationships. Record inspected and
uninspected areas; no matches do not establish no consumers. Deeper migration-impact
mapping belongs to assessment.

Put newly discovered consumers or conflicts with intent in Next action for
`codemod:initialize`. Preflight reports technical relationships; initialize
resolves importance, acceptable changes, ownership, and any scope amendments.
