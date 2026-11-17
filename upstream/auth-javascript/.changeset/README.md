# Changesets

Add a changeset when a change affects package behavior, the public API, or integration
requirements:

```sh
pnpm changeset
```

Select the affected package, choose a semantic-version bump, and write a short summary
for developers using the SDK. Include any action an integrator needs to take. Commit the
changeset with the implementation. Documentation-only changes usually do not need one.

`@openai/auth` and `@openai/auth-react` share one fixed version group. Changesets applies
the highest version bump in the group to both packages and updates their internal dependency
ranges together. Select the package directly affected by the change.

Run `pnpm version:packages` to apply pending changesets. See the
[contributor guide](../docs/contributing.md) for checks and versioning instructions.
