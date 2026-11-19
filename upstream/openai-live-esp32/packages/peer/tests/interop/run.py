"""Credential-free loopback integration / adversarial tests against pinned aiortc.

Private aiortc hooks are used only to inject packets from this test's own endpoint.
"""

import argparse
import asyncio
import itertools
import re
import struct
from pathlib import Path

import aioice.ice
from aiortc import (
    AudioStreamTrack,
    RTCConfiguration,
    RTCPeerConnection,
    RTCSessionDescription,
)
from aiortc.mediastreams import MediaStreamError

# Keep traffic on loopback even on a laptop with VPN / multiple interfaces.
aioice.ice.get_host_addresses = lambda **kwargs: ["127.0.0.1"]


def fragment_hello(data, sequence):
    """Split plaintext ClientHello records without changing their transcript.

    Re-number epoch-zero records to give each fragment a distinct record number.
    Encrypted epoch-one records are copied unchanged.
    """
    result = []
    fragmented = 0
    while data:
        size = 13 + int.from_bytes(data[11:13], "big")
        header, payload, data = bytearray(data[:13]), data[13:size], data[size:]
        epoch_zero = header[3:5] == b"\0\0"
        if (
            epoch_zero
            and header[0] == 22
            and len(payload) > 12
            and payload[0] == 1
            and payload[6:9] == b"\0\0\0"
            and int.from_bytes(payload[9:12], "big") == len(payload) - 12
        ):
            body = payload[12:]
            mid = len(body) // 2
            pieces = []
            for offset, chunk in ((0, body[:mid]), (mid, body[mid:])):
                pieces.append(
                    payload[:6]
                    + offset.to_bytes(3, "big")
                    + len(chunk).to_bytes(3, "big")
                    + chunk
                )
            fragmented += 1
        else:
            pieces = [payload]
        for piece in pieces:
            if epoch_zero:
                header[5:11] = sequence.to_bytes(6, "big")
                sequence += 1
            header[11:13] = len(piece).to_bytes(2, "big")
            result.append(bytes(header) + piece)
    return result, sequence, fragmented


