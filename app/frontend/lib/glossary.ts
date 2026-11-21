// Hover definitions for the terms used on the Science, Results and Classify pages.
export type GlossaryEntry = { term: string; definition: string; link: string };
export const GLOSSARY: GlossaryEntry[] = [
 {
  "term": "mass spectrometer",
  "definition": "An instrument that gives molecules a charge, sorts them by weight and counts them.",
  "link": "https://en.wikipedia.org/wiki/Mass_spectrometry"
 },
 {
  "term": "m/z",
  "definition": "Mass divided by charge. For an ion with one charge it is simply the ion's weight.",
  "link": "https://en.wikipedia.org/wiki/Mass-to-charge_ratio"
 },
 {
  "term": "spectrum",
  "definition": "A plot of how many ions arrive at each m/z. Each vertical line is a peak.",
  "link": "https://en.wikipedia.org/wiki/Mass_spectrum"
 },
 {
  "term": "peak",
  "definition": "A line in the spectrum: ions of one m/z. Its height is its intensity.",
  "link": "https://en.wikipedia.org/wiki/Mass_spectrum"
 },
 {
  "term": "precursor m/z",
  "definition": "The m/z of the whole molecule with one proton added. In this library it is the \"intact\" ion.",
  "link": "https://en.wikipedia.org/wiki/Molecular_ion"
 },
 {
  "term": "[M+H]⁺",
  "definition": "The molecule (M) plus one proton (H⁺). The usual ion in positive mode.",
  "link": "https://en.wikipedia.org/wiki/Protonation"
 },
 {
  "term": "DART",
  "definition": "A way to ionize a sample in open air with a stream of hot gas, with no preparation.",
  "link": "https://en.wikipedia.org/wiki/Direct_analysis_in_real_time"
 },
 {
  "term": "in-source fragmentation",
  "definition": "Breaking ions apart right after they form, by colliding them with gas. A harder push breaks more.",
  "link": "https://en.wikipedia.org/wiki/Fragmentation_(mass_spectrometry)"
 },
 {
  "term": "LOW, MID, HIGH",
  "definition": "The three fragmentation levels measured for every compound in this library.",
  "link": ""
 },
 {
  "term": "neutral loss",
  "definition": "The piece that breaks off a molecule without a charge. Its weight is the difference between two peaks.",
  "link": "https://en.wikipedia.org/wiki/Neutral_loss"
 },
 {
  "term": "mass defect",
  "definition": "How far a mass lies from the nearest whole number. Hydrogen raises it; oxygen, sulfur and halogens lower it.",
  "link": ""
 },
 {
  "term": "nitrogen rule",
  "definition": "A molecule with an even number of nitrogens has an even mass; with an odd number, an odd mass.",
  "link": "https://en.wikipedia.org/wiki/Nitrogen_rule"
 },
 {
  "term": "Kendrick defect",
  "definition": "The mass defect on a ruler where CH₂ weighs exactly 14, so compounds that differ by CH₂ groups share it.",
  "link": "https://en.wikipedia.org/wiki/Kendrick_mass"
 },
 {
  "term": "DBE",
  "definition": "Double bond equivalents: the number of rings plus double bonds in a molecule. Always a whole number.",
  "link": "https://en.wikipedia.org/wiki/Degree_of_unsaturation"
 },
 {
  "term": "ppm",
  "definition": "Parts per million. A mass error of 5 ppm on a mass of 300 is 0.0015.",
  "link": "https://en.wikipedia.org/wiki/Parts-per_notation"
 },
 {
  "term": "cosine similarity",
  "definition": "A number from 0 to 1 that tells whether two spectra have the same shape: 1 for the same peaks, 0 for none in common.",
  "link": "https://en.wikipedia.org/wiki/Cosine_similarity"
 },
 {
  "term": "structure elucidation",
  "definition": "Working out a molecule's structure from measurements of it.",
  "link": "https://en.wikipedia.org/wiki/Structure_elucidation"
 },
 {
  "term": "family",
  "definition": "A group of chemically similar compounds, such as the fentanyl type. The model predicts families first.",
  "link": ""
 },
 {
  "term": "class",
  "definition": "A group of drugs with a similar effect, such as opioid. Made by adding up families.",
  "link": "https://en.wikipedia.org/wiki/Drug_class"
 },
 {
  "term": "labeled / unlabeled",
  "definition": "A labeled compound has a family I checked by hand. An unlabeled compound has a spectrum but no label.",
  "link": "https://en.wikipedia.org/wiki/Semi-supervised_learning"
 },
 {
  "term": "semi-supervised",
  "definition": "Learning from both labeled and unlabeled examples.",
  "link": "https://en.wikipedia.org/wiki/Semi-supervised_learning"
 },
 {
  "term": "self-training",
  "definition": "A semi-supervised method: the model labels what it is sure of, then learns from those labels.",
  "link": "https://en.wikipedia.org/wiki/Semi-supervised_learning"
 },
 {
  "term": "holdout",
  "definition": "Compounds kept aside and tested once at the end, not used to train or choose the model.",
  "link": "https://en.wikipedia.org/wiki/Training,_validation,_and_test_data_sets"
 },
 {
  "term": "cross-validation",
  "definition": "Cutting the training data into parts and taking turns testing on each part.",
  "link": "https://en.wikipedia.org/wiki/Cross-validation_(statistics)"
 },
 {
  "term": "grouped split",
  "definition": "A split that keeps similar molecules on the same side, so a test compound has no close twin in training.",
  "link": ""
 },
 {
  "term": "fingerprint",
  "definition": "A string of 0s and 1s that records which small pieces appear in a molecule. Used to measure similarity.",
  "link": "https://en.wikipedia.org/wiki/Fingerprint_(computing)"
 },
 {
  "term": "Tanimoto similarity",
  "definition": "A score from 0 to 1 for how much two fingerprints share.",
  "link": "https://en.wikipedia.org/wiki/Tanimoto_coefficient"
 },
 {
  "term": "macro-F1",
  "definition": "The average of each class's F-score, counting every class equally. 1 is perfect.",
  "link": "https://en.wikipedia.org/wiki/F-score"
 },
 {
  "term": "precision / recall",
  "definition": "Precision: of those called X, how many are X. Recall: of all real X, how many were found.",
  "link": "https://en.wikipedia.org/wiki/Precision_and_recall"
 },
 {
  "term": "confusion matrix",
  "definition": "A table of true classes against predicted classes. The diagonal is correct answers.",
  "link": "https://en.wikipedia.org/wiki/Confusion_matrix"
 },
 {
  "term": "confidence",
  "definition": "The highest probability the model gives to a class.",
  "link": ""
 },
 {
  "term": "threshold",
  "definition": "The confidence below which the app says \"uncertain\". The final model uses 0.45, the lowest value at which at least 85% of the answered compounds are right in cross-validation while at least 60% are answered.",
  "link": ""
 },
 {
  "term": "bootstrap / 95% range",
  "definition": "Resampling the results many times to see how much a score could vary. The middle 95% is the range shown.",
  "link": "https://en.wikipedia.org/wiki/Bootstrapping_(statistics)"
 },
 {
  "term": "logistic regression",
  "definition": "A simple model that weights each number and combines them into probabilities.",
  "link": "https://en.wikipedia.org/wiki/Logistic_regression"
 },
 {
  "term": "random forest",
  "definition": "Many decision trees that vote.",
  "link": "https://en.wikipedia.org/wiki/Random_forest"
 },
 {
  "term": "support vector machine",
  "definition": "A model that finds the boundary that best separates the classes.",
  "link": "https://en.wikipedia.org/wiki/Support_vector_machine"
 },
 {
  "term": "k-nearest neighbours",
  "definition": "A model that looks at the k most similar training compounds and lets them vote.",
  "link": "https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm"
 },
 {
  "term": "PCA (the map)",
  "definition": "A way to squash the 1,950 spectrum numbers down to 2 so the compounds can be drawn on a plane. Similar spectra land close together.",
  "link": "https://en.wikipedia.org/wiki/Principal_component_analysis"
 },
 {
  "term": "NIST",
  "definition": "The US National Institute of Standards and Technology, which made the spectral library.",
  "link": "https://en.wikipedia.org/wiki/National_Institute_of_Standards_and_Technology"
 }
];
export const glossary = (term: string) => GLOSSARY.find((g) => g.term.toLowerCase() === term.toLowerCase());
