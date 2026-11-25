#!/usr/bin/env python3
"""Developer-only link and adapter-graph checks; Python standard library only.

Run from the package: python3 tests/check-package.py --self-test
Use --package-root for a copied package and --extra-markdown for export guidance.
This checks published Markdown structure, not prose policy or live integrations.
Code examples, external URLs, and unpopulated {{template links}} are not fetched.
"""

from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
import html
import re
from pathlib import Path
import tempfile
from urllib.parse import unquote, urlsplit


ROUTER = Path("skills/codemod/references/records/issue-systems.md")
ENTRYPOINT = Path("skills/codemod/SKILL.md")
WORKFLOW = Path("skills/workflow/SKILL.md")
COORDINATORS = {ENTRYPOINT, WORKFLOW}
INLINE_LINK = re.compile(
    r"!?\[([^\]\n]*)\]\(\s*(<[^>\n]*>|\{\{[^}]*\}\}|(?:\\.|[^\s()]+|\([^()]*\))*)"
    r"(?:\s+(?:\"[^\"]*\"|'[^']*'|\([^)]*\)))?\s*\)"
)
REFERENCE_DEF = re.compile(r"^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)", re.MULTILINE)
REFERENCE_LINK = re.compile(r"!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?(?!\()")


@dataclass(frozen=True)
class Link:
    target: str
    line: int


@dataclass(frozen=True)
class Problem:
    code: str
    path: Path
    detail: str

    def __str__(self) -> str:
        return f"{self.path}: [{self.code}] {self.detail}"


def without_blocks(text: str) -> str:
    """Mask YAML and fenced code, retaining offsets/line numbers for diagnostics."""
    lines = text.splitlines(keepends=True)
    frontmatter = bool(lines and lines[0].strip() == "---")
    fence: tuple[str, int] | None = None
    output = []
    for number, line in enumerate(lines):
        mask = frontmatter or fence is not None
        if frontmatter:
            if number and line.strip() == "---":
                frontmatter = False
        else:
            match = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
            if match and fence is None:
                fence = (match[1][0], len(match[1]))
                mask = True
            elif match and fence and match[1][0] == fence[0] and len(match[1]) >= fence[1]:
                fence = None
        output.append(re.sub(r"[^\n]", " ", line) if mask else line)
    return "".join(output)


def links(text: str) -> list[Link]:
    source = without_blocks(text)
    source = re.sub(r"(`+)([^`]|(?!\1)`)*?\1", lambda m: re.sub(r"[^\n]", " ", m[0]), source)
    definitions = {m[1].casefold(): m[2] for m in REFERENCE_DEF.finditer(source)}
    result = [Link(m[1].strip("<>"), source.count("\n", 0, m.start()) + 1)
              for m in re.finditer(r"^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)", source, re.MULTILINE)]
    result.extend(Link(m[2].strip("<>"), source.count("\n", 0, m.start()) + 1)
                  for m in INLINE_LINK.finditer(source))
    for match in REFERENCE_LINK.finditer(source):
        key = (match[2] or match[1]).casefold()
        if key in definitions:
            result.append(Link(definitions[key].strip("<>"), source.count("\n", 0, match.start()) + 1))
    return result


def slug(value: str) -> str:
    value = INLINE_LINK.sub(lambda m: m[1], value)
    value = re.sub(r"<[^>]+>", "", html.unescape(value)).lower()
    value = re.sub(r"[^\w\-\s]", "", value)
    return re.sub(r"\s", "-", value.strip())


def anchors(text: str) -> set[str]:
    source = without_blocks(text)
    result = set(re.findall(r'<(?:a|[a-z][a-z0-9]*)\b[^>]*\b(?:id|name)=["\']([^"\']+)["\']', source, re.IGNORECASE))
    lines = source.splitlines()
    for index, line in enumerate(lines):
        atx = re.match(r"^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$", line)
        heading = atx[1] if atx else None
        if heading is None and index + 1 < len(lines) and line.strip() and re.fullmatch(r" {0,3}(=+|-+)\s*", lines[index + 1]):
            heading = line.strip()
        if heading is not None:
            base = slug(heading)
            candidate, counter = base, 0
            while candidate in result:
                counter += 1
                candidate = f"{base}-{counter}"
            result.add(candidate)
    return result


def local_target(source: Path, target: str) -> tuple[Path, str] | None:
    if "{{" in target and "}}" in target:
        return None
    target = re.sub(r"\\([\\() ])", r"\1", html.unescape(target))
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc:
        return None
    return ((source.parent / unquote(parsed.path)).resolve() if parsed.path else source,
            unquote(parsed.fragment))


