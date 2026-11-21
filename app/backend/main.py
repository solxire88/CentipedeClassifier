import os

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel

import store
from features import ELEMENTS, LEVELS, build_vector, formula_candidates, group_b
from models import load_models, predict

app = FastAPI(title="CentipedeClassifier")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS = load_models()
assert MODELS, "no model with a 'method' key found in models/"
assert len({tuple(m["feature_names"]) for m in MODELS.values()}) == 1, "the models were trained on different features"


def default_model_id():
    """The winner of notebook 05, or the first model if its file is missing."""
    for model in MODELS.values():
        if model["method"] == store.winner.method and model["setting"] == store.winner.setting:
            return model["id"]
    return next(iter(MODELS))


def holdout_card():
    """The holdout score of the final model (the only one scored on the holdout)."""
    h = store.holdout
    keys = ["holdout_compounds", "drug_f1", "drug_f1_low", "drug_f1_high", "accuracy", "family_accuracy",
            "other_recall", "uncertain_share", "accuracy_answered"]
    return {k: round(float(h[k]), 3) for k in keys}


def model_card(model):
    rows = store.cv_methods[
        (store.cv_methods.method == model["method"])
        & (store.cv_methods.setting == model["setting"])
        & (store.cv_methods.target == model["target"])
    ]
    cv = rows.iloc[0] if len(rows) else None
    return {
        "id": model["id"],
        "method": model["method"],
        "setting": model["setting"],
        "target": model["target"],
        "recommended": model["id"] == default_model_id(),
        "cv_drug_f1": None if cv is None else round(float(cv.drug_f1), 3),
        "cv_spread": None if cv is None else round(float(cv.spread), 3),
        "cv_other_recall": None if cv is None else round(float(cv.other_recall), 3),
        "cv_family_f1": None if cv is None else round(float(cv.family_f1), 3),
        "holdout": holdout_card() if model["id"] == default_model_id() else None,
        "threshold": model["threshold"],
        "provisional": model["provisional"],
    }


@app.get("/health")
def health():
    return {"status": "ok", "models": len(MODELS), "compounds": len(store.library)}


@app.get("/models")
def models():
    return [model_card(m) for m in MODELS.values()]


class PredictRequest(BaseModel):
    model: str | None = None
    precursor_mz: float
    low: str
    mid: str
    high: str
    inchikey: str | None = None


@app.post("/predict")
def predict_endpoint(request: PredictRequest):
    model = MODELS.get(request.model or default_model_id())
    if model is None:
        raise HTTPException(404, f"unknown model '{request.model}'")
    if not 50 <= request.precursor_mz < 650:
        raise HTTPException(422, "precursor m/z must be between 50 and 650")
    try:
        vector, cleaned = build_vector(
            request.precursor_mz, dict(zip(LEVELS, [request.low, request.mid, request.high])), model["feature_names"])
    except ValueError as error:
        raise HTTPException(422, str(error))

    result = predict(model, vector)
    result["model"] = model["id"]
    result["target"] = model["target"]
    result["input_spectra"] = {
        level: [[round(float(a), 4), round(float(b), 4)] for a, b in cleaned[level]] for level in LEVELS
    }
    result["neighbours"] = store.neighbours(vector, k=3, exclude=request.inchikey)
    result["map"] = store.project(vector)
    result["excluded_self"] = request.inchikey in store.by_key
    if request.inchikey in store.by_key:
        result["truth"] = store.by_key[request.inchikey]
    return result


@app.get("/families")
def families():
    """Every family with its class and a fill number 1 to 4 (its position inside the class), for the colour-and-fill code."""
    model = MODELS[default_model_id()]
    seen = {}
    out = []
    for family in model["families"]:
        cls = model["family_to_class"][family]
        seen[cls] = seen.get(cls, 0) + 1
        out.append({"family": family, "class": cls, "variant": min(seen[cls], 4)})
    return out


@app.get("/library")
def library():
    return store.library


@app.get("/library/{inchikey}")
def library_item(inchikey: str):
    item = store.compound(inchikey)
    if item is None:
        raise HTTPException(404, "unknown compound")
    vector = store.X[store.row_of[inchikey]].astype(float)
    item["predictions"] = {}
    for model in MODELS.values():
        p = predict(model, vector)
        item["predictions"][model["id"]] = {k: p[k] for k in ["class", "family", "confidence", "uncertain"]}
    item["neighbours"] = [{**store.by_key[n["inchikey"]], "similarity": n["similarity"]} for n in item["neighbours"][:3]]
    item["structure_neighbours"] = [{**store.by_key[n["inchikey"]], "similarity": n["similarity"]} for n in item["structure_neighbours"]]
    return item


GROUP_PREFIXES = [("LOW_", "LOW spectrum"), ("MID_", "MID spectrum"), ("HIGH_", "HIGH spectrum"), ("precursor_mz", "Precursor m/z"),
                  ("A_", "A: mass defect"), ("B_", "B: formula"), ("C_LOW_", "C: losses, LOW"), ("C_MID_", "C: losses, MID"),
                  ("C_HIGH_", "C: losses, HIGH"), ("D_", "D: summaries")]


def formula_text(counts):
    return "".join(f"{e}{int(n)}" for e, n in sorted(counts.items()) if n > 0)


@app.get("/features/{inchikey}")
def features_of(inchikey: str):
    """The 3,929 numbers the models receive for a library compound (the exported training row), by group,
    and the candidate formulas behind group B."""
    if inchikey not in store.row_of:
        raise HTTPException(404, "unknown compound")
    names = next(iter(MODELS.values()))["feature_names"]
    row = store.X[store.row_of[inchikey]]
    groups, start = [], 0
    for prefix, label in GROUP_PREFIXES:
        end = start
        while end < len(names) and names[end].startswith(prefix):
            end += 1
        groups.append({"prefix": prefix, "label": label, "start": start, "end": end})
        start = end
    assert start == len(names), "feature names do not follow the group layout"

    item = store.by_key[inchikey]
    mz = item["precursor_mz"]
    cand = formula_candidates(mz)
    order = np.argsort(-cand["weight"])[:8]
    total = float(cand["weight"].sum()) or 1.0
    candidates = [
        {"formula": formula_text({**{e: cand[e][i] for e in ELEMENTS}, "H": cand["H"][i]}),
         "ppm": round(float(cand["ppm"][i]), 3), "weight": round(float(cand["weight"][i]) / total, 4)}
        for i in order
    ]
    true_formula = store.compound(inchikey)["formula"]
    for c in candidates:
        c["is_true"] = c["formula"] == true_formula
    return {
        "inchikey": inchikey, "name": item["name"], "precursor_mz": mz,
        "groups": groups, "vector": [round(float(v), 5) for v in row],
        "formula": {"true": true_formula, "n_candidates": int(len(cand["weight"])), "candidates": candidates,
                    "averaged": {k.removeprefix("B_"): round(float(v), 4) for k, v in group_b(mz).items()}},
    }


@app.get("/map")
def map_points():
    return [{k: c[k] for k in ["inchikey", "name", "class", "family", "tag", "x", "y"]} for c in store.library]


@app.get("/results/{name}")
def results(name: str):
    if name not in {"cv_methods", "cv_per_class", "label_fractions", "winner", "threshold_table", "rejection_test",
                    "holdout_results", "holdout_per_class", "holdout_predictions", "final_model", "formula_check"}:
        raise HTTPException(404, "unknown table")
    table = pd.read_csv(store.DATA / "results" / f"{name}.csv")
    table = table.rename(columns={"Unnamed: 0": "class"})
    return table.astype(object).where(table.notna(), None).to_dict(orient="records")
