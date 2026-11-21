"""Check that app/backend/features.py gives the vectors of notebooks 01 and 02.

For every compound, the raw peak lists of the SDF and the precursor m/z go through the app's
`build_vector`; the result is compared with the row of data/processed/X.csv, group by group.

Run from the repository root:  .venv/bin/python scripts/check_app_features.py
"""
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from rdkit import RDLogger
from rdkit.Chem import PandasTools

RDLogger.DisableLog("rdApp.*")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app" / "backend"))

start = time.time()
import features  # noqa: E402

print(f"import features: {time.time() - start:.2f} s")

X = pd.read_csv(ROOT / "data/processed/X.csv", index_col="inchikey")
names = list(X.columns)

df = PandasTools.LoadSDF(str(ROOT / "data/raw/locust/HePos_Locust.SDF"))
df["energy"] = df.NAME.str.split().str[-1]
df = df.drop_duplicates(["InChIKey", "energy"])
df["precursor_mz"] = pd.to_numeric(df.PrecursorMZ)
peaks = df.set_index(["InChIKey", "energy"])["MASS SPECTRAL PEAKS"]
precursor = df.groupby("InChIKey").precursor_mz.first()

rows, seconds = [], []
for key in X.index:
    texts = {level: peaks[(key, level)] for level in features.LEVELS}
    start = time.time()
    vector, _ = features.build_vector(precursor[key], texts, names)
    seconds.append(time.time() - start)
    rows.append(vector)
app = pd.DataFrame(rows, index=X.index, columns=names)

group = pd.Series(names).str.extract(r"^(A|B|C|D)_")[0].fillna("bins").values
difference = (app - X).abs()
report = pd.DataFrame({
    "columns": pd.Series(group).value_counts(),
    "max_difference": difference.T.groupby(group).max().max(axis=1),
    "compounds_above_1e-6": (difference.T.groupby(group).max().T > 1e-6).sum(),
})
print(report)
print(f"time per prediction: median {np.median(seconds) * 1000:.0f} ms, max {max(seconds) * 1000:.0f} ms")

worst = (difference > 1e-6).any(axis=1)
if worst.any():
    print("compounds above 1e-6:", list(X.index[worst][:10]))
    sys.exit(1)
print("OK: the app gives the notebook vectors for all", len(X), "compounds")