def table(text: str, first_column: str) -> tuple[list[str], list[list[str]]]:
    lines = without_blocks(text).splitlines()
    for index, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not cells or cells[0].casefold() != first_column.casefold():
            continue
        if index + 1 >= len(lines) or not all(
            re.fullmatch(r":?-{3,}:?", cell.strip())
            for cell in lines[index + 1].strip().strip("|").split("|")
        ):
            continue
        rows = []
        for row in lines[index + 2:]:
            if not row.lstrip().startswith("|"):
                break
            rows.append([cell.strip() for cell in row.strip().strip("|").split("|")])
        return cells, rows
    return [], []


def validate(package: Path, extra_markdown: list[Path] | None = None) -> list[Problem]:
    package = package.resolve()
    problems: list[Problem] = []
    documents = {p.resolve(): p.read_text(encoding="utf-8") for p in package.rglob("*.md")}
    for path in extra_markdown or []:
        path = path.resolve()
        if path.is_file():
            documents[path] = path.read_text(encoding="utf-8")
        else:
            problems.append(Problem("missing-document", path, "Extra Markdown file is missing"))
    graph: dict[Path, set[Path]] = {}
    anchor_cache: dict[Path, set[str]] = {}
    for path, text in documents.items():
        graph[path] = set()
        for link in links(text):
            resolved = local_target(path, link.target)
            if resolved is None:
                continue
            target, fragment = resolved
            if not target.exists():
                problems.append(Problem("missing-target", path, f"line {link.line}: {link.target}"))
                continue
            if target.suffix.lower() == ".md" and target.is_file():
                graph[path].add(target)
                if fragment:
                    if target not in anchor_cache:
                        anchor_cache[target] = anchors(target.read_text(encoding="utf-8"))
                    if fragment not in anchor_cache[target]:
                        problems.append(Problem("missing-anchor", path, f"line {link.line}: {link.target}"))

    router = package / ROUTER
    if router not in documents:
        problems.append(Problem("missing-router", router, "Shared provider router is missing"))
        return problems

    def targets(cell: str) -> list[Path]:
        return [resolved[0] for link in links(cell)
                if (resolved := local_target(router, link.target)) is not None]

    _, catalog = table(documents[router], "Provider ID")
    providers: set[str] = set()
    if not catalog:
        problems.append(Problem("provider-catalog", router, "Provider catalog has no entries"))
    for row in catalog:
        provider = row[0].strip("`")
        if not re.fullmatch(r"[a-z][a-z0-9-]*", provider) or provider in providers or len(row) != 4:
            problems.append(Problem("provider-catalog", router, f"Invalid or duplicate provider row: {row}"))
            continue
        expected = router.parent / provider
        native = targets(row[2])
        providers.add(provider)
        if len(native) != 1 or not native[0].is_file() or not native[0].is_relative_to(expected):
            problems.append(Problem("provider-adapter", router, f"{provider}: expected native implementation beneath {expected}"))

    headers, rows = table(documents[router], "Stage")
    if [slug(header) for header in headers] != ["stage", "record-guidance"]:
        problems.append(Problem("stage-columns", router, "Stage index must contain Stage and Record guidance"))
    skill_paths = set((package / "skills").glob("*/SKILL.md"))
    stages = {p.parent.name for p in skill_paths if p.relative_to(package) not in COORDINATORS}
    found: set[str] = set()
    for row in rows:
        if len(row) != 2:
            problems.append(Problem("stage-row", router, f"Incomplete stage row: {row[0]}"))
            continue
        guidance = targets(row[1])
        spec = guidance[0] if guidance else None
        stage = spec.parent.parent.name if spec else ""
        refs = package / "skills" / stage / "references"
        if stage not in stages or stage in found or spec != refs / "records.md":
            problems.append(Problem("stage-row", router, f"Expected one distinct owning stage specification: {row[0]}"))
            continue
        found.add(stage)
        if not spec.is_file():
            problems.append(Problem("shared-spec", router, f"{stage}: missing record specification {spec}"))
        if len(guidance) != len(links(row[1])):
            problems.append(Problem("stage-adapter", router, f"{stage}: record guidance must link to local files"))
        for procedure in guidance[1:]:
            if not procedure.is_file() or not any(procedure.is_relative_to(refs / provider) for provider in providers):
                problems.append(Problem("stage-adapter", router, f"{stage}: expected a stage-specific procedure for a catalog provider: {procedure}"))
    for stage in sorted(stages - found):
        problems.append(Problem("missing-stage", router, f"No record guidance for {stage}"))
    for coordinator in sorted(COORDINATORS):
        if package / coordinator not in skill_paths:
            problems.append(Problem("missing-coordinator", package / coordinator, "Migration coordinator is missing"))
    for skill in sorted(skill_paths):
        queue, visited = deque([skill]), set()
        while queue:
            node = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            queue.extend(p for p in graph.get(node, set()) if p.is_relative_to(package))
        if router not in visited:
            problems.append(Problem("unreachable-router", skill, "No Markdown reference route to the shared issue-system router"))
    return problems


