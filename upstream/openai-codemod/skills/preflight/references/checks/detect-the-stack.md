# Detect the stack

Inventory the recorded source boundary, including supporting code outside the
parts being changed. For a monorepo, identify the containing workspace/build root
and shared configuration without counting unrelated applications as this system.

- Identify languages from extensions and representative files; frameworks,
  dependencies, and runtime pins from manifests and lockfiles.
- Identify build/package systems, generators, CI, deployment descriptors, and
  configuration. Record relevant paths without secret values.
- Count files and approximate shares by language/type. Include hidden configuration;
  exclude `.git/`, caches, and build outputs. Separate generated/vendor code,
  avoid nested directory symlinks and overlapping-root double counts, and state
  unreadable areas and other exclusions.

Distinguish configured versions from installed ones. Use repository-relative paths
and verified commit-specific links where available. This inventory informs the
remaining checks; it does not prove execution or replace a later architecture
or dependency assessment.