async def session(
    proc,
    *,
    reject=False,
    server=False,
    attacks=False,
    corpus=None,
    media="both",
    sdp_variants=False,
):
    use_audio, use_data = media != "data", media != "audio"
    pc = RTCPeerConnection(RTCConfiguration(iceServers=[]))
    received = 0
    consumers = []
    delayed_packets = []
    replies = asyncio.Queue()
    opened = asyncio.Event()
    captured = {}
    coalesced = None
    native_pong = asyncio.Event()
    epoch_zero_sequence = hello_fragments = 0
    padded_acks = 0
    dropped_handshake = False
    rtp_sent = 0
    held_rtp = None
    incoming_timestamps = []

    @pc.on("datachannel")
    def native_channel(channel):
        assert channel.label == "native"
        channel.on(
            "message", lambda data: native_pong.set() if data == "pong" else None
        )
        channel.send("ping")

    flight = bytearray([1 if server else 0])

    @pc.on("track")
    def on_track(track):
        async def consume():
            nonlocal received
            try:
                while True:
                    await track.recv()
                    received += 1
            except MediaStreamError:
                pass

        consumers.append(asyncio.create_task(consume()))

    try:
        line = await asyncio.wait_for(proc.stdout.readline(), 10)
        assert line.startswith(b"OFFER "), line
        offer = (await proc.stdout.readexactly(int(line.split()[1]))).decode()
        await pc.setRemoteDescription(RTCSessionDescription(offer, "offer"))
        sender = pc.addTrack(AudioStreamTrack()) if use_audio else None
        if use_data:
            dc = pc.createDataChannel("events", id=1 if server else 0)
            if attacks:
                pc.sctp._local_port = 6000  # Honor the remote SDP port, not 5000.
                original_sctp_send = pc.sctp._send

                async def padded_ack(stream_id, ppid, data, *args, **kwargs):
                    nonlocal padded_acks
                    if ppid == 50 and data == b"\x02":
                        # Pion sends this zero-padded DCEP ACK on real calls.
                        data += bytes(3)
                        padded_acks += 1
                    return await original_sctp_send(
                        stream_id, ppid, data, *args, **kwargs
                    )

                pc.sctp._send = padded_ack
            dc.on("open", opened.set)
            dc.on("message", replies.put_nowait)
        dtls = pc.sctp.transport if use_data else sender.transport
        if server:
            dtls._set_role("server")
        raw_send = dtls.transport._send
        raw_recv = dtls.transport._recv

        async def receive():
            data = await raw_recv()
            if len(data) >= 12 and data[0] >> 6 == 2 and not 192 <= data[1] <= 223:
                incoming_timestamps.append(int.from_bytes(data[4:8], "big"))
            return data

        dtls.transport._recv = receive

        async def capture(data):
            nonlocal epoch_zero_sequence, hello_fragments, dropped_handshake
            nonlocal rtp_sent, held_rtp
            if attacks and 20 <= data[0] <= 63 and not dropped_handshake:
                # Ordinary UDP loss must recover through DTLS retransmission.
                dropped_handshake = True
                return
            if coalesced is not None and data[0] == 23:
                coalesced.append(data)
                return
            if corpus and 20 <= data[0] <= 63:
                flight.extend(struct.pack("!H", len(data)) + data)
                if len(flight) < 16384:
                    corpus.mkdir(parents=True, exist_ok=True)
                    (corpus / f"flight-{server}-{len(flight)}").write_bytes(flight)
            if len(data) >= 12 and data[0] >> 6 == 2:
                is_rtcp = 192 <= data[1] <= 223
                captured["rtcp" if is_rtcp else "rtp"] = data
                if attacks and not is_rtcp:
                    rtp_sent += 1
                    if rtp_sent == 5:
                        held_rtp = data
                        return
                    if rtp_sent == 12:

                        async def deliver_late(packet):
                            # Use elapsed time: senders can emit catch-up bursts
                            # after the deliberately delayed DTLS handshake.
                            await asyncio.sleep(0.12)
                            await raw_send(packet)

                        delayed_packets.append(asyncio.create_task(deliver_late(data)))
                        return
                    if rtp_sent == 6:
                        # One reorder inside 40 ms, one after the deadline.
                        # These are original authenticated packets, not replays.
                        await raw_send(data)
                        assert held_rtp is not None
                        await raw_send(held_rtp)
                        held_rtp = None
                        return
            if attacks and not server and 20 <= data[0] <= 63:
                packets, epoch_zero_sequence, count = fragment_hello(
                    data, epoch_zero_sequence
                )
                hello_fragments += count
                for packet in packets:
                    await raw_send(packet)
            else:
                await raw_send(data)

        dtls.transport._send = capture
        await pc.setLocalDescription(await pc.createAnswer())
        answer = pc.localDescription.sdp
        if sdp_variants:
            # The tag owns BUNDLE transport attributes. Session defaults below
            # deliberately conflict, but media attributes override them.
            sections = answer.split("m=")
            assert len(sections) == 3
            prefixes = (
                "a=ice-ufrag:",
                "a=ice-pwd:",
                "a=fingerprint:",
                "a=setup:",
                "a=candidate:",
                "a=end-of-candidates",
                "a=tls-id:",
            )
            sections[2] = "\r\n".join(
                line
                for line in sections[2].split("\r\n")
                if not line.startswith(prefixes)
            )
            sections[0] += (
                "a=ice-ufrag:unused\r\na=ice-pwd:unusedSessionPasswordABCDE\r\n"
                "a=fingerprint:sha-256 " + ":".join(["AA"] * 32) + "\r\n"
                "a=setup:actpass\r\na=recvonly\r\n"
            )
            answer = "m=".join(sections).replace("s=-", "s=Voice 🎙")
            answer = answer.replace(" opus/", " OpUs/").replace(
                "fingerprint:sha-256", "fingerprint:SHA-256"
            )
        if reject:
            answer = re.sub(
                r"(?m)^(a=fingerprint:sha-256 ).+$",
                r"\g<1>" + ":".join(["00"] * 32) + "\r",
                answer,
            )
        answer = answer.encode()
        proc.stdin.write(f"ANSWER {len(answer)}\n".encode() + answer)
        await proc.stdin.drain()
        if not reject and use_data:
            await asyncio.wait_for(opened.wait(), 5)
            for value in ("ping", "", "microphone 🎙", "a" * 65536):
                dc.send(value)
                reply = await asyncio.wait_for(replies.get(), 3)
                assert reply == ("pong" if value == "ping" else value), (
                    len(value),
                    len(reply),
                )
            await asyncio.wait_for(native_pong.wait(), 3)
            if attacks:
                assert padded_acks >= 1
                # Authenticated SCTP delivery must still reject invalid UTF-8 / unknown PPIDs / oversize messages.
                await pc.sctp._send(dc.id, 51, b"\xc0\x80")
                await pc.sctp._send(dc.id, 999, b"unknown")
                await pc.sctp._send(dc.id, 51, b"z" * 65537)
                # Allow ordinary RTCP to arrive, then inject replay and invalid authentication tags.
                deadline = asyncio.get_running_loop().time() + 2
                while (
                    "rtcp" not in captured
                    and asyncio.get_running_loop().time() < deadline
                ):
                    await asyncio.sleep(0.02)
                assert {"rtp", "rtcp"} <= captured.keys(), captured.keys()
                for kind in ("rtp", "rtcp"):
                    packet = captured[kind]
                    await raw_send(packet)
                    await raw_send(packet[:-1] + bytes([packet[-1] ^ 1]))
                # Well authenticated, structurally invalid RTCP; correct sender SSRC, invalid report count.
                await dtls._send_rtp(struct.pack("!BBHI", 0x81, 201, 1, sender._ssrc))
                # Invalid SCTP packet delivered through valid DTLS must be discarded by usrsctp.
                await dtls._send_data(bytes(32))
                # One more good message proves the association survived malformed input.
                await asyncio.sleep(0.1)
                dc.send("ping")
                assert await asyncio.wait_for(replies.get(), 2) == "pong"
                # More records than one native poll's budget. The final ping
                # must drain from Mbed TLS without waiting for another UDP
                # datagram or an SCTP retransmission.
                coalesced = []
                for _ in range(6):
                    await dtls._send_data(bytes(32))
                await pc.sctp._send(dc.id, 51, b"ping")
                packet = b"".join(coalesced)
                assert len(coalesced) >= 7 and len(packet) <= 1536
                coalesced = None
                await raw_send(packet)
                assert await asyncio.wait_for(replies.get(), 0.75) == "pong"
        # The backpressure driver intentionally runs for 12 seconds to reach
        # the first randomized consent probe. Fast reconnects finish the data
        # checks early, so allow that full run plus a small scheduling margin.
        # Channel-open and message-response deadlines above remain unchanged.
        line = await asyncio.wait_for(proc.stdout.readline(), 15)
        assert line.startswith(b"RESULT "), line
        stats = {k: int(v) for k, v in re.findall(r"(\w+)=(\d+)", line.decode())}
        if reject:
            assert (
                stats["dtls_failures"] == 1 and stats["audio"] == stats["messages"] == 0
            ), stats
            assert not opened.is_set()
        else:
            if use_audio:
                assert received >= 10 and stats["audio"] >= 10, (received, stats)
                deltas = [
                    (b - a) & 0xFFFFFFFF
                    for a, b in itertools.pairwise(incoming_timestamps)
                ]
                assert deltas.count(1920) == 1 and set(deltas) == {960, 1920}, deltas
                if attacks:
                    assert stats["late"] >= 1 and stats["reordered"] >= 2, stats
                    assert stats["playout_lost"] >= 1, stats
            else:
                assert received == stats["audio"] == 0, stats
            assert stats["messages"] == ((7 if attacks else 5) if use_data else 0), (
                stats
            )
            if attacks:
                assert dropped_handshake
                assert stats["bad_rtp"] >= 2 and stats["bad_rtcp"] >= 3, stats
                if not server:
                    assert hello_fragments >= 2  # Initial and cookied ClientHello.
        print(
            f"PASS role={'server' if server else 'client'} reject={reject} attacks={attacks} decoded={received} {stats}",
            flush=True,
        )
    finally:
        await asyncio.gather(*delayed_packets)
        await asyncio.wait_for(pc.close(), 3)
        # A rejected handshake can leave a never-started receiver's recv()
        # blocked even after close. Own and cancel the harness consumers.
        for task in consumers:
            task.cancel()
        await asyncio.gather(*consumers, return_exceptions=True)


