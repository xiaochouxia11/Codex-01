"""Canonical FAT-safe media paths, with support for earlier flat packs."""


def media_path(index, version=3):
    if (
        type(index) is not int
        or not 0 <= index < 30000
        or type(version) is not int
        or version not in (2, 3)
    ):
        raise ValueError("Invalid media index or pack format")
    folder = f"CINEMA3/{index // 256:02X}" if version == 3 else "CINEMA"
    return f"{folder}/{index:04d}.SCF"
