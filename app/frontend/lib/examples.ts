// Picked from the held-out compounds of the final model (self-training, notebook 06, 2026-11-21) by rule:
// the correct answer with the highest confidence, the wrong answer with the highest confidence, and the
// uncertain answer closest to the 0.45 threshold. The notes come from `reports/tables/holdout_predictions.csv`.
// They go stale when the model changes: pick them again after rerunning notebook 06.
export const EXAMPLES = [
  { key: "DVCBBZBNZSSXMS-UHFFFAOYSA-N", name: "5-Aminoisotonitazene", tag: "easy win", note: "True opioid, answered opioid with confidence 0.996" },
  { key: "NQTRBZXDWMDXAQ-UHFFFAOYSA-N", name: "Cinazepam", tag: "confident mistake", note: "True depressant, answered cannabinoid with confidence 0.89" },
  { key: "QCHFTSOMWOSFHM-UHFFFAOYSA-N", name: "Pilocarpine", tag: "uncertain", note: "Confidence 0.44, just below the 0.45 threshold (true other, would have answered other)" },
];
