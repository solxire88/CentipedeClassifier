"""Turn pasted peak lists into the feature vector the models were trained on.

Everything here repeats notebooks 01 and 02, with numpy only.

Notebook 01: scale to the base peak, drop peaks under 0.5%, keep the 200 strongest, take the
square root, divide by the spectrum's own length (L2), then bin to 650 one-unit bins.

Notebook 02 adds four groups of columns computed from the exact m/z of the cleaned peaks:
A (mass defect and nitrogen rule), B (formula from the precursor mass), C (neutral losses)
and D (spectrum summaries).

The order of the columns is not fixed here: `build_vector` returns the values in the order of
the `feature_names` saved with the model.
"""
import re

import numpy as np

LEVELS = ["LOW", "MID", "HIGH"]
N_BINS = 650

# ---- constants of notebook 02 -----------------------------------------------------------
MASS = {"C": 12.0, "H": 1.00782503, "N": 14.0030740, "O": 15.9949146,
        "S": 31.9720707, "F": 18.9984032, "Cl": 34.9688527, "Br": 78.9183376}
RANGES = {"C": (1, 50), "N": (0, 10), "O": (0, 12), "S": (0, 2), "F": (0, 6), "Cl": (0, 3), "Br": (0, 2)}
ELEMENTS = list(RANGES)
RARE = ["S", "F", "Cl", "Br"]
TOLERANCE_PPM, TOLERANCE_DA = 5, 5e-4
SIGMA_PPM, RARE_WEIGHT = 0.3, 0.3
KENDRICK_CH2 = 14.01565

DIVISORS = {"A_odd_mass": 1, "A_mass_defect": 0.5, "A_kendrick_defect": 0.5,
            "B_dbe": 25, "B_h_per_c": 3, "B_log_candidates": 4}
DIVISORS |= {f"A_peak_defect_{level}": 0.5 for level in LEVELS}
DIVISORS |= {f"B_{element}": high for element, (low, high) in RANGES.items()}
DIVISORS |= {f"D_{level}_n_peaks": 200 for level in LEVELS} | {f"D_{level}_base_mz": 650 for level in LEVELS}


def _heavy_atom_table():
    """All counts of C, N, O, S, F, Cl, Br with usual ratios to carbon (Kind and Fiehn, 2007), sorted by mass."""
    grids = np.meshgrid(*[np.arange(low, high + 1, dtype=np.int16) for low, high in RANGES.values()], indexing="ij")
    count = {e: g.ravel() for e, g in zip(ELEMENTS, grids)}
    C = count["C"]
    keep = ((count["N"] <= 1.3 * C) & (count["O"] <= 1.2 * C) & (count["S"] <= 0.8 * C)
            & (count["F"] <= 1.5 * C) & (count["Cl"] <= 0.8 * C) & (count["Br"] <= 0.8 * C))
    count = {e: v[keep] for e, v in count.items()}
    heavy = sum(count[e] * MASS[e] for e in ELEMENTS)
    order = np.argsort(heavy, kind="stable")
    return {e: v[order].astype(float) for e, v in count.items()}, heavy[order]


_COUNTS, _HEAVY = _heavy_atom_table()


# ---- reading and cleaning (notebook 01) --------------------------------------------------
def parse_peaks(text):
    """Read 'm/z intensity' pairs, one per line (space, comma, tab or semicolon between)."""
    peaks = []
    for number, line in enumerate(text.strip().splitlines(), start=1):
        if not line.strip():
            continue
        parts = [p for p in re.split(r"[\s,;]+", line.strip()) if p]
        if len(parts) < 2:
            raise ValueError(f"Line {number} has one number; expected m/z and intensity.")
        try:
            peaks.append([float(parts[0]), float(parts[1])])
        except ValueError:
            raise ValueError(f"Line {number} is not numeric: '{line.strip()}'.")
    if not peaks:
        raise ValueError("No peaks found.")
    peaks = np.array(peaks)
    if (peaks[:, 0] <= 0).any() or (peaks[:, 1] < 0).any():
        raise ValueError("m/z must be positive and intensity must not be negative.")
    if peaks[:, 1].max() <= 0:
        raise ValueError("All intensities are zero.")
    return peaks


def clean_spectrum(spectrum):
    mz, intensity = spectrum.T
    intensity = intensity / intensity.max()
    keep = intensity >= 0.005
    mz, intensity = mz[keep], intensity[keep]
    top = np.sort(np.argsort(intensity)[-200:])
    return np.column_stack([mz[top], np.sqrt(intensity[top])])


def normalize_spectrum(spectrum):
    """Divide the intensities by their length, so every level has length 1; peaks sorted by m/z."""
    mz, intensity = spectrum.T
    order = np.argsort(mz, kind="stable")
    return np.column_stack([mz[order], intensity[order] / np.linalg.norm(intensity)])


def bin_values(values, intensity):
    vector = np.zeros(N_BINS)
    bins = values.astype(int)
    keep = bins < N_BINS
    np.maximum.at(vector, bins[keep], intensity[keep])
    return vector


