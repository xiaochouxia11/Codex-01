# Credentials and device security

This experimental example stores a project API key and Wi-Fi profiles in device
flash so it can run without a separate backend. That is a development convenience,
not a production credential-provisioning design.

- Keep the API key file and Wi-Fi JSON outside the repository. The setup tool
  generates its credential header in an external cache with restrictive permissions.
- Locally built ELF files, firmware images, object files, and flash backups can
  contain those credentials. Do not upload them to issues, releases, or public storage.
- USB logs may contain transcripts, network names, session IDs, and API errors.
  Review and sanitize logs before sharing them.
- Screenshots may contain conversation text. Publish only captures you intend
  to share.
- Rotate credentials if a device or build artifact is shared unintentionally.
- For a product, design appropriate credential provisioning and device storage
  protection. The portable core leaves authentication to the application.

TLS certificate verification remains enabled. The HTTPS adapter does not follow
redirects while presenting the API key.

## Reporting vulnerabilities

Report suspected vulnerabilities privately through [OpenAI's coordinated
vulnerability disclosure process](https://openai.com/policies/coordinated-vulnerability-disclosure-policy/).
Questions about the process can be sent to disclosure@openai.com. Include this
repository's name, the affected commit/dependency version, impact, and a minimal
sanitized reproduction. Do not include credentials, personal recordings, camera
images, or unredacted device logs, and do not open a public issue with exploit details.

GitHub's private-reporting control may also be used if available on this repository;
its availability is not a prerequisite for the disclosure route above. Dependency
findings should distinguish a reproduced upstream issue from a local adapter bug
or a precautionary hardening change. A local workaround does not establish that
an upstream release is fixed or that a coordinated disclosure has occurred.

The project remains experimental and unsupported. See the [transport review and
test limitations](packages/peer/docs/security-review.md) for the reviewed surface.
