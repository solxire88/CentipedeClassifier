"""Load the saved models and turn a feature vector into probabilities."""
from pathlib import Path

import joblib
import numpy as np

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
DEFAULT_THRESHOLD = 0.40


def align(proba, classes, n_families):
    full = np.zeros((len(proba), n_families))
    full[:, classes] = proba
    no_path = np.isnan(full).any(axis=1)
    full[no_path] = 1 / n_families  # label spreading: no labeled compound reaches this one
    return full


def family_proba(saved, X):
    """Probability of every family (in the order of saved['families']) for each row of X."""
    model, n = saved["model"], len(saved["families"])
    if model["kind"] == "sklearn":
        m = model["model"]
        return align(m.predict_proba(X), m.classes_, n)
    if model["kind"] == "co-training":
        a, b = model["model_a"], model["model_b"]
        pa = align(a.predict_proba(X[:, model["view_a"]]), a.classes_, n)
        pb = align(b.predict_proba(X[:, model["view_b"]]), b.classes_, n)
        return (pa + pb) / 2
    if model["kind"] == "cluster-then-label":
        return model["cluster_proba"][model["kmeans"].predict(X)]
    raise ValueError(model["kind"])


def load_models():
    """Every file in models/ that holds a 'method' key, keyed by file name."""
    models = {}
    for path in sorted(MODELS_DIR.glob("*.joblib")):
        saved = joblib.load(path)
        if "method" not in saved:
            continue
        families, classes = saved["families"], saved["classes"]
        class_of = [saved["family_to_class"][f] for f in families]
        saved["M"] = np.array([[1.0 if c == k else 0.0 for k in classes] for c in class_of])
        saved["id"] = path.stem
        saved["threshold"] = saved.get("threshold", DEFAULT_THRESHOLD)
        saved["provisional"] = "threshold" not in saved or saved.get("provisional", False)
        models[path.stem] = saved
    return models


def predict(saved, vector):
    """Class and family probabilities, the answer and the confidence for one vector."""
    families, classes = saved["families"], saved["classes"]
    fam = family_proba(saved, vector.reshape(1, -1))[0]
    cls = fam @ saved["M"]

    top_family = int(fam.argmax())
    if saved["target"] == "sum":
        answer = classes[int(cls.argmax())]
        confidence = float(cls.max())
    else:
        answer = saved["family_to_class"][families[top_family]]
        confidence = float(fam.max())

    order = np.argsort(-fam)[:5]
    return {
        "class": answer,
        "family": families[top_family],
        "confidence": confidence,
        "uncertain": confidence < saved["threshold"],
        "threshold": saved["threshold"],
        "provisional": saved["provisional"],
        "class_probabilities": {c: float(p) for c, p in zip(classes, cls)},
        "top_families": [
            {"family": families[i], "class": saved["family_to_class"][families[i]], "probability": float(fam[i])}
            for i in order
        ],
    }
