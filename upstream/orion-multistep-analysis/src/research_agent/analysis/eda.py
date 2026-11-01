from __future__ import annotations

import pandas as pd


def quick_summary(df: pd.DataFrame) -> dict:
    """Return simple shape/dtype/missingness summaries for a DataFrame."""
    summary = {
        "shape": list(df.shape),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "missing": {col: int(df[col].isna().sum()) for col in df.columns},
    }
    return summary

