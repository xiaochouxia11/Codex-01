# Source completeness

Inspect required inputs across the recorded boundary and its build context:

- Missing imports, includes, shared configuration, workspace/parent build files,
  submodules, and large-file placeholders.
- Generated source and its required schemas, generators, or other inputs.
- Data definitions: schemas, DDL, record layouts, and ORM mappings.
- Deployment and runtime descriptors: routes, service configuration, batch jobs,
  schedules, and relevant infrastructure definitions.
- Binary-only dependencies and unavailable source or private artifacts.

Report which inputs are missing, generated during the build, or intentionally
external. Use build definitions and manifests to establish requirements; do not
classify every absent descriptor as a defect. Record inspection coverage, examples
and counts where useful, and the analysis or execution each gap prevents.

Do not generate replacement inputs or widen scope. If completeness depends on an
unknown system boundary or an ownership decision, record the technical finding
and route that decision to initialize.
