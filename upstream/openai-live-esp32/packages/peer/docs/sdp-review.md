# SDP review — 2026-10-08

This pass covers remote SDP parsing, ICE candidate decoding, and publication of
parsed state into the peer. It found identity-binding and transport-selection
bugs as well as interoperability and input-validation problems. No memory
corruption was reproduced; this is not proof that unknown defects are absent.

## Findings and fixes

| Finding | Effect before the fix | Resolution and regression evidence |
| --- | --- | --- |
| Media fingerprint sets did not fully override session fingerprints | A session SHA-256 fingerprint remained eligible when the media section supplied only an unsupported hash. The peer could accept an answer using the wrong identity binding. | Track the presence of each fingerprint set independently of supported algorithms. Any media set replaces the session set; require SHA-256 in the effective set. The regression reproduced successful acceptance of the invalid answer before the fix, then verifies rejection without leaving `NEW` or consuming the ability to supply a valid answer. No successful certificate-impersonation exploit is claimed. |
| ICE/DTLS values from different scopes were flattened | Valid media overrides of session ICE credentials, setup role, or fingerprint were rejected as conflicts. | Parse separate session/audio/data scopes, then resolve the tagged media's overrides. Check the resolved values in unit tests and establish real ICE/DTLS/audio/data sessions with deliberately conflicting session defaults. |
| BUNDLE transport fields were required on every section | Valid answers providing transport attributes only on the tagged section were rejected. | Apply the tagged section's transport to the group. Identical explicit repeats remain accepted for compatibility; conflicting repeats fail closed. Secondary sections cannot supply missing tag values. |
| Non-tag ICE candidates were merged into the selected transport | Secondary candidates could become probe destinations, or rescue an answer missing candidates on its BUNDLE tag. | Validate candidate syntax in all sections but select candidates only from the offered BUNDLE tag. Tests supply a distinct high-priority secondary candidate and an answer with only secondary candidates. The first cannot change the selected destination; the second is rejected. |
| SDP envelope and known-attribute validation was incomplete | Missing/malformed origin and timing, missing session name, repeated version lines, session fields inside media, and malformed known attributes could pass. | Require the mandatory header structure, bounded origin/timing syntax, known field types, valid attribute/MID tokens and correct SSRC placement. Unknown well-formed attributes remain ignorable. Every truncated prefix and the 1,023-byte line boundary are tested; rejected parses leave output unchanged. |
| ICE related address/port fields were ignored | Missing, duplicate, malformed, or overflowing related fields passed, and a valid related address was discarded. | Require related fields for reflexive/relay candidates, disallow them on host candidates, validate their syntax/ranges, and retain numeric related addresses. Tests include obfuscated `0.0.0.0:0`, overflow and duplicate fields. Related addresses are never used as probe destinations. |
| Valid text, encoding names and direction overrides were rejected | UTF-8 metadata, mixed-case Opus/hash names, and a media `sendrecv` overriding session `recvonly` failed. | Accept valid UTF-8 metadata while keeping credentials and tokens ASCII; compare encoding/hash names case-insensitively; resolve audio direction by scope. Duplicate directions and an effective unsupported direction still fail. |

The initial regression set produced **28 failing assertions** against the old
implementation. Those are assertions across these finding groups, not 28 separate
vulnerabilities. The expanded final SDP suite passes 1,172 checks.

The transport-scoping rules follow [RFC 9143 §7.1.3](https://www.rfc-editor.org/rfc/rfc9143#section-7.1.3),
ICE overrides and related fields follow [RFC 8839 §5](https://www.rfc-editor.org/rfc/rfc8839#section-5),
and fingerprint-set inheritance follows [RFC 8122 §5](https://www.rfc-editor.org/rfc/rfc8122#section-5).
Header/text handling uses the supported subset of [RFC 8866](https://www.rfc-editor.org/rfc/rfc8866).

## Validation

- 1,172 SDP checks, 1,049 existing security assertions and 114 audio checks pass
  with AddressSanitizer and UndefinedBehaviorSanitizer.
- Six independent aiortc sessions pass using tagged-section-only transport,
  conflicting session defaults, UTF-8 metadata and case variants: three per DTLS
  role, with decoded Opus and data messages.
- Six existing adversarial aiortc sessions pass, along with fingerprint rejection
  in both roles and isolated audio/data modes.
- The parser fuzzer now asserts atomic rejection and basic accepted-state
  invariants, with additional scope/fingerprint/UTF-8 seeds. A final 31-second
  run completed 472,546 inputs without a sanitizer failure. An earlier 61-second
  run completed 920,084 inputs. These are bounded smoke tests, not exhaustive
  coverage.
- Standalone release embedding and the ESP-IDF Waveshare build pass. The firmware
  fits the existing app partition. The target compiler reports a 7,024-byte static
  parser frame, excluding its callers/callees; the app controller uses 64 KiB.
- This pass did not flash the device or repeat the physical voice tests. The
  earlier device validation remains evidence for the earlier firmware only.

## Separate dependency finding from CI

The [initial CI run](https://github.com/openai/openai-live-esp32/actions/runs/37808771772)
passed the SDP tests and parser fuzzing, then DTLS fuzzing triggered UBSan in
Mbed TLS 3.6.7's `x509_name_cmp`: an empty Name led to `memcmp(NULL, NULL, 0)`.
Zero length does not waive `memcmp`'s nonnull contract. This is a reproduced
undefined operation, not evidence of memory corruption or a demonstrated exploit.

The source patch guards both the OID and value comparisons at zero length and
preserves empty-name comparison semantics. The same guarded, idempotent patch
applies to pinned host and ESP-IDF sources; system-library users must supply an
equivalent fix. Verification of an initialized empty certificate chain now
provides a deterministic regression and must still report untrusted status.
It reproduced the same UBSan failure locally before the patch using an explicit
nonnull declaration matching Linux's libc contract, and passed after the patch.
The original CI datagram was not retained, so this is not an exact replay of that
input. CI now preserves future fuzz failure inputs as short-lived artifacts.

All four native test targets pass after the patch, as do adversarial SDP-variant
sessions in both DTLS roles. A local DTLS fuzz run completed 3,653 inputs in
31 seconds without a sanitizer finding. Dependency preparation was applied twice
and the Waveshare firmware rebuilt successfully. No device flash was performed.

## Remaining scope and risks

This is a bounded WebRTC-answer parser, not a general SDP implementation. It
retains the offered media order, requires every offered section to be accepted
and bundled, and supports one SHA-256 certificate identity. Rejected m-lines,
BUNDLE-tag replacement, multiple certificate alternatives, renegotiation,
non-UTF-8 metadata, and general Opus `fmtp`/`ptime` negotiation remain unsupported.
Codec parameter constraints are not propagated to an application encoder; callers
must account for that limitation before accepting arbitrary peers. Connection,
bandwidth, scheduling and unknown extension fields are not comprehensively
interpreted. No full SDP standards-conformance claim is made.

Signaling still must be authenticated. Correct tag selection does not replace a
deployment's destination policy: numeric private/loopback candidate addresses
remain allowed. The conservative treatment of conflicting repeated BUNDLE
attributes can reject nonconforming peers. The new scope buffers increase stack
use; other embedded ports must budget caller and crypto frames as well as the
parser frame.
