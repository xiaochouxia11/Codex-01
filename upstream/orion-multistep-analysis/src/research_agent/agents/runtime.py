from __future__ import annotations

import json
import os
import random
import time
from types import SimpleNamespace
from typing import Any, Iterable, Mapping, Sequence

from openai import BadRequestError, OpenAI

from research_agent.tools import process_tool_calls, responses_output_text


_DEFAULT_ANALYSIS_MODEL = "gpt-5.2-pro"
_DEFAULT_SUPERVISOR_MODEL = "gpt-5.2-pro"
_DEFAULT_LITERATURE_MODEL = "gpt-5.2"


def _get_first_env(*names: str, default: str) -> str:
    """Return the first non-empty environment variable among names."""

    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default


def _default_model_for_agent(agent_name: str) -> str:
    """Resolve a default model per agent role.

    Roles:
    - main (analysis): defaults to gpt-5.2-pro
    - supervisor: defaults to gpt-5.2-pro
    - literature: defaults to gpt-5.2

    Optional overrides:
    - ORION_OPENAI_MODEL_ANALYSIS
    - ORION_OPENAI_MODEL_SUPERVISOR (falls back to *_ANALYSIS if unset)
    - ORION_OPENAI_MODEL_LITERATURE
    - ORION_OPENAI_MODEL (global fallback for any role)
    """

    role = (agent_name or "").strip().lower()
    if role == "literature":
        return _get_first_env(
            "ORION_OPENAI_MODEL_LITERATURE",
            "ORION_OPENAI_MODEL",
            "MRDAA_OPENAI_MODEL_LITERATURE",
            "MRDAA_OPENAI_MODEL",
            default=_DEFAULT_LITERATURE_MODEL,
        )
    if role == "supervisor":
        return _get_first_env(
            "ORION_OPENAI_MODEL_SUPERVISOR",
            "ORION_OPENAI_MODEL_ANALYSIS",
            "ORION_OPENAI_MODEL",
            "MRDAA_OPENAI_MODEL_SUPERVISOR",
            "MRDAA_OPENAI_MODEL_ANALYSIS",
            "MRDAA_OPENAI_MODEL",
            default=_DEFAULT_SUPERVISOR_MODEL,
        )
    # Treat anything else as the main analysis agent.
    return _get_first_env(
        "ORION_OPENAI_MODEL_ANALYSIS",
        "ORION_OPENAI_MODEL",
        "MRDAA_OPENAI_MODEL_ANALYSIS",
        "MRDAA_OPENAI_MODEL",
        default=_DEFAULT_ANALYSIS_MODEL,
    )


def _message_field(message: Any, key: str, default: Any = None) -> Any:
    if isinstance(message, Mapping):
        return message.get(key, default)
    return getattr(message, key, default)


def _coerce_message_content(content: Any) -> Any:
    if content is None:
        return ""
    return content


def _normalize_call_id(
    raw_id: Any,
    *,
    fallback_idx: int,
    call_id_map: dict[str, str],
) -> str:
    if isinstance(raw_id, str) and raw_id:
        if raw_id in call_id_map:
            return call_id_map[raw_id]
        normalized = raw_id if raw_id.startswith("fc_") else f"fc_{raw_id}"
        call_id_map[raw_id] = normalized
        call_id_map[normalized] = normalized
        return normalized

    normalized = f"fc_auto_{fallback_idx}"
    call_id_map[normalized] = normalized
    return normalized


def _coerce_tool_call(
    call: Any,
    *,
    fallback_idx: int,
    call_id_map: dict[str, str],
) -> SimpleNamespace:
    if isinstance(call, Mapping):
        name = _message_field(call.get("function", {}), "name", "")
        arguments = _message_field(call.get("function", {}), "arguments", "{}")
        raw_call_id = call.get("id") or call.get("call_id")
    else:
        function = getattr(call, "function", None)
        name = getattr(function, "name", getattr(call, "name", ""))
        arguments = getattr(function, "arguments", getattr(call, "arguments", "{}"))
        raw_call_id = getattr(call, "id", None) or getattr(call, "call_id", None)

    if not isinstance(arguments, str):
        arguments = json.dumps(arguments)
    call_id = _normalize_call_id(
        raw_call_id, fallback_idx=fallback_idx, call_id_map=call_id_map
    )

    return SimpleNamespace(
        id=call_id,
        call_id=call_id,
        type="function",
        function=SimpleNamespace(name=name or "", arguments=arguments or "{}"),
    )


