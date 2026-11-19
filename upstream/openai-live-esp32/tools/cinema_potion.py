"""Pinned, optional POTION 4M preparation and reference ESP32 encoder.

No model weights or third-party implementation code live in this module.
The portable profile deliberately normalizes input to bounded ASCII. Its
WordPiece vocabulary/weights are pinned together; Unicode tokenization is not
claimed. Runtime query encoding is implemented in CinemaPotion.hpp.
"""

import hashlib
import json
import math
import re
from pathlib import Path

from cinema_embedding import STOP, f32

MODEL = "potion-4m-128d-ascii-int8-v1"
REVISION = "9b3cff412d30be9ae8603fe10224c224f3401869"
SOURCE = f"https://huggingface.co/minishlab/potion-base-4M/tree/{REVISION}"
HASHES = {
    "model.safetensors": "8a7140edd17ffab30ddcff1135eda127df57abfae856203dbd7b3d061295c31a",
    "tokenizer.json": "e67e803f624fb4d67dea1c730d06e1067e1b14d830e2c2202569e3ef0f70bb50",
    "README.md": "f0d13fe7a9aa2369a71b14eb4e1fa11dfa27498713e1fc600165b4b9cbc53705",
}
DIMENSIONS = 128
MAX_BYTES, MAX_TOKENS, MAX_WORD, MAX_TERMS = 2048, 256, 100, 8
DOCUMENT_KEYWORDS = 24
MIN_RELEVANCE, MIN_COSINE = 0.50, 0.20
QUERY_STOP = STOP | {
    "find",
    "hello",
    "hi",
    "hey",
    "thanks",
    "thank",
    "another",
    "videos",
    "m",
    "s",
    "t",
    "ll",
    "ve",
    "d",
    "re",
    "shall",
}
NEGATION = {"no", "not", "without", "except", "never", "cannot"}
TOKENIZER, STOP_WORD = 1, 2


def ascii_text(text):
    data = text.encode("utf-8").split(b"\0", 1)[0][:MAX_BYTES]
    return "".join(chr(b).lower() if 32 <= b < 127 else " " for b in data)


def basic_tokens(text):
    return re.findall(r"[a-z0-9]+|[^a-z0-9\s]", ascii_text(text))


def content_words(text, model=None):
    stop = set(model["stop_words"]) if model else QUERY_STOP
    return [
        w
        for w in re.findall(r"[a-z0-9]+", ascii_text(text))
        if len(w) <= MAX_WORD and w not in stop
    ]


def pieces(token, model):
    if not token or len(token) > MAX_WORD:
        return []
    result, start = [], 0
    while start < len(token):
        for end in range(len(token), start, -1):
            part = ("##" if start else "") + token[start:end]
            if model["words"].get(part, {}).get("flags", 0) & TOKENIZER:
                result.append(part)
                start = end
                break
        else:
            # A partial prefix must never escape a failed whole word.
            return []
    return result


def token_names(text, model):
    result = []
    for word in basic_tokens(text):
        result.extend(pieces(word, model)[: MAX_TOKENS - len(result)])
        if len(result) == MAX_TOKENS:
            break
    return result


def normalized(values):
    norm = math.sqrt(sum(float(v) ** 2 for v in values))
    if not math.isfinite(norm) or norm < 1e-10:
        raise ValueError("Cue contains no recognized visual vocabulary")
    return [f32(v / norm) for v in values]


def raw_vector(text, model):
    values = [0.0] * DIMENSIONS
    for name in token_names(text, model):
        row = model["words"][name]
        values = [f32(a + f32(q * row["scale"])) for a, q in zip(values, row["q"])]
    return values


def embed(text, model):
    return normalized(raw_vector(text, model))


def document_parts(description):
    # Concentrate on observed subjects, rather than film titles, atmosphere,
    # color/lighting boilerplate or a caption model's imagined associations.
    text = re.split(
        r"(?i)visual associations?|associations include|associated with|evokes? |conveys? ",
        description,
    )[0]
    text = re.sub(
        r"(?i)^(?:the |these )?(?:three |several |multiple )?(?:black[- ]and[- ]white |color )?(?:frames?|images?|shots?) (?:show|depict|feature)s? ",
        "",
        text,
    )
    text = re.sub(
        r"(?i)^(?:in |across )(?:the |these )?(?:three |several |multiple )?(?:black[- ]and[- ]white |color )?(?:frames?|images?),? ",
        "",
        text,
    )
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return sentences[0], " ".join(sentences[:2])


def document_vector(description, model):
    primary, context = document_parts(description)
    a, b = embed(primary, model), embed(context, model)
    return normalized([f32(x + y) for x, y in zip(a, b)])


def keywords(description, model=None):
    _, context = document_parts(description)
    # Text on an intertitle/sign is not evidence of a visible animal/object.
    context = re.sub(r'"[^"\n]*"|“[^”\n]*”|(?<!\w)\'[^\'\n]*\'(?!\w)', " ", context)
    return list(dict.fromkeys(content_words(context, model)))[:DOCUMENT_KEYWORDS]


def quantized(values, flags=0):
    maximum = max(map(abs, values))
    scale = f32(maximum / 127) if maximum else 0.0
    q = [max(-127, min(127, round(v / scale))) if scale else 0 for v in values]
    return {
        "q": q,
        "scale": scale,
        "norm": f32(math.sqrt(sum(v * v for v in q))),
        "flags": flags,
    }


