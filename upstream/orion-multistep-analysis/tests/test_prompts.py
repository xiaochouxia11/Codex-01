from __future__ import annotations

import json
from pathlib import Path

import pytest

from research_agent.backend import prompts
from research_agent.backend.config import settings


def test_list_get_update_prompts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    store_path = tmp_path / "prompts_store.json"
    seed = [
        {
            "id": "custom:alpha",
            "name": "Alpha Prompt",
            "role": "agent",
            "content": "Alpha content",
            "archived": False,
        },
        {
            "id": "custom:beta",
            "name": "Beta Prompt",
            "role": "literature",
            "content": "Beta content",
            "archived": True,
        },
    ]
    store_path.write_text(json.dumps(seed, indent=2), encoding="utf-8")

    monkeypatch.setattr(settings, "prompts_store", store_path)

    templates = prompts.list_templates()
    custom_templates = {template.id: template for template in templates if template.source == "custom"}

    assert set(custom_templates) == {"custom:alpha", "custom:beta"}
    assert custom_templates["custom:alpha"].content == "Alpha content"
    assert custom_templates["custom:beta"].archived is True

    fetched = prompts.get_template("custom:alpha")
    assert fetched.name == "Alpha Prompt"

    updated = prompts.update_template("custom:beta", name="Beta Updated", content="Updated content")
    assert updated.name == "Beta Updated"
    assert updated.content == "Updated content"
    assert updated.archived is True

    reloaded = json.loads(store_path.read_text(encoding="utf-8"))
    beta_payload = next(item for item in reloaded if item["id"] == "custom:beta")
    assert beta_payload["name"] == "Beta Updated"
    assert beta_payload["content"] == "Updated content"
    assert beta_payload["archived"] is True