def _history_to_responses_input(history: Sequence[Any]) -> list[dict[str, Any]]:
    input_items: list[dict[str, Any]] = []
    call_id_map: dict[str, str] = {}
    for entry in history:
        role = _message_field(entry, "role")
        if not role:
            continue

        if role == "tool":
            raw_call_id = _message_field(entry, "tool_call_id") or _message_field(
                entry, "id"
            )
            call_id = _normalize_call_id(
                raw_call_id,
                fallback_idx=len(call_id_map) + 1,
                call_id_map=call_id_map,
            )
            output = _message_field(entry, "content", "")
            input_items.append(
                {
                    "type": "function_call_output",
                    "call_id": call_id or "tool_output_unknown",
                    "output": "" if output is None else str(output),
                }
            )
            continue

        content = _coerce_message_content(_message_field(entry, "content"))
        message_item: dict[str, Any] = {
            "type": "message",
            "role": role,
            "content": content,
        }
        if isinstance(entry, Mapping):
            for key in ("name",):
                if key in entry:
                    message_item[key] = entry[key]
        else:
            extra_name = getattr(entry, "name", None)
            if extra_name:
                message_item["name"] = extra_name
        input_items.append(message_item)

        tool_calls = _message_field(entry, "tool_calls") or []
        for idx, call in enumerate(tool_calls, start=1):
            coerced = _coerce_tool_call(
                call,
                fallback_idx=len(call_id_map) + idx,
                call_id_map=call_id_map,
            )
            input_items.append(
                {
                    "type": "function_call",
                    "name": coerced.function.name,
                    "arguments": coerced.function.arguments,
                    "call_id": coerced.call_id,
                }
            )

    return input_items


def _response_to_message(response: Any) -> SimpleNamespace:
    content = responses_output_text(response).strip()
    role = "assistant"
    tool_calls: list[SimpleNamespace] = []

    output_items = getattr(response, "output", None) or []
    for item in output_items:
        item_type = getattr(item, "type", None)
        if item_type == "message":
            item_role = getattr(item, "role", None)
            if item_role:
                role = item_role
        elif item_type == "function_call":
            call_id = getattr(item, "call_id", None) or getattr(item, "id", None)
            name = getattr(item, "name", "")
            arguments = getattr(item, "arguments", "{}")
            if not isinstance(arguments, str):
                arguments = json.dumps(arguments)
            call_ns = SimpleNamespace(
                id=call_id or f"tool_call_{len(tool_calls) + 1}",
                call_id=call_id or f"tool_call_{len(tool_calls) + 1}",
                type="function",
                function=SimpleNamespace(name=name or "", arguments=arguments),
            )
            tool_calls.append(call_ns)

    return SimpleNamespace(
        role=role,
        content=content or "",
        tool_calls=tool_calls,
        response=response,
    )


def chat(
    client,
    messages,
    tools=None,
    model=_DEFAULT_ANALYSIS_MODEL,
    *,
    max_retries: int = 3,
    backoff_base: float = 1.0,
):
    attempt = 0
    while True:
        attempt += 1
        try:
            request_payload = {
                "model": model,
                "input": _history_to_responses_input(messages),
                "reasoning": {"effort": "high"},
            }
            if tools:
                request_payload["tools"] = tools

            resp = client.responses.create(**request_payload)
            return _response_to_message(resp)
        except BadRequestError:
            if attempt >= max_retries:
                raise
            sleep_s = backoff_base * (2 ** (attempt - 1)) + random.random() * 0.1
            time.sleep(sleep_s)


def build_supervisor_context(
    main_messages: Iterable[Any],
    literature_records: Sequence[Mapping[str, Any]] | None = None,
    analysis_records: Sequence[Mapping[str, Any]] | None = None,
) -> list[dict[str, str]]:
    sup_context: list[dict[str, str]] = []
    for m in main_messages:
        role = m["role"] if isinstance(m, dict) else getattr(m, "role", None)
        content = m["content"] if isinstance(m, dict) else getattr(m, "content", None)
        content = content or ""
        if role == "user":
            sup_context.append({"role": "assistant", "content": content})
        elif role == "assistant":
            sup_context.append({"role": "user", "content": content})

    def _default_serializer(value: Any) -> str:
        return str(value)

    if literature_records:
        serialized_records = json.dumps(
            {"literature_records": list(literature_records)},
            ensure_ascii=False,
            indent=2,
            default=_default_serializer,
        )
        sup_context.append(
            {
                "role": "user",
                "content": "LITERATURE_AUDIT_TRAIL\n" + serialized_records,
            }
        )

    if analysis_records:
        serialized_analysis = json.dumps(
            {"analysis_records": list(analysis_records)},
            ensure_ascii=False,
            indent=2,
            default=_default_serializer,
        )
        sup_context.append(
            {
                "role": "user",
                "content": "ANALYSIS_AUDIT_TRAIL\n" + serialized_analysis,
            }
        )

    return sup_context


def agent_inner_loop(
    *,
    agent_name: str,
    client: OpenAI,
    messages: list[Any],
    toolspec,
    tool_handlers,
    reporter,
    model: str | None = None,
):
    while True:
        resolved_model = (model or _default_model_for_agent(agent_name)).strip()
        msg = chat(client, messages, tools=toolspec, model=resolved_model)
        if process_tool_calls(
            msg=msg, messages=messages, reporter=reporter, tool_handlers=tool_handlers
        ):
            continue
        text = msg.content or ""
        if agent_name == "main":
            reporter.main_agent(0, text)
        elif agent_name == "literature":
            if hasattr(reporter, "literature"):
                try:
                    reporter.literature(0, text)  # type: ignore[attr-defined]
                except Exception:
                    if hasattr(reporter, "log"):
                        reporter.log("literature_agent", step=0, text=text)
            else:
                if hasattr(reporter, "log"):
                    reporter.log("literature_agent", step=0, text=text)
        else:
            reporter.supervisor(0, text)
        messages.append(msg)
        return msg


__all__ = [
    "agent_inner_loop",
    "build_supervisor_context",
    "chat",
]
