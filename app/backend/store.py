"""The exported library, matrix and result tables."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent / "data"

library = json.loads((DATA / "library.json").read_text())
by_key = {c["inchikey"]: c for c in library}

_matrix = np.load(DATA / "matrix.npz")
keys = list(_matrix["keys"])
X = _matrix["X"]
row_of = {k: i for i, k in enumerate(keys)}

_unit = X[:, :1950] / np.linalg.norm(X[:, :1950], axis=1, keepdims=True).clip(1e-9)

_pca = np.load(DATA / "pca.npz")


def project(vector):
    """Place a spectrum on the map with the PCA fitted on the library (first 1,950 bins)."""
    v = np.asarray(vector[:1950], dtype=np.float64)
    return [round(float(a), 4) for a in (v - _pca["mean"]) @ _pca["components"].T]


cv_methods = pd.read_csv(DATA / "results" / "cv_methods.csv")
winner = pd.read_csv(DATA / "results" / "winner.csv").iloc[0]
holdout = pd.read_csv(DATA / "results" / "holdout_results.csv").iloc[0]


def compound(inchikey):
    path = DATA / "compounds" / f"{inchikey}.json"
    return json.loads(path.read_text()) if path.exists() and inchikey in by_key else None


def neighbours(vector, k=3, exclude=None):
    """The k library compounds with the most similar spectra (cosine on the 1,950 bins)."""
    v = vector[:1950].astype(np.float32)
    v = v / max(np.linalg.norm(v), 1e-9)
    sims = _unit @ v
    if exclude in row_of:
        sims[row_of[exclude]] = -1
    best = np.argsort(-sims)[:k]
    return [{**by_key[keys[i]], "similarity": round(float(sims[i]), 4)} for i in best]
