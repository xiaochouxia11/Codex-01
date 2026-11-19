#!/usr/bin/env python3
"""Prepare private Sonatino configuration and the shared peer dependencies."""

import argparse
import os
from pathlib import Path

from prepare_peer import prepare
from prepare_voice import load_wifi, write_secrets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache", type=Path, default=Path.home() / ".cache/openai-live-sonatino"
    )
    parser.add_argument("--key-file", type=Path)
    parser.add_argument("--wifi-file", type=Path, required=True)
    args = parser.parse_args()
    key = (
        args.key_file.read_text().strip()
        if args.key_file
        else os.environ.get("OPENAI_API_KEY", "")
    )
    if not key:
        parser.error("Set OPENAI_API_KEY or supply --key-file (value is never printed)")
    try:
        networks = load_wifi(args.wifi_file)
    except ValueError as exc:
        parser.error(str(exc))
    if not networks:
        parser.error("At least one Wi-Fi profile is required")
    args.cache.mkdir(parents=True, exist_ok=True, mode=0o700)
    args.cache.chmod(0o700)
    write_secrets(args.cache / "private", key, networks)
    prepare(args.cache / "vendor/peer")
    print(f"Private configuration: {args.cache / 'private'}")
    print(f"Peer dependencies: {args.cache / 'vendor/peer'}")


if __name__ == "__main__":
    main()
