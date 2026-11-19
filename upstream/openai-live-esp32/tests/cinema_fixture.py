"""Generate a tiny, original black-frame pack for firmware CI (no API/media downloads)."""

import base64
import argparse
import importlib.util
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))


def create(path, encoder="potion"):
    spec = importlib.util.spec_from_file_location(
        "cinema",
        Path(__file__).resolve().parents[1] / "tools/prepare_stackchan_cinema.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    jpeg = base64.b64decode(
        "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgSEhUSFRgYGBgYGB0bHR4eHh0dHR0eHh4gICAmJiYgICAeHiAgJCQmJikqKScnJicqKi0tLTY2MzM/P0FNTV3/xABLAAEBAAAAAAAAAAAAAAAAAAAACAEBAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAPABQAMBIgACEQADEQD/2gAMAwEAAhEDEQA/AJ/"
        + "A" * 599
        + "B//9k="
    )
    film = module.make_film([jpeg] * 12)
    path.mkdir(parents=True, exist_ok=True)
    (path / "fallback.bin").write_bytes(film)
    (path / "CinemaAssets.hpp").write_text(
        ("#define CINEMA_ENCODER_POTION 1\n" if encoder == "potion" else "")
        + """#pragma once
#define CINEMA_MEDIA_SHARDED 1
#include <cstdint>
namespace cinema::assets {
inline constexpr char MODEL[] = "%s-fixture";
inline constexpr unsigned DIMENSIONS = %d, COUNT = 1;
inline constexpr char DIGEST[] = "0000000000000000000000000000000000000000000000000000000000000000";
struct Clip { uint32_t source, bytes, offset, length; float norm; uint16_t neighbors[8], keywords[16]; };
inline constexpr Clip CLIPS[] = {{1, %d, 0, %d, 127.f, {0,0,0,0,0,0,0,0}, {0,65535,65535,65535,65535,65535,65535,65535,65535,65535,65535,65535,65535,65535,65535,65535}}};
struct Word { uint32_t offset; float scale, norm; int8_t vector[DIMENSIONS]; uint8_t flags; };
inline constexpr char WORD_STRINGS[] = "cat";
inline constexpr Word WORDS[] = {{0, 1.f, 127.f, {127}, 1}};
inline constexpr unsigned WORD_COUNT = 1;
inline constexpr int8_t VECTORS[][DIMENSIONS] = {{127}};
}
"""
        % (encoder, 128 if encoder == "potion" else 50, len(film), len(film))
    )
    module.export_metadata(
        [
            {
                "archive": {"sourceTitle": "Original black-frame fixture"},
                "caption": {"description": "A silent black frame.", "mood": "still"},
                "duration_seconds": 1,
            }
        ],
        path,
        "0" * 64,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--encoder", choices=("potion", "glove"), default="potion")
    args = parser.parse_args()
    create(args.path, args.encoder)
