"""Generate non-secret protocol seeds; output is an ignored fuzzing corpus."""

import binascii
import hashlib
import hmac
import struct
import sys
from pathlib import Path

root = Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
fp = ":".join(["AA"] * 32)
sdp = "\r\n".join(
    [
        "v=0",
        "o=- 1 1 IN IP4 0.0.0.0",
        "s=-",
        "t=0 0",
        "a=group:BUNDLE audio data",
        "a=ice-ufrag:abcdefghijklmnop",
        "a=ice-pwd:abcdefghijklmnopqrstuvwxyz012345",
        f"a=fingerprint:sha-256 {fp}",
        "a=setup:active",
        "m=audio 9 UDP/TLS/RTP/SAVPF 111",
        "a=mid:audio",
        "a=rtpmap:111 opus/48000/2",
        "a=rtcp-mux",
        "a=ssrc:123 cname:peer",
        "a=candidate:1 1 UDP 2122260223 127.0.0.1 12345 typ host",
        "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
        "a=mid:data",
        "a=sctp-port:5000",
        "a=max-message-size:65536",
        "",
    ]
).encode()
(root / "sdp").write_bytes(b"\x01" + sdp)
# Exercise valid BUNDLE tag-only transport and media/session override paths.
transport_names = (b"a=ice-ufrag:", b"a=ice-pwd:", b"a=fingerprint:", b"a=setup:")
lines = sdp.split(b"\r\n")
transport_lines = [line for line in lines if line.startswith(transport_names)]
tag_lines = [line for line in lines if not line.startswith(transport_names)]
tag_lines[tag_lines.index(b"a=mid:audio") + 1 : tag_lines.index(b"a=mid:audio") + 1] = (
    transport_lines
)
tag_sdp = b"\r\n".join(tag_lines)
(root / "sdp-tag-only").write_bytes(b"\x01" + tag_sdp)
(root / "sdp-override").write_bytes(
    b"\x01"
    + tag_sdp.replace(
        b"t=0 0",
        b"t=0 0\r\na=ice-ufrag:unused\r\na=ice-pwd:unusedSessionPasswordABCDE\r\na=setup:passive",
    )
)
(root / "sdp-utf8").write_bytes(b"\x01" + tag_sdp.replace(b"s=-", "s=Voice 🎙".encode()))
(root / "sdp-fingerprint-override").write_bytes(
    b"\x01"
    + sdp.replace(
        b"a=mid:audio",
        b"a=mid:audio\r\na=fingerprint:sha-384 " + b":".join([b"BB"] * 48),
    )
)
(root / "candidate").write_bytes(
    b"\x04a=candidate:1 1 UDP 2122260223 127.0.0.1 12345 typ host"
)
(root / "rtp").write_bytes(
    b"\x02" + bytes.fromhex("80 6f 0001 00000000 00000001 f8fffe")
)
(root / "rtcp").write_bytes(b"\x02" + bytes.fromhex("80 c9 0001 00000001"))
# Padding contributes to the wire length but not the logical APP body.
(root / "rtcp-short-padded-app").write_bytes(
    b"\x02" + bytes.fromhex("a0 cc 0003 00000001 00000000 00000008")
)
(root / "rtcp-padding-alignment").write_bytes(
    b"\x02" + bytes.fromhex("a0 cc 0003 00000001 00000000 00000001")
)
(root / "rtcp-invalid-compound-type").write_bytes(
    b"\x02" + bytes.fromhex("80 c9 0001 00000001 80 01 0000")
)
(root / "dcep").write_bytes(
    b"\x03\x01\x32\x00" + bytes.fromhex("03 00 0000 00000000 0006 0000") + b"events"
)
(root / "dcep_ack").write_bytes(bytes([3, 1, 50, 1, 2]))
(root / "data").write_bytes(bytes([3, 3, 51, 1]) + b"hello")
attr = struct.pack("!HH", 6, 9) + b"abcd:efgh" + bytes(3)
head = struct.pack("!HHI", 1, len(attr) + 24, 0x2112A442) + bytes(range(12))
mi = hmac.new(
    b"test-password-with-at-least-22-characters", head + attr, hashlib.sha1
).digest()
head = struct.pack("!HHI", 1, len(attr) + 32, 0x2112A442) + bytes(range(12))
packet = head + attr + struct.pack("!HH", 8, 20) + mi
packet += struct.pack("!HHI", 0x8028, 4, binascii.crc32(packet) ^ 0x5354554E)
(root / "stun").write_bytes(b"\x00" + packet)

# Raw SCTP chunks for the in-memory association fuzzer (header/CRC repaired there).
sctp = root.parent / "corpus-sctp"
sctp.mkdir(exist_ok=True)
(sctp / "init").write_bytes(
    struct.pack("!BBHIIHHI", 1, 0, 20, 12345678, 65536, 16, 16, 1234)
)
(sctp / "sack").write_bytes(struct.pack("!BBHIIHH", 3, 0, 16, 1234, 65536, 0, 0))
(sctp / "dcep").write_bytes(
    struct.pack("!BBHIHHI", 0, 3, 34, 1234, 0, 0, 50)
    + struct.pack("!BBHIHH", 3, 0, 0, 0, 6, 0)
    + b"events"
    + bytes(2)
)
(sctp / "large").write_bytes(
    struct.pack("!BBHIHHI", 0, 3, 1024, 1234, 0, 0, 51) + b"a" * 1008
)