def build(directory, descriptions, output):
    # Safetensors is a data-only optional host dependency; never load pickle or
    # execute downloaded model/tokenizer code.
    import numpy as np
    from safetensors.numpy import load_file

    directory = Path(directory)
    for name, expected in HASHES.items():
        with (directory / name).open("rb") as source:
            actual = hashlib.file_digest(source, "sha256").hexdigest()
        if actual != expected:
            raise ValueError(f"Pinned POTION {name} digest mismatch")
    tokenizer = json.loads((directory / "tokenizer.json").read_text())
    vocab = tokenizer["model"]["vocab"]
    weights = load_file(directory / "model.safetensors")["embeddings"]
    if weights.shape != (29528, DIMENSIONS) or not np.isfinite(weights).all():
        raise ValueError("Invalid POTION weights")
    words = {
        word: quantized(weights[index].tolist(), TOKENIZER)
        for word, index in vocab.items()
        if index > 4
    }
    model = {
        "model": MODEL,
        "dimensions": DIMENSIONS,
        "source": SOURCE,
        "license": "MIT",
        "revision": REVISION,
        "sha256": HASHES,
        "stop_words": sorted(QUERY_STOP),
        "words": words,
    }
    # Cache whole-word vectors for caption evidence. These rows are explicitly
    # excluded from WordPiece matching, so they cannot alter tokenization.
    for word in sorted(
        {w for text in descriptions for w in keywords(text)} | QUERY_STOP
    ):
        if word not in words:
            words[word] = quantized(raw_vector(word, model))
        if word in QUERY_STOP:
            words[word]["flags"] |= STOP_WORD
    model["words"] = dict(sorted(words.items()))
    if len(words) >= 65535:
        raise ValueError("POTION vocabulary exceeds on-device ID limit")
    Path(output).write_text(json.dumps(model, separators=(",", ":")))
    return model


def query(text, model):
    terms = []
    unsupported = previous_good = ends_n = contraction = False
    stop = set(model["stop_words"])
    # Follow the device's bounded token stream, including skipped oversized
    # words, rather than applying phrase regexes before tokenization.
    for word in basic_tokens(text):
        if len(word) > MAX_WORD:
            continue
        if not word[0].isalnum():
            contraction = ends_n and word == "'"
            ends_n = False
            continue
        unsupported |= word in NEGATION or (contraction and word == "t")
        contraction = False
        ends_n = word.endswith("n")
        greeting = previous_good and word in {"morning", "afternoon", "evening"}
        previous_good = word == "good"
        if (
            not greeting
            and len(terms) < MAX_TERMS
            and word not in stop
            and word not in terms
        ):
            terms.append(word)
    if unsupported:
        raise ValueError("Use a positive visual subject; exclusions are unsupported")
    if not terms:
        raise ValueError("Cue contains no recognized visual vocabulary")
    vectors, thresholds, weights = [], [], []
    for term in terms:
        row = model["words"].get(term)
        if row and row["norm"] > 0:
            vectors.append([q / row["norm"] for q in row["q"]])
            weights.append(f32(row["scale"] * row["norm"]))
        else:
            vectors.append(embed(term, model))
            weights.append(f32(math.sqrt(sum(v * v for v in raw_vector(term, model)))))
        thresholds.append(0.65 if row and row["flags"] & TOKENIZER else 0.90)
    # Match the device: distinct bounded content words, no generic chatter.
    return embed(" ".join(terms), model), vectors, thresholds, weights


def rank(text, model, vectors, document_keywords):
    import numpy as np

    pooled, terms, thresholds, weights = query(text, model)
    cosine = np.asarray(vectors, np.float32) @ np.asarray(pooled, np.float32)
    results = []
    for i in np.argsort(-cosine, kind="stable")[:64]:
        if cosine[i] < MIN_COSINE:
            continue
        rows = [
            model["words"][w]
            for w in document_keywords[i]
            if model["words"][w]["norm"] > 0
        ]
        if not rows:
            continue
        word_vectors = np.asarray(
            [[q / r["norm"] for q in r["q"]] for r in rows], np.float32
        )
        support = np.maximum(0, np.asarray(terms, np.float32) @ word_vectors.T).max(
            axis=1
        )
        if not np.any(support >= np.asarray(thresholds)):
            continue
        if np.any((np.asarray(weights) >= 0.8 * max(weights)) & (support < 0.35)):
            continue
        score = 0.55 * float(cosine[i]) + 0.45 * float(
            np.average(support, weights=weights)
        )
        if score >= MIN_RELEVANCE:
            results.append({"index": int(i), "score": score})
    return sorted(results, key=lambda r: -r["score"])[:8]


def header(model):
    table, rows = bytearray(), []
    for word, row in model["words"].items():
        offset = len(table)
        table.extend(word.encode() + b"\0")
        rows.append(
            "{%du,%.9ef,%.9ef,{%s},%du}"
            % (
                offset,
                row["scale"],
                row["norm"],
                ",".join(map(str, row["q"])),
                row["flags"],
            )
        )
    return (
        "struct Word { uint32_t offset; float scale, norm; int8_t vector[DIMENSIONS]; uint8_t flags; };\n"
        + "inline constexpr char WORD_STRINGS[] =\n"
        + "\n".join(
            '"' + "".join("\\%03o" % b for b in table[i : i + 256]) + '"'
            for i in range(0, len(table), 256)
        )
        + ";\ninline constexpr Word WORDS[] = {\n"
        + ",\n".join(rows)
        + f"\n}};\ninline constexpr unsigned WORD_COUNT = {len(rows)};\n"
    )
