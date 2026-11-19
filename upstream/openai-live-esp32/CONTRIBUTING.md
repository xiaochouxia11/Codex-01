# Contributing

This is an experimental project, not officially supported by OpenAI. Support
and response times are not guaranteed.

## Contributor License Agreement

Before we accept a contribution, each contributor must agree to the
[Contributor License Agreement (CLA)](CLA.md). Read the agreement before
signing. When the CLA Assistant comments on your pull request, follow its
instructions and post this exact comment from your own GitHub account:

> I have read the CLA Document and I hereby sign the CLA

Do not sign on someone else's behalf. A checked box in a pull request template
or a Git commit sign-off does not replace the CLA. If the assistant does not
respond, ask a maintainer before merging; silence is not confirmation that
the requirement has been satisfied.

If your employer has rights in your contribution, make sure the conditions in
section 4 of the CLA are satisfied. Contact a maintainer if your organization
needs a corporate agreement. A CLA does not grant repository access or replace
any separately required confidentiality agreement.

The assistant records your GitHub identity and the signing comment's metadata
on this repository's `cla-signatures` branch. Maintainers verify the original
signing comment before accepting a contribution.

## Preparing a change

- Keep changes focused and explain the problem and resulting behavior.
- Include relevant tests. For hardware changes, report the board revision,
  ESP-IDF version, firmware commit, and the physical checks you performed.
- Run the relevant checks in the [testing guide](docs/testing.md). Changes to
  shared code should preserve the Waveshare, M5Stack, and Sonatino examples.
- Retain third-party licenses and notices, and identify the source and license
  of any newly included code or assets.
- Include sanitized logs and reproduction steps. Never submit API keys,
  Wi-Fi credentials, private conversations, build directories, flash backups,
  or firmware images.

For vulnerability reports, follow [SECURITY.md](SECURITY.md).

Maintainers: see [CLA setup and verification](docs/cla-maintenance.md) before
enabling collection or treating its check as a merge requirement.
