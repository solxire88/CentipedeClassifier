"""Export the data the app needs to app/backend/data/.

Run from the repository root:  .venv/bin/python scripts/export_app_data.py
"""
import json
import re
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, PandasTools
from rdkit.Chem.Draw import rdMolDraw2D
from sklearn.decomposition import PCA

RDLogger.DisableLog("rdApp.*")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "backend" / "data"
(OUT / "compounds").mkdir(parents=True, exist_ok=True)
(OUT / "results").mkdir(parents=True, exist_ok=True)

LEVELS = ["LOW", "MID", "HIGH"]
TAGS = {"holdout": "held_out", "train": "training"}


# ---- read what the notebooks produced ---------------------------------------------
X = pd.read_csv(ROOT / "data/processed/X.csv", index_col="inchikey")
X_full = X  # all 3,929 columns (notebook 02): the app predicts library compounds from them
X = X_full.iloc[:, :1951]  # the spectrum columns of notebook 01 feed the map and the neighbours
compounds = pd.read_csv(ROOT / "data/processed/compounds.csv", skipinitialspace=True)
compounds.columns = compounds.columns.str.strip()
for col in ["inchikey", "name", "formula", "smiles"]:
    compounds[col] = compounds[col].str.strip()
compounds = compounds.set_index("inchikey").loc[X.index]

labels = pd.read_csv(ROOT / "data/labels/labels.csv").set_index("inchikey")
split = pd.read_csv(ROOT / "data/labels/split.csv").set_index("inchikey")

assert len(X) == len(compounds) == len(labels) == 1570
assert X.shape[1] == 1951 and X_full.shape[1] == 3929


# ---- raw spectra from the SDF (same first-record rule as notebook 01) ------------------
sdf = PandasTools.LoadSDF(str(ROOT / "data/raw/locust/HePos_Locust.SDF"))
sdf["level"] = sdf.NAME.str.split().str[-1]
sdf = sdf.drop_duplicates(["InChIKey", "level"]).set_index(["InChIKey", "level"])


def parse_peaks(text):
    return np.array([line.split()[:2] for line in text.strip().splitlines()], dtype=float)


def clean_spectrum(spectrum):
    mz, intensity = spectrum.T
    intensity = intensity / intensity.max()
    keep = intensity >= 0.005
    mz, intensity = mz[keep], intensity[keep]
    top = np.sort(np.argsort(intensity)[-200:])
    return np.column_stack([mz[top], np.sqrt(intensity[top])])


def rounded(spectrum, digits):
    return [[round(float(a), 4), round(float(b), digits)] for a, b in spectrum]


# ---- 3D structure ----------------------------------------------------------------
def molblock_3d(smiles):
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    if AllChem.EmbedMolecule(mol, randomSeed=0, maxAttempts=20) != 0:
        if AllChem.EmbedMolecule(mol, randomSeed=0, useRandomCoords=True, maxAttempts=20) != 0:
            return None
    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=200)
    except Exception:
        pass
    return Chem.MolToMolBlock(mol)


# ---- 2D structure (SVG, one colour, no background: it takes the text colour of the page) ----------
def svg_2d(smiles):
    mol = Chem.MolFromSmiles(smiles)
    drawer = rdMolDraw2D.MolDraw2DSVG(400, 300)
    options = drawer.drawOptions()
    options.clearBackground = False
    options.useBWAtomPalette()
    options.bondLineWidth = 2
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()
    svg = re.sub(r"<\?xml[^>]*\?>\s*", "", svg)
    svg = re.sub(r"\s+width='[^']*'\s+height='[^']*'", " ", svg, count=1)
    return svg.replace("#000000", "currentColor")


# ---- map and neighbours ----------------------------------------------------------
spectra = X.iloc[:, :1950].values.astype(np.float32)
pca = PCA(n_components=2, random_state=0).fit(spectra)
coords = pca.transform(spectra)
np.savez_compressed(OUT / "pca.npz", mean=pca.mean_, components=pca.components_)  # the backend projects pasted spectra with it

unit = spectra / np.linalg.norm(spectra, axis=1, keepdims=True).clip(1e-9)
similarity = unit @ unit.T
np.fill_diagonal(similarity, -1)
nearest = np.argsort(-similarity, axis=1)[:, :5]

keys = list(X.index)

