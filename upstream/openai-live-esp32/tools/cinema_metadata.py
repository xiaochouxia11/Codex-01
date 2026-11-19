"""Bounded film context kept separate from sampled-frame clip descriptions."""

import re


def film_context(record):
    rights = record.get("provenance") or {}
    archive = record.get("archive") or {}
    if not isinstance(rights, dict) or not isinstance(archive, dict):
        raise ValueError("Invalid source-film metadata")
    metadata = rights.get("metadata") or {}
    if not isinstance(metadata, dict):
        raise ValueError("Invalid source-film metadata")
    fields = (
        ("Film", archive.get("sourceTitle")),
        ("Year", archive.get("sourceYear")),
        ("Creator", metadata.get("creator")),
        ("Collection", metadata.get("original_collection")),
        ("Archive page", rights.get("page")),
        ("Original source", metadata.get("source_url")),
    )
    lines = [
        "Source-film catalog context; not a description of every frame in this clip."
    ]
    sources = []
    for name, value in fields:
        if value is None or value == "":
            continue
        if not isinstance(value, (str, int)) or isinstance(value, bool):
            raise ValueError("Invalid source-film metadata")
        value = re.sub(r"\s+", " ", str(value)).strip()
        if "\0" in value:
            raise ValueError("Invalid source-film text")
        target = lines if name in ("Film", "Year") else sources
        target.append(
            name + ": " + value.encode("utf-8")[:512].decode("utf-8", "ignore")
        )
    synopsis = rights.get("synopsis", "")
    if synopsis is None:
        synopsis = ""
    if not isinstance(synopsis, str) or "\0" in synopsis:
        raise ValueError("Invalid source synopsis")
    synopsis = re.sub(r"\s+", " ", synopsis).strip()
    # Put the useful narrative before long provenance URLs, so a short spoken
    # answer need not page through the source links before reaching the synopsis.
    tail = "\n" + "\n".join(sources) if sources else ""
    if synopsis:
        prefix = "\n".join(lines) + "\nArchive synopsis: "
        suffix = " [synopsis excerpt; full text at archive page]"
        budget = 4096 - len(prefix.encode()) - len(tail.encode())
        if len(synopsis.encode()) > budget:
            synopsis = (
                synopsis.encode()[: budget - len(suffix)].decode("utf-8", "ignore")
                + suffix
            )
        return prefix + synopsis + tail
    return "\n".join(lines) + "\nArchive synopsis unavailable in this pack." + tail