# ---- group A: mass defect and nitrogen rule ----------------------------------------------
def group_a(precursor_mz, spectra):
    kendrick = precursor_mz * 14 / KENDRICK_CH2
    features = {
        "A_odd_mass": np.round(precursor_mz) % 2,
        "A_mass_defect": precursor_mz - np.round(precursor_mz),
        "A_kendrick_defect": np.round(kendrick) - kendrick,
    }
    for level, (mz, intensity) in spectra.items():
        defect = (mz - np.round(mz)) * intensity
        features[f"A_peak_defect_{level}"] = defect.sum() / intensity.sum()
    return features


# ---- group B: formula from the precursor mass --------------------------------------------
def formula_candidates(precursor_mz):
    """Candidate formulas within 5 ppm of the neutral mass (precursor minus a hydrogen atom), with weights."""
    mass = precursor_mz - MASS["H"]
    n = np.searchsorted(_HEAVY, mass)
    heavy = _HEAVY[:n]
    hydrogen = np.round((mass - heavy) / MASS["H"])
    error = mass - heavy - hydrogen * MASS["H"]
    close = np.abs(error) <= TOLERANCE_PPM * 1e-6 * mass + TOLERANCE_DA
    cand = {e: _COUNTS[e][:n][close] for e in ELEMENTS}
    cand["H"], error = hydrogen[close], error[close]
    dbe = cand["C"] - (cand["H"] + cand["F"] + cand["Cl"] + cand["Br"]) / 2 + cand["N"] / 2 + 1
    keep = (cand["H"] >= 0) & (cand["H"] <= 3.1 * cand["C"]) & (dbe >= 0) & (dbe % 1 == 0)
    cand = {name: v[keep] for name, v in cand.items()}
    cand["dbe"] = dbe[keep]
    ppm = error[keep] / mass * 1e6
    rare = sum((cand[e] > 0).astype(int) for e in RARE)
    cand["ppm"] = ppm
    cand["weight"] = np.exp(-0.5 * (ppm / SIGMA_PPM) ** 2) * RARE_WEIGHT ** rare
    return cand


def group_b(precursor_mz):
    cand = formula_candidates(precursor_mz)
    names = ELEMENTS + ["dbe", "h_per_c", "log_candidates"]
    total = cand["weight"].sum()
    if total == 0:  # no candidate (or weights underflow): zeros, as in notebook 02
        return {f"B_{name}": 0.0 for name in names}
    w = cand["weight"] / total
    features = {name: (cand[name] * w).sum() for name in ELEMENTS + ["dbe"]}
    features["h_per_c"] = (cand["H"] / cand["C"] * w).sum()
    features["log_candidates"] = np.log10(len(w) + 1)
    return {f"B_{name}": value for name, value in features.items()}


# ---- group C: neutral losses -------------------------------------------------------------
def group_c(precursor_mz, spectra):
    features = {}
    for level, (mz, intensity) in spectra.items():
        loss = precursor_mz - mz
        kept = loss >= 0
        vector = bin_values(loss[kept], intensity[kept])
        features |= {f"C_{level}_loss_{i}": v for i, v in enumerate(vector)}
    return features


# ---- group D: spectrum summaries ---------------------------------------------------------
def group_d(precursor_mz, spectra):
    features = {}
    for level, (mz, intensity) in spectra.items():
        features[f"D_{level}_n_peaks"] = len(mz)
        features[f"D_{level}_base_mz"] = mz[np.argmax(intensity)]
        features[f"D_{level}_upper_share"] = intensity[mz > precursor_mz / 2].sum() / intensity.sum()
        intact = intensity[np.abs(mz - precursor_mz) <= 0.02]
        features[f"D_{level}_precursor"] = intact.max() if len(intact) else 0.0
    return features


# ---- the vector --------------------------------------------------------------------------
def all_features(precursor_mz, spectra):
    """Every feature by name. spectra: {level: normalized peaks (m/z, intensity)}."""
    features = {}
    for level, (mz, intensity) in spectra.items():
        bins = bin_values(mz, intensity)
        features |= {f"{level}_{i}": v for i, v in enumerate(bins)}
    features["precursor_mz"] = precursor_mz / N_BINS
    extra = group_a(precursor_mz, spectra) | group_b(precursor_mz) | group_c(precursor_mz, spectra) | group_d(precursor_mz, spectra)
    features |= {name: value / DIVISORS.get(name, 1) for name, value in extra.items()}
    return features


def build_vector(precursor_mz, texts, feature_names):
    """texts: {'LOW': str, 'MID': str, 'HIGH': str}. Returns (vector in the order of feature_names, cleaned peaks per level).

    The cleaned peaks (base peak 1, before the length division) are what the page draws."""
    cleaned, spectra = {}, {}
    for level in LEVELS:
        try:
            raw = parse_peaks(texts[level])
        except ValueError as error:
            raise ValueError(f"{level}: {error}")
        cleaned[level] = clean_spectrum(raw)
        spectra[level] = normalize_spectrum(cleaned[level]).T
    features = all_features(precursor_mz, spectra)
    missing = [name for name in feature_names if name not in features]
    if missing or len(feature_names) != len(features):
        raise ValueError(f"The model expects {len(feature_names)} features; the app builds {len(features)} ({missing[:3]} missing).")
    return np.array([features[name] for name in feature_names], dtype=float), cleaned