async def run(args):
    proc = await asyncio.create_subprocess_exec(
        args.executable,
        str(args.rounds),
        "reject" if args.reject else "accept",
        args.media,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
    )
    try:
        for _ in range(args.rounds):
            await session(
                proc,
                reject=args.reject,
                server=args.server,
                attacks=args.attacks,
                corpus=args.corpus,
                media=args.media,
                sdp_variants=args.sdp_variants,
            )
        assert await asyncio.wait_for(proc.wait(), 3) == 0
    finally:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("executable")
    parser.add_argument("--rounds", type=int, default=1)
    parser.add_argument("--reject", action="store_true")
    parser.add_argument(
        "--server", action="store_true", help="aiortc acts as DTLS server"
    )
    parser.add_argument("--attacks", action="store_true")
    parser.add_argument("--sdp-variants", action="store_true")
    parser.add_argument("--media", choices=["both", "audio", "data"], default="both")
    parser.add_argument(
        "--corpus", type=Path, help="save local DTLS test flights as fuzz seeds"
    )
    args = parser.parse_args()
    if args.sdp_variants and (args.media != "both" or args.reject):
        parser.error("--sdp-variants requires --media both without --reject")
    if args.attacks and args.media != "both":
        parser.error("--attacks requires --media both")
    asyncio.run(run(args))
