from __future__ import annotations

import math
from typing import Iterable, Optional

import numpy as np
import pandas as pd


def class_balance(series: Iterable[object]) -> dict:
    """Return counts per label for a 1D iterable (e.g., class labels)."""
    values, counts = np.unique(list(series), return_counts=True)
    return {str(v): int(c) for v, c in zip(values, counts)}


def safe_auc_placeholder(num_samples: int, num_features: int) -> float:
    """Return a deterministic placeholder AUC in [0.5, 0.9] based on inputs."""
    if num_samples <= 0 or num_features <= 0:
        return 0.5
    seed = (num_samples * 31 + num_features * 7) % 1000
    return round(0.5 + (seed % 400) / 1000.0, 3)

