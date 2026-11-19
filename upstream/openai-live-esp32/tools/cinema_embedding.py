"""Small offline GloVe encoder used identically by pack preparation and ESP32.

Weights are optional external data, not checked into this Apache-licensed repo.
Stanford publishes GloVe weights under PDDL: https://nlp.stanford.edu/projects/glove/
"""

import hashlib
import json
import math
import re
import struct
import zipfile
from collections import Counter
from pathlib import Path

MODEL = "glove.6B.50d-weighted-int8-v3"
WEIGHTED_MODELS = {MODEL, "glove.6B.50d-weighted-int8-v2"}
DIMENSIONS = 50
DOCUMENT_KEYWORDS = 24
MIN_RELEVANCE = 0.72
STOP = frozenset(
    "a an the and or but as at by for from in into of on onto to with without is are was were be been being it its this that these those there here i me my you your we our they their he she his her them us am do does did not no yes very really just can could would should will some any about also than then have has had show tell please image images scene scenes footage film video black white color coloured features featuring appears appear seems seen shows showing depicts depicting view views mood frame frames first second third one two three four five six seven eight nine ten sequence sequential visible visibility foreground background closeup close up depicts depicting shown looking appears appearing various view camera footage photograph photographs scene image multiple several different captured captures capture tone tones style aesthetic tones clip clips".split()
)
STOP |= frozenset(
    "what who whom whose why how when where which like likes liked love loves loved "
    "want wants wanted watching watch talking talk think thinking know nice great good "
    "sure okay actually alright well today favorite favourite let lets say says said "
    "something anything everything nothing get gets got going go thing things more most "
    "much many way lot make makes made might may now even still because so if around "
    "across through near characterized prominent primarily typical tones texture textures "
    "lighting contrast sequential monochrome grainy palette muted overall hues sense "
    "visual associations association".split()
)


def caption_text(caption, model=MODEL):
    description = caption["description"]
    if model == "potion-4m-128d-ascii-int8-v1":
        return description
    if model == MODEL:
        # A caption like "she sports a jacket" is not evidence of athletics.
        description = re.sub(
            r"\bsports\s+(?=(?:a|an|the)\s)", "wears ", description, flags=re.I
        )
        # A broad sports cue should also find specifically named games. Keep
        # these aliases in document indexing only: never change the description
        # returned to the user or pretend a film synopsis describes this clip.
        sports = {
            "football",
            "soccer",
            "basketball",
            "baseball",
            "volleyball",
            "tennis",
            "hockey",
            "rugby",
            "golf",
            "wrestling",
            "gymnastics",
            "badminton",
        }
        words = set(tokens(description))
        cricket_game = "cricket" in words and bool(
            words & {"game", "bat", "bats", "batting", "batter", "wicket", "batsman"}
        )
        boxing_match = "boxing" in words and bool(
            words & {"ring", "gloves", "bout", "match", "boxer", "punches"}
        )
        if words & sports or cricket_game or boxing_match:
            description += ". Athletic sports."
    elif model not in WEIGHTED_MODELS:
        description = description.split(". ", 1)[0]
    return description + ". " + caption["mood"]


def tokens(text):
    # Match the bounded ASCII parser on-device, including whole-token overflow.
    return [
        w.decode("ascii")
        for w in re.findall(
            rb"[a-z0-9]+", text.encode("utf-8").split(b"\0", 1)[0][:2048].lower()
        )
        if len(w) <= 48
    ]


def f32(value):
    return struct.unpack("<f", struct.pack("<f", value))[0]