# structural neighbours: Tanimoto similarity of Morgan fingerprints (radius 2, 2048 bits), as in notebook 04
from rdkit import DataStructs
from rdkit.Chem import rdFingerprintGenerator
_gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)
fps = [_gen.GetFingerprint(Chem.MolFromSmiles(compounds.loc[k, "smiles"])) for k in keys]
struct_nearest = []
for i in range(len(keys)):
    sims = np.array(DataStructs.BulkTanimotoSimilarity(fps[i], fps))
    sims[i] = -1
    idx = np.argsort(-sims)[:3]
    struct_nearest.append([{"inchikey": keys[j], "similarity": round(float(sims[j]), 4)} for j in idx])


def tag_of(key):
    if labels.loc[key, "status"] == "unlabeled":
        return "unlabeled"
    return TAGS[split.loc[key, "set"]]


# ---- one file per compound -------------------------------------------------------
index = []
for i, key in enumerate(keys):
    row = compounds.loc[key]
    record = sdf.loc[key]
    detail = {}
    for level in LEVELS:
        raw = parse_peaks(record.loc[level, "MASS SPECTRAL PEAKS"])
        detail[level] = {"raw": rounded(raw, 2), "clean": rounded(clean_spectrum(raw), 4)}

    meta = record.loc["LOW"]
    synonyms = []
    for s in str(meta.get("Synonyms", "")).replace(";", "\n").splitlines():
        s = s.strip().removesuffix(" LOW").removesuffix(" MID").removesuffix(" HIGH").strip("\u200b ")
        if s and s not in synonyms and s != row["name"]:
            synonyms.append(s)
    family = labels.loc[key, "family"]
    cls = labels.loc[key, "class"]
    tag = tag_of(key)

    item = {
        "inchikey": key,
        "name": row["name"].replace("​", ""),
        "formula": row["formula"],
        "precursor_mz": float(row["precursor_mz"]),
        "family": None if pd.isna(family) else family,
        "class": None if pd.isna(cls) else cls,
        "tag": tag,
    }
    high = sorted(detail["HIGH"]["clean"], key=lambda p: -p[1])[:10]  # ten strongest cleaned HIGH peaks, for the list sparkline
    spark = [[p[0], round(p[1] / high[0][1], 3)] for p in sorted(high)]
    index.append({**item, "x": round(float(coords[i, 0]), 4), "y": round(float(coords[i, 1]), 4), "spark": spark})

    full = {
        **item,
        "exact_mass": float(meta["ExactMass"]),
        "mw": float(meta["MW"]),
        "synonyms": synonyms,
        "smiles": row["smiles"],
        "molblock": molblock_3d(row["smiles"]),
        "svg2d": svg_2d(row["smiles"]),
        "map": [round(float(coords[i, 0]), 4), round(float(coords[i, 1]), 4)],
        "spectra": detail,
        "neighbours": [{"inchikey": keys[j], "similarity": round(float(similarity[i, j]), 4)} for j in nearest[i]],
        "structure_neighbours": struct_nearest[i],
    }
    (OUT / "compounds" / f"{key}.json").write_text(json.dumps(full, separators=(",", ":")))
    if i % 200 == 0:
        print(i, key, flush=True)

(OUT / "library.json").write_text(json.dumps(index, separators=(",", ":")))
np.savez_compressed(OUT / "matrix.npz", keys=np.array(keys), X=X_full.values.astype(np.float32))

# ---- results tables made by notebooks 05 and 06 -------------------------------------------------
RESULT_TABLES = ["cv_methods", "cv_per_class", "label_fractions", "winner", "threshold_table", "rejection_test",
                 "holdout_results", "holdout_per_class", "holdout_predictions", "final_model", "formula_check"]
for name in [f"{t}.csv" for t in RESULT_TABLES]:
    shutil.copy(ROOT / "reports/tables" / name, OUT / "results" / name)

# ---- snapshot for the landing page (it must render while the free backend is asleep) -----------
import datetime
from sklearn.metrics import f1_score

TABLES = ROOT / "reports/tables"
hold = pd.read_csv(TABLES / "holdout_results.csv").iloc[0]
final = pd.read_csv(TABLES / "final_model.csv").iloc[0]
per_class = pd.read_csv(TABLES / "holdout_per_class.csv").set_index("class")
reject = pd.read_csv(TABLES / "rejection_test.csv")
pred = pd.read_csv(TABLES / "holdout_predictions.csv")
DRUGS = ["cannabinoid", "depressant", "dissociative", "opioid", "psychedelic", "stimulant"]