def self_test() -> None:
    """Exercise malformed synthetic packages without touching the working copy."""
    with tempfile.TemporaryDirectory(prefix="codemod-package-check-") as temporary:
        root = Path(temporary)
        fixture = {
            ENTRYPOINT: "# Entry\n[Router](references/records/issue-systems.md)\n",
            WORKFLOW: "# Workflow\n[Router](../codemod/references/records/issue-systems.md)\n",
            Path("skills/initialize/SKILL.md"): "# Initialize\n[Router](../codemod/references/records/issue-systems.md)\n",
            ROUTER: """# Router
| Provider ID | Integration to discover | Native implementation | Report stores |
| --- | --- | --- | --- |
| `sample` | Sample integration | [Adapter](sample/records.md) | Sample reports |
| `alternate` | Alternate integration | [Adapter](alternate/records.md) | Alternate reports |

| Stage | Record guidance |
| --- | --- |
| Gather migration intent | [Setup](../../../initialize/references/records.md#common); [Sample setup](../../../initialize/references/sample/setup.md) |
""",
            Path("skills/codemod/references/records/sample/records.md"): "# Adapter\n",
            Path("skills/codemod/references/records/alternate/records.md"): "# Alternate adapter\n",
            Path("skills/initialize/references/records.md"): "# Common\n## Repeated\n## Repeated\n[Repeat](#repeated-1)\n[Report]({{Saved report URL}})\n`[Example](absent.md)`\n```text\n[Example](absent.md)\n```\n",
            Path("skills/initialize/references/sample/setup.md"): "# Native setup\n",
        }

        def reset() -> None:
            for path, content in fixture.items():
                (root / path).parent.mkdir(parents=True, exist_ok=True)
                (root / path).write_text(content, encoding="utf-8")

        reset()
        assert not validate(root), "Catalog defaults and a stage-specific procedure must both pass"
        procedure = "; [Sample setup](../../../initialize/references/sample/setup.md)"
        (root / ROUTER).write_text(fixture[ROUTER].replace(procedure, ""), encoding="utf-8")
        assert not validate(root), "Catalog adapters apply to every stage by default"
        reset()
        (root / "skills/initialize/references/sample/setup.md").unlink()
        assert "stage-adapter" in {p.code for p in validate(root)}, "Missing stage-specific procedure must fail"
        reset()
        wrong_provider = fixture[ROUTER].replace(procedure, "; [Sample setup](sample/records.md)")
        (root / ROUTER).write_text(wrong_provider, encoding="utf-8")
        assert "stage-adapter" in {p.code for p in validate(root)}, "A repeated catalog adapter must fail"
        reset()
        (root / "skills/codemod/references/records/sample/records.md").unlink()
        assert "provider-adapter" in {p.code for p in validate(root)}, "Missing catalog adapter must fail"
        reset()
        (root / ROUTER).write_text(fixture[ROUTER].replace("#common", "#missing-anchor"), encoding="utf-8")
        assert "missing-anchor" in {p.code for p in validate(root)}, "Missing heading must fail"
        reset()
        (root / ROUTER).write_text(fixture[ROUTER].replace("| Stage | Record guidance |", "| Stage | Record guidance | Sample |"), encoding="utf-8")
        assert "stage-columns" in {p.code for p in validate(root)}, "Provider columns must fail"
        reset()
        (root / "skills/initialize/SKILL.md").write_text("# No route\n", encoding="utf-8")
        assert "unreachable-router" in {p.code for p in validate(root)}, "Disconnected direct skill must fail"
        reset()
        (root / WORKFLOW).unlink()
        assert "missing-coordinator" in {p.code for p in validate(root)}, "Missing coordinator must fail"
    print("Passed synthetic catalog-default, stage-procedure, missing-adapter, missing-anchor, coordinator, and direct-route checks.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--extra-markdown", type=Path, action="append", default=[])
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    problems = validate(args.package_root, args.extra_markdown)
    for problem in problems:
        print(problem)
    if problems:
        print(f"Failed: {len(problems)} package contract problem(s).")
        return 1
    print(f"Passed Markdown targets/anchors, provider routes, and skill reachability: {args.package_root.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
