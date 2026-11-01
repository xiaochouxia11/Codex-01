"""Prompt template management for agents (domain-agnostic)."""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from .config import settings

Role = str  # alias for clarity


@dataclass
class PromptTemplate:
    id: str
    name: str
    role: Role
    content: str
    source: str  # "default" or "custom"
    locked: bool = False
    archived: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


DEFAULT_PROMPT_IDS: Dict[Role, str] = {
    "agent": "default:agent",
    "literature": "default:literature",
    "supervisor": "default:supervisor",
}


_DEFAULT_PROMPTS: Dict[str, PromptTemplate] = {
    "default:agent": PromptTemplate(
        id="default:agent",
        name="Default Agent Prompt",
        role="agent",
        source="default",
        locked=True,
        content=(
            "You are a Data Analysis Agent operating in a domain-agnostic research workflow.\n"
            "Goals:\n"
            "1) Inspect and summarize the selected SQLite .db (tables, row counts, schemas, missingness).\n"
            "2) Perform appropriate generic analyses aligned to the user-provided research goal (e.g., EDA, correlations, simple statistical tests, baselines).\n"
            "3) Persist results as CSV/SQLite tables and produce transparent, reproducible logs.\n\n"
            "Constraints:\n"
            "- Use only Python scientific libraries (pandas, numpy, scipy, sklearn, statsmodels).\n"
            "- No domain-specific heuristics; explain assumptions and steps.\n"
            "- Prefer text/tabular outputs over plots.\n"
            "- Never fabricate numbers; compute from the loaded data.\n"
        ),
    ),
    "default:literature": PromptTemplate(
        id="default:literature",
        name="Default Literature Prompt",
        role="literature",
        source="default",
        locked=True,
        content=(
            "You are a Literature Review Agent. Given a research goal, propose search queries, inclusion/exclusion criteria, and an evidence plan using sources such as arXiv, Semantic Scholar, Google Scholar, SSRN, documentation/blogs, and patents."
        ),
    ),
    "default:supervisor": PromptTemplate(
        id="default:supervisor",
        name="Default Supervisor Prompt",
        role="supervisor",
        source="default",
        locked=True,
        content=(
            "You are the Supervisor. Ensure all agent outputs align with the user-defined research goal, are reproducible, and meet quality checks (data coverage, validity of methods, consistency of conclusions).\n"
            "Direct corrective actions when gaps are found and produce a concise final verdict with next steps.\n"
            "Incorporate the literature agent's most recent plan and evidence when crafting feedback, and translate those insights into actionable guidance for the analysis agent. When evidence gaps remain, call the available tools (e.g., plan_literature_queries) to scope further work before requesting escalations."
        ),
    ),
}


# Domain-agnostic defaults only; no external module overrides.


def _store_path() -> Path:
    path = settings.prompts_store
    if not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _load_custom_templates() -> List[PromptTemplate]:
    path = _store_path()
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    templates: List[PromptTemplate] = []
    for item in raw:
        try:
            templates.append(
                PromptTemplate(
                    id=item["id"],
                    name=item["name"],
                    role=item["role"],
                    content=item["content"],
                    source="custom",
                    locked=False,
                    archived=bool(item.get("archived", False)),
                )
            )
        except KeyError:
            continue
    return templates


def _save_custom_templates(templates: Iterable[PromptTemplate]) -> None:
    path = _store_path()
    payload = [
        {
            "id": tmpl.id,
            "name": tmpl.name,
            "role": tmpl.role,
            "content": tmpl.content,
            "archived": tmpl.archived,
        }
        for tmpl in templates
    ]
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def list_templates() -> List[PromptTemplate]:
    return list(_DEFAULT_PROMPTS.values()) + _load_custom_templates()


def get_template(template_id: str) -> PromptTemplate:
    if template_id in _DEFAULT_PROMPTS:
        return _DEFAULT_PROMPTS[template_id]
    for tmpl in _load_custom_templates():
        if tmpl.id == template_id:
            return tmpl
    raise KeyError(f"Prompt template not found: {template_id}")


def get_prompt_content(template_id: Optional[str]) -> str:
    if not template_id:
        return _DEFAULT_PROMPTS[DEFAULT_PROMPT_IDS["agent"]].content
    try:
        return get_template(template_id).content
    except KeyError:
        # fall back to defaults by role inference from id prefix
        role_guess = "agent"
        if template_id.endswith(":literature") or "literature" in template_id:
            role_guess = "literature"
        elif template_id.endswith(":supervisor") or "supervisor" in template_id:
            role_guess = "supervisor"
        default_id = DEFAULT_PROMPT_IDS.get(role_guess, DEFAULT_PROMPT_IDS["agent"])
        return _DEFAULT_PROMPTS[default_id].content


def duplicate_template(template_id: str, name: Optional[str], content: Optional[str] = None) -> PromptTemplate:
    base = get_template(template_id)
    new_id = f"custom:{uuid.uuid4().hex}"
    new_template = PromptTemplate(
        id=new_id,
        name=name or f"{base.name} Copy",
        role=base.role,
        content=content or base.content,
        source="custom",
        locked=False,
        archived=False,
    )
    templates = _load_custom_templates()
    templates.append(new_template)
    _save_custom_templates(templates)
    return new_template


def update_template(template_id: str, name: str, content: str) -> PromptTemplate:
    templates = _load_custom_templates()
    for idx, tmpl in enumerate(templates):
        if tmpl.id == template_id:
            templates[idx] = PromptTemplate(
                id=template_id,
                name=name,
                role=tmpl.role,
                content=content,
                source="custom",
                locked=False,
                archived=tmpl.archived,
            )
            _save_custom_templates(templates)
            return templates[idx]
    raise KeyError(f"Custom prompt not found: {template_id}")


def set_template_archived(template_id: str, archived: bool) -> PromptTemplate:
    templates = _load_custom_templates()
    for idx, tmpl in enumerate(templates):
        if tmpl.id == template_id:
            updated = PromptTemplate(
                id=tmpl.id,
                name=tmpl.name,
                role=tmpl.role,
                content=tmpl.content,
                source=tmpl.source,
                locked=tmpl.locked,
                archived=archived,
            )
            templates[idx] = updated
            _save_custom_templates(templates)
            return updated
    raise KeyError(f"Custom prompt not found: {template_id}")


def delete_template(template_id: str) -> None:
    templates = _load_custom_templates()
    new_templates = [tmpl for tmpl in templates if tmpl.id != template_id]
    if len(new_templates) == len(templates):
        raise KeyError(f"Custom prompt not found: {template_id}")
    _save_custom_templates(new_templates)


def ensure_default_prompts() -> None:
    """No-op helper to force module import side effects."""
    return None


__all__ = [
    "PromptTemplate",
    "DEFAULT_PROMPT_IDS",
    "list_templates",
    "get_template",
    "get_prompt_content",
    "duplicate_template",
    "update_template",
    "set_template_archived",
    "delete_template",
    "ensure_default_prompts",
]
