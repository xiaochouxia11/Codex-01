"""Lightweight OpenRouter-backed language model wrapper with on-disk caching.

This module provides:
- A single `LM` class with a `generate()` method.
- A shared, process-wide on-disk cache (via `diskcache`) keyed by prompt +
  configuration, so repeated runs are reproducible and cheap.

Environment variables that must be set:
- `OPENROUTER_API_KEY`: OpenRouter API key

The cache is stored under `<project_root>/.cache/` where `project_root` is found
by walking upward from this file until we see `pyproject.toml` or `.git`.
"""

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import requests
from diskcache import Cache

logger = logging.getLogger(__name__)

# Convenience registry for "default" model instances. Note that this file
# populates `LMS` at import-time (see bottom of file), which requires provider
# API keys to be present in the environment.
LMS: dict[str, "LM"] = {}

OPENROUTER_MODELS = {
    "gemini-3-pro-preview": {
        "id": "google/gemini-3-pro-preview",
        "context": 1_005_000,
    },
    "grok-4": {
        "id": "x-ai/grok-4",
        "context": 256_000,
    },
    "gpt-5": {
        "id": "openai/gpt-5",
        "context": 400_000,
    },
    "opus-4.5": {
        "id": "anthropic/claude-opus-4.5",
        "context": 200_000,
    },
    "gpt-4.1": {
        "id": "openai/gpt-4.1",
        "context": 1_000_000,
    },
    "openai/gpt-5-mini": {
        "id": "openai/gpt-5-mini",
        "context": 400_000,
    },
    "openai/o4-mini": {
        "id": "openai/o4-mini",
        "context": 200_000,
    },
}


def find_project_root(start: str | Path | None = None) -> Path:
    """Return the top-level project directory.

    Starting from *start* (defaults to the current working directory), walk
    upwards until a directory containing either ``pyproject.toml`` **or** a
    ``.git`` folder is found.  If no such marker is encountered, the search
    stops at the filesystem root and the original starting directory is
    returned.
    """

    path = Path(start or Path.cwd()).resolve()
    for parent in [path, *path.parents]:
        if (parent / "pyproject.toml").exists() or (parent / ".git").exists():
            return parent

    logger.warning("Could not find project root; falling back to current working directory")
    return path