train_classes = labels[(labels.status == "known")].join(split["set"])
train_classes = train_classes[train_classes["set"] == "train"]["class"]
most_common = train_classes.value_counts().idxmax()
answered = pred[~pred.uncertain]
strong = pred[pred.confidence >= 0.8]
labeled = labels[labels.status == "known"]


def landing_example(key, role):
    row = pred[pred.inchikey == key].iloc[0]
    return {"role": role, "inchikey": key, "name": row["name"], "true_class": row["class"], "true_family": row.family,
            "class": row.predicted_class, "family": row.predicted_family, "confidence": float(row.confidence),
            "uncertain": bool(row.uncertain), "tag": tag_of(key)}


def high_peaks(key):
    detail = json.loads((OUT / "compounds" / f"{key}.json").read_text())
    return detail, [p for p in detail["spectra"]["HIGH"]["clean"]]


FENTANYL = "PJMPHNIQZUBGLI-UHFFFAOYSA-N"
fent, fent_peaks = high_peaks(FENTANYL)
near_key = fent["neighbours"][0]["inchikey"]
near, near_peaks = high_peaks(near_key)
shared = sorted({round(a[0]) for a in fent_peaks if a[1] >= 0.1 for b in near_peaks if b[1] >= 0.1 and abs(a[0] - b[0]) <= 0.5})

landing = {
    "computed": datetime.date.today().isoformat(),
    "model": {"method": final.method, "setting": final.setting, "threshold": float(final.threshold)},
    "scores": {
        "holdout_compounds": int(hold.holdout_compounds), "drug_f1": float(hold.drug_f1), "drug_f1_low": float(hold.drug_f1_low),
        "drug_f1_high": float(hold.drug_f1_high), "accuracy": float(hold.accuracy), "family_accuracy": float(hold.family_accuracy),
        "other_recall": float(hold.other_recall), "other_precision": float(per_class.loc["other", "precision"]),
        "uncertain_share": float(hold.uncertain_share), "accuracy_answered": float(hold.accuracy_answered),
        "cv_drug_f1": float(hold.cv_drug_f1), "cv_spread": float(hold.cv_spread),
        "guessing_drug_f1": float(f1_score(pred["class"], [most_common] * len(pred), labels=DRUGS, average="macro", zero_division=0)),
        "guessing_class": most_common,
        "answered": int(len(answered)), "answered_wrong": int((answered["class"] != answered.predicted_class).sum()),
        "strong_answered": int(len(strong)), "strong_right": int((strong["class"] == strong.predicted_class).sum()),
        "unseen_uncertain": float(reject.uncertain_share.mean()), "normal_uncertain": float(reject.normal_uncertain_share.iloc[0]),
    },
    "labels": {
        "labeled": int(len(labeled)), "unlabeled": int((labels.status == "unlabeled").sum()),
        "training": int((split["set"] == "train").sum()), "holdout": int((split["set"] == "holdout").sum()),
        "families": int(labeled.family.nunique()), "per_class": labeled["class"].value_counts().to_dict(),
    },
    "examples": [
        landing_example("DVCBBZBNZSSXMS-UHFFFAOYSA-N", "a confident answer"),
        landing_example("QCHFTSOMWOSFHM-UHFFFAOYSA-N", "an uncertain answer"),
        landing_example("NQTRBZXDWMDXAQ-UHFFFAOYSA-N", "a confident mistake"),
    ],
    "mirror": {
        "top": {"name": fent["name"], "precursor_mz": fent["precursor_mz"], "peaks": fent_peaks},
        "bottom": {"name": near["name"], "precursor_mz": near["precursor_mz"], "peaks": near_peaks,
                   "similarity": fent["neighbours"][0]["similarity"], "tag": tag_of(near_key)},
        "shared": shared,
    },
}
(ROOT / "app/frontend/lib/landing-data.json").write_text(json.dumps(landing, indent=1))

# ---- checks ----------------------------------------------------------------------
tags = pd.Series([c["tag"] for c in index]).value_counts().to_dict()
print("compounds:", len(index), "tags:", tags)
assert len(index) == 1570
assert tags == {"unlabeled": 933, "training": 511, "held_out": 126}
no_3d = [c["inchikey"] for c in index if json.loads((OUT / "compounds" / f"{c['inchikey']}.json").read_text())["molblock"] is None]
print("without 3D structure:", len(no_3d))
