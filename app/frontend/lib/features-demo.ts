import type { Peaks } from "./api";

// The cleaning of notebook 01 and the small calculations of notebook 02, redone in the browser for the figures of the Science page.
// The numbers the model receives always come from the backend (`/features/{key}`); these functions only draw the steps.

export const N_BINS = 650;
export const MAX_PEAKS = 200;
export const NOISE = 0.005;

export type Cleaning = {
  mz: number[];
  raw: number[]; rawMax: number;
  scaled: number[];
  aboveNoise: boolean[];
  kept: boolean[];                 // above the noise and among the 200 strongest
  root: number[];
  length: number;                  // length of the square-rooted kept peaks, before the division
  unit: number[];                  // final intensities (length 1 over the kept peaks)
  bins: number[];                  // 650 numbers
};

export function cleaning(rawPeaks: Peaks): Cleaning {
  const mz = rawPeaks.map((p) => p[0]);
  const raw = rawPeaks.map((p) => p[1]);
  const rawMax = Math.max(...raw);
  const scaled = raw.map((v) => v / rawMax);
  const aboveNoise = scaled.map((v) => v >= NOISE);
  const order = scaled.map((_, i) => i).filter((i) => aboveNoise[i]).sort((a, b) => scaled[b] - scaled[a]);
  const top = new Set(order.slice(0, MAX_PEAKS));
  const kept = scaled.map((_, i) => top.has(i));
  const root = scaled.map(Math.sqrt);
  const length = Math.sqrt(root.reduce((s, v, i) => s + (kept[i] ? v * v : 0), 0));
  const unit = root.map((v) => v / length);
  const bins = new Array(N_BINS).fill(0);
  unit.forEach((v, i) => { const b = Math.floor(mz[i]); if (kept[i] && b < N_BINS) bins[b] = Math.max(bins[b], v); });
  return { mz, raw, rawMax, scaled, aboveNoise, kept, root, length, unit, bins };
}

/** What each step of the stepper draws: a height for every raw peak (0 to 1), which peaks are still there, and the unit of the axis. */
export const STEPS = [
  { key: "raw", title: "The raw spectrum", axis: "intensity (counts)" },
  { key: "scale", title: "Scale to the strongest peak", axis: "share of the strongest peak" },
  { key: "noise", title: "Drop peaks below 0.5%", axis: "share of the strongest peak" },
  { key: "top", title: "Keep the 200 strongest", axis: "share of the strongest peak" },
  { key: "root", title: "Take the square root", axis: "square root of the share" },
  { key: "length", title: "Divide by the length", axis: "intensity, length 1" },
  { key: "bins", title: "Bin to whole m/z units", axis: "intensity, length 1" },
] as const;

export function stepView(c: Cleaning, step: number) {
  const n = c.mz.length;
  const alive = Array.from({ length: n }, (_, i) => step < 2 || (step === 2 ? c.aboveNoise[i] : c.kept[i]));
  const values = step === 0 ? c.raw.map((v) => v / c.rawMax) : step < 4 ? c.scaled : step === 4 ? c.root : c.unit;
  return { alive, values, bins: step === 6 };
}

export const cosine = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

export function binValues(values: number[], intensity: number[], limit = N_BINS) {
  const out = new Array(limit).fill(0);
  values.forEach((v, i) => { const b = Math.floor(v); if (b >= 0 && b < limit) out[b] = Math.max(out[b], intensity[i]); });
  return out;
}

/** m/z minus the nearest whole number (notebook 02, group A). */
export const massDefect = (mz: number) => mz - Math.round(mz);

/** Feature names of the groups with a fixed list of names; the others follow a pattern (bins, losses). */
export const A_NAMES = ["odd mass", "mass defect", "Kendrick defect", "fragment defect, LOW", "fragment defect, MID", "fragment defect, HIGH"];
export const A_DIVISORS = [1, 0.5, 0.5, 0.5, 0.5, 0.5];
export const B_NAMES = ["C", "N", "O", "S", "F", "Cl", "Br", "double bonds and rings", "H per C", "log of the number of candidates"];
export const D_FEATURES = ["number of peaks", "m/z of the strongest peak", "share of intensity above half the precursor", "intensity of the intact ion"];
export const D_DIVISORS = [200, 650, 1, 1];

export function featureName(prefix: string, offset: number) {
  if (prefix.endsWith("_") && /^(LOW|MID|HIGH)_$/.test(prefix)) return `${prefix.slice(0, -1)} spectrum, m/z ${offset}`;
  if (prefix === "precursor_mz") return "precursor m/z";
  if (prefix === "A_") return A_NAMES[offset];
  if (prefix === "B_") return B_NAMES[offset];
  if (prefix.startsWith("C_")) return `${prefix.slice(2, -1)} neutral loss of ${offset}`;
  if (prefix === "D_") return `${["LOW", "MID", "HIGH"][Math.floor(offset / 4)]}: ${D_FEATURES[offset % 4]}`;
  return `${prefix}${offset}`;
}