def build(zip_path, texts, output, vocabulary=20000):
    with open(zip_path, "rb") as source:
        archive_hash = hashlib.file_digest(source, "sha256").hexdigest()
    if (
        archive_hash
        != "6471382cdd837544bf3ac72497a38715e845897d265b2b424b4761832009c837"
    ):
        raise ValueError(
            "Expected the pinned Stanford GloVe 6B archive; digest mismatch"
        )
    frequencies = Counter(
        w for text in texts for w in set(tokens(text)) if w not in STOP
    )
    wanted = set(frequencies)
    rows = {}
    with zipfile.ZipFile(zip_path) as archive, archive.open("glove.6B.50d.txt") as file:
        for raw in file:
            fields = raw.decode("utf-8").rstrip().split(" ")
            word = fields[0]
            if word in STOP or not re.fullmatch("[a-z0-9]{1,48}", word):
                continue
            if len(rows) >= vocabulary and word not in wanted:
                continue
            values = [float(x) for x in fields[1:]]
            if len(values) != DIMENSIONS or not all(map(math.isfinite, values)):
                raise ValueError("Invalid pretrained vector")
            maximum = max(map(abs, values))
            if maximum == 0:
                continue
            q = [int(round(x * 127 / maximum)) for x in values]
            weight = min(
                6.0, 1.0 + math.log((1 + len(texts)) / (1 + frequencies.get(word, 0)))
            )
            rows[word] = {
                "q": q,
                "norm": f32(math.sqrt(sum(x * x for x in q))),
                "scale": f32(
                    maximum / 127 * weight / math.sqrt(sum(x * x for x in values))
                ),
            }
    model = {
        "model": MODEL,
        "dimensions": DIMENSIONS,
        "source": "https://huggingface.co/stanfordnlp/glove/resolve/main/glove.6B.zip",
        "license": "https://opendatacommons.org/licenses/pddl/1-0/",
        "archive_sha256": archive_hash,
        "words": dict(sorted(rows.items())),
    }
    Path(output).write_text(json.dumps(model, separators=(",", ":")))
    return model


def embed(text, model):
    result = [0.0] * DIMENSIONS
    matched = 0
    for w in tokens(text):
        row = model["words"].get(w)
        if not row:
            continue
        result = [f32(a + f32(q * row["scale"])) for a, q in zip(result, row["q"])]
        matched += 1
    norm = math.sqrt(sum(x * x for x in result))
    if not matched or norm < 1e-10:
        raise ValueError("Cue contains no recognized visual vocabulary")
    return [x / norm for x in result]


def header(model):
    table = bytearray()
    rows = []
    for word, row in model["words"].items():
        offset = len(table)
        table.extend(word.encode() + b"\0")
        rows.append(
            "{%du,%.9ef,%.9ef,{%s}}"
            % (offset, row["scale"], row["norm"], ",".join(map(str, row["q"])))
        )
    return (
        "struct Word { uint32_t offset; float scale, norm; int8_t vector[DIMENSIONS]; };\n"
        + "inline constexpr char WORD_STRINGS[] =\n"
        + "\n".join(
            '"' + "".join("\\%03o" % b for b in table[i : i + 256]) + '"'
            for i in range(0, len(table), 256)
        )
        + ";\n"
        + "inline constexpr Word WORDS[] = {\n"
        + ",\n".join(rows)
        + "\n};\n"
        + f"inline constexpr unsigned WORD_COUNT = {len(rows)};\n"
    )


def keywords(text, model, limit=16):
    words = model["words"]
    seen = set()
    result = []
    for word in tokens(text):
        if word in words and word not in seen:
            seen.add(word)
            result.append(word)
    if model.get("model") in WEIGHTED_MODELS:
        result.sort(key=lambda w: -(words[w]["scale"] * words[w]["norm"]))
    return result[:limit]


def keyword_similarity(query, document, model):
    if not query:
        return 0.0
    words = model["words"]
    total = weight_sum = 0.0
    for q in query:
        a = words[q]
        weight = (
            a["scale"] * a["norm"] if model.get("model") in WEIGHTED_MODELS else 1.0
        )
        total += weight * max(
            [0.0]
            + [
                min(
                    1.0,
                    sum(x * y for x, y in zip(a["q"], words[w]["q"]))
                    / (a["norm"] * words[w]["norm"]),
                )
                for w in document
            ]
        )
        weight_sum += weight
    return total / weight_sum if weight_sum else 0.0


def exact_coverage(query, document, model):
    weights = {w: model["words"][w]["scale"] * model["words"][w]["norm"] for w in query}
    total = sum(weights.values())
    return sum(v for w, v in weights.items() if w in document) / total if total else 0.0
