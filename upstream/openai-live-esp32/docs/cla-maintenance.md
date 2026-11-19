# CLA setup and verification

The workflow collects individual contributor agreements through GitHub pull
request comments. It uses the same pinned
[CLA Assistant action](https://github.com/contributor-assistant/github-action/tree/ca4a40a7d1004f18d9960b404b97e5f30a505a08)
as [OpenAI Codex](https://github.com/openai/codex/blob/main/.github/workflows/cla.yml).
It needs only the repository's temporary `GITHUB_TOKEN`, with no personal
access token, external signature repository, or hosted OAuth application.

**Adding the workflow does not establish enforcement.** Complete the activation
and acceptance checks below before relying on it. A green check is an aid to
review; maintainers must verify the underlying agreement evidence.

## Agreement and signature records

- [CLA.md](../CLA.md) contains the project-specific individual agreement.
  The workflow links to immutable commit
  `d837e460f81aa89bd6338a3e66fd9dcf37d9b440`, rather than a changeable branch URL.
- Records belong in `signatures/cla-v1.json` on `cla-signatures`, separate from
  the source branch. Each record includes a GitHub identity and signing-comment
  metadata. Do not insert a person into this file on their behalf.
- The bot allowlist contains only the two explicitly named automation accounts.
  Repository membership or collaborator status does not exempt a person.
- Changes to agreement terms require legal review and an explicit decision
  about renewed consent. Do not point existing records at different terms.
- A corporate agreement requires a separate review. Do not put confidential
  contracts or counterparties' personal details in this repository.

## Activation checklist

1. Create `cla-signatures` without overwriting any existing branch. Initialize
   `signatures/cla-v1.json` with exactly `{"signedContributors":[]}`.
   Precreating the empty file avoids the pinned action's unreliable
   missing-file initialization path. Preserve any existing signatures.
2. Review the pinned action and this workflow, then merge the workflow onto
   `main`. These event handlers must be on the default branch to operate.
   Never add a PR-head checkout or run contributor-supplied code in this job.
3. Configure `main` to require pull requests, approval by a trusted maintainer
   (enforced through code ownership), and the observed `cla` check from GitHub
   Actions. Cover agreement, workflow, and ownership-file changes in that review.
   Do not allow outside contributors to bypass those requirements.
4. Review signature-storage permissions. The action needs to update its branch.
   **Do not treat a writable JSON entry as proof of consent:** a repository
   writer or another writable workflow may modify it. For every external
   contributor, verify the original GitHub-authenticated signing comment and
   identity before approving a merge, and record the evidence in the review.
   If a stronger independent signing service is required, replace this storage
   model rather than granting a broad bypass to all Actions workflows.
5. Run the acceptance checks below and retain their PR, comment, and run links.
   Confirm the required check actually blocks merging; its presence in the
   Actions tab is not sufficient.
6. Reassess signature-record visibility before changing repository visibility.
   This setup does not itself authorize publication or external access.

## Acceptance checks

Use a willing contributor's real agreement, never a fabricated test signature.

| Scenario | Required result |
| --- | --- |
| Unsigned author opens a PR | The bot requests consent and the required check blocks merging. |
| That person reads the pinned agreement and posts the exact signing comment | The record identifies that person's numeric GitHub ID and original comment; the PR check is rerun and passes. |
| An unrelated person signs or comments on an ordinary issue | The unsigned PR author's requirement is not satisfied. |
| An unsigned author is added in a later commit | The synchronized PR check fails again. |
| A previously recorded signer opens another PR | The bot recognizes the signature; the reviewer verifies its original evidence. |
| A PR is closed without merging | Its conversation remains unlocked. |
| A PR is merged | Its conversation is locked as configured; the original evidence remains available. |

Do not have an agent or maintainer post consent for someone else. For a corporate
contributor, separately confirm the applicable employer authorization or corporate
agreement; automation cannot establish that fact.

## Limits requiring maintainer review

The upstream action was archived in March 2026. Pinning protects against an
unexpected version change; it does not imply ongoing upstream maintenance.

The pinned implementation inspects only the first 100 commits and first page of
comments. It can fall back from an unmapped commit author to the committer and
does not collect co-author trailers as separate contributors. Consequently,
**do not merge based on the automated result alone**: inspect all contributors,
including co-authors and authors of copied patches, and resolve unmapped authors
or large PRs before approval. If signing is missed in a long discussion,
investigate the pagination limit rather than manually claiming the person signed.

Concurrent signatures are serialized, but GitHub may replace a queued workflow
run. A contributor or maintainer can comment `recheck` to retry. A failed or
skipped run does not establish consent, and no signatures should be assumed
solely from a passing check or the JSON file.
