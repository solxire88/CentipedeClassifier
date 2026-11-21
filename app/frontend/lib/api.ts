export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const CLASSES = ["stimulant", "depressant", "opioid", "cannabinoid", "psychedelic", "dissociative", "other"] as const;
export type ClassName = (typeof CLASSES)[number];
export type Tag = "held_out" | "training" | "unlabeled";
export const LEVELS = ["LOW", "MID", "HIGH"] as const;
export type Level = (typeof LEVELS)[number];
export type Peaks = [number, number][];

export type LibraryItem = {
  inchikey: string; name: string; formula: string; precursor_mz: number;
  family: string | null; class: ClassName | null; tag: Tag; x: number; y: number; spark: [number, number][];
};
export type Neighbour = LibraryItem & { similarity: number };
export type ModelCard = {
  id: string; method: string; setting: string; target: string; recommended: boolean;
  cv_drug_f1: number | null; cv_spread: number | null; cv_other_recall: number | null; cv_family_f1: number | null;
  holdout: null | Record<string, number>; threshold: number; provisional: boolean;
};
export type Prediction = {
  model: string; target: string; class: ClassName; family: string; confidence: number; uncertain: boolean;
  threshold: number; provisional: boolean;
  class_probabilities: Record<string, number>;
  top_families: { family: string; class: ClassName; probability: number }[];
  input_spectra: Record<Level, Peaks>;
  neighbours: Neighbour[]; excluded_self: boolean; truth?: LibraryItem; map: [number, number];
};
export type Compound = LibraryItem & {
  exact_mass: number; mw: number; synonyms: string[]; smiles: string; molblock: string | null; svg2d: string | null;
  spectra: Record<Level, { raw: Peaks; clean: Peaks }>;
  neighbours: Neighbour[]; structure_neighbours: Neighbour[];
  predictions: Record<string, { class: ClassName; family: string; confidence: number; uncertain: boolean }>;
};

export async function get<T>(path: string): Promise<T> {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
}

export const peaksToText = (peaks: Peaks) => peaks.map(([a, b]) => `${a} ${b}`).join("\n");