class LM:
    """OpenRouter-backed LM with caching and a uniform `generate()` interface."""

    # Single global cache shared by all LM instances (lazy-initialized).
    _global_cache: Cache | None = None
    # Debug knobs for "cache-only" runs (useful for deterministic replays).
    # - `warn_cache_misses`: log missing keys (but still call the provider).
    # - `error_on_cache_miss`: raise on any miss (never call the provider).
    warn_cache_misses: bool = False
    error_on_cache_miss: bool = False

    CACHE_SUBDIR = ".cache"

    def __init__(self, model_name: str = "", cache: bool = True) -> None:
        """Create an OpenRouter-backed LM.

        Parameters
        ----------
        model_name
            Short name key in `OPENROUTER_MODELS` (preferred) or a raw OpenRouter model id.
        cache
            Whether to use the shared on-disk cache.
        """
        self._cache_enabled: bool = cache
        self.model_name = model_name

        if model_name not in OPENROUTER_MODELS:
            logger.warning(f"Model {model_name} not found in OPENROUTER_MODELS, using as-is")
            self.api_name = model_name
            self.context_length: int | None = None
        else:
            self.api_name = OPENROUTER_MODELS[model_name]["id"]
            self.context_length = OPENROUTER_MODELS[model_name]["context"]

        self.api_key = os.environ.get("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable must be set.")

        self.num_prints = 5
        self.usage_new = {}
        self.usage_repeat = {}
        self.usage_seen = set()

    def add_usage(self, key: str, usage: dict) -> None:
        usage_dict = self.usage_repeat if key in self.usage_seen else self.usage_new
        for k, v in usage.items():
            if isinstance(v, (int, float)):
                usage_dict[k] = usage_dict.get(k, 0) + v

        self.usage_seen.add(key)

    def generate(
        self,
        prompt: str,
        system_message: str | None = None,
        seed: str | int | None = None,
        max_retries: int | None = 3,
        output_mode: str = "response",  # "response", "with_usage", or "full"
        **kwargs: Any,
    ) -> Any:
        """Generate *one* response and return it.

        The method transparently handles on-disk caching *and* simple retry
        logic.  All additional keyword arguments are forwarded to the backend
        implementation and also form part of the cache key so that different
        parameter combinations are cached independently.
        """

        assert output_mode in ["response", "with_usage", "full"], f"Invalid {output_mode=}"
        # Normalise seed -> str so it can be hashed and is stable across types.
        seed_str = str(seed)

        # ------------------------------------------------------------------
        # 1. Cache lookup
        # ------------------------------------------------------------------
        if self._cache_enabled:
            key = self._make_key(prompt, system_message, seed_str, output_mode, kwargs)
            cached = self.cached_get(key)
            if cached is not None:
                if output_mode == "with_usage":
                    assert len(cached) == 2
                    self.add_usage(key, cached[1])
                return cached  # type: ignore[return-value]

            if LM.warn_cache_misses:
                logger.warning(
                    f"{self.model_name=} {seed=} LM.warn_cache_misses=True but cache missing {prompt[:100]=!r}"
                )

            if LM.error_on_cache_miss:
                raise RuntimeError(
                    f"{self.model_name=} {seed=} LM.error_on_cache_miss=True but cache missing {len(system_message or '')=} {len(prompt)=} {prompt[:500]=!r}"
                )

        # ------------------------------------------------------------------
        # 2. Generate with simple retry loop (for transient network/provider errors)
        # ------------------------------------------------------------------
        attempts = max(1, max_retries or 1)
        last_err: Exception | None = None
        for a in range(attempts):
            try:
                response = self._generate(
                    prompt, system_message, seed_str, output_mode=output_mode, **kwargs
                )
                if self._cache_enabled:
                    self.cached_set(key, response)
                if output_mode == "with_usage":
                    assert len(response) == 2
                    self.add_usage(key, response[1])
                return response
            except Exception as e:
                last_err = e
                logger.warning(f"{self.model_name} failed on {prompt[:50]!r}:\nException {e}")
                if a == attempts - 1:
                    raise e
                print(f"Attempt {a + 1} of {attempts} failed. Retrying after sleeping 1 second.")
                time.sleep(1)
                continue

        # If we get here, all retries failed
        raise RuntimeError(f"{self.model_name} failed on prompt {prompt[:1000]!r}: {last_err}")

    def _generate(
        self,
        prompt: str,
        system_message: str | None,
        seed_str: str,
        output_mode: str = "response",  # "response", "with_usage", or "full"
        **kwargs,
    ) -> Any:
        logger.debug("=== OpenRouter single prompt ===")
        logger.debug(f"Model: {self.model_name} -> {self.api_name}")

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        logger.debug(f"Messages: {messages}")

        payload = {
            "model": self.api_name,
            "messages": messages,
        }
        payload.update(kwargs)

        completion = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
            },
            data=json.dumps(payload),
        ).json()

        if self.num_prints > 0:
            self.num_prints -= 1
            try:
                print(
                    f"OpenRouter {self.model_name} request total tokens:",
                    completion["usage"]["total_tokens"],
                )
            except Exception:
                pass

        if output_mode == "full":
            return completion
        response = completion["choices"][0]["message"]["content"]
        if output_mode == "with_usage":
            usage = completion["usage"]
            for k in ["is_byok", "prompt_tokens_details", "cost_details"]:
                if k in usage:
                    del usage[k]
            return response, usage
        assert output_mode == "response", f"Invalid output mode: {output_mode}"
        logger.debug(f"OpenRouter response: {response}")
        return response

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------
    def get_cache(self) -> Cache:
        """Get the cache for the LM."""
        assert self._cache_enabled
        if LM._global_cache is None:  # first-time setup
            # Use the repository/project root so caches remain stable even if
            # you execute notebooks/scripts from different working directories.
            project_root = find_project_root(Path(__file__).resolve())
            cache_dir = project_root / self.CACHE_SUBDIR
            cache_dir.mkdir(parents=True, exist_ok=True)
            LM._global_cache = Cache(
                directory=cache_dir,
                size_limit=10 * 1024**3,  # 10 GiB
                cull_limit=10_000,  # purge up to 10k rows when full
            )
        return LM._global_cache

    def cached_get(self, key: str) -> Any | None:
        """Retrieve *key* from the disk cache if present."""
        if not self._cache_enabled:
            return None
        return self.get_cache().get(key)

    def cached_set(self, key: str, value: Any, expire: int | None = None) -> None:
        """Store *value* under *key* in the disk cache."""
        if self._cache_enabled:
            self.get_cache().set(key, value, expire=expire)

    # ------------------------------------------------------------------
    # Key builder helper
    # ------------------------------------------------------------------
    def _make_key(
        self,
        prompt: str,
        system_message: str | None,
        seed_str: str,
        output_mode: str,
        kwargs: dict[str, Any],
        hash: bool = True,
    ) -> str:
        """Create a stable cache key for a single `generate()` call.

        The cache key intentionally includes `output_mode` and all forwarded
        kwargs, because those can change both the content and the shape of the
        returned object.

        Note: kwargs are hashed via `repr(tuple(sorted(kwargs.items())))`, so
        callers should only pass values with stable string representations.
        """
        if not self._cache_enabled:
            return ""

        key_tuple = (
            self.model_name,
            system_message,
            prompt,
            seed_str,
            output_mode,
            tuple(sorted(kwargs.items())),  # canonical order
        )
        if hash:
            return hashlib.sha256(repr(key_tuple).encode()).hexdigest()
        else:
            return str(key_tuple)


for model_name in OPENROUTER_MODELS:
    LMS[model_name] = LM(model_name)
