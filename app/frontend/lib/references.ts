import type { ClassName } from "./api";

export type Reference = { title: string; publisher: string; kind: string; year: string; url: string };
export type ReferenceGroup = { key: ClassName | "general"; families: string; documents: Reference[] };

/** The official manuals and reports behind each class, in the order of the classes on the Results page. */
export const REFERENCES: ReferenceGroup[] = [
  { key: "stimulant", families: "amphetamine-type, cathinone, pyrrolidinophenone, stimulant-other", documents: [
    { title: "Synthetic cathinones in seized materials", publisher: "UNODC", kind: "Manual", year: "2015", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-the-identification-and-analysis-of-synthetic-cathinones-in-seized-materials.html" },
    { title: "Amphetamine, methamphetamine and ring-substituted analogues", publisher: "UNODC", kind: "Manual", year: "2006", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-the-identification-and-analysis-of-amphetamine--methamphetamine-and-their-ring-substituted-analogues-in-seized-materials.html" },
  ] },
  { key: "depressant", families: "benzodiazepine, depressant-other", documents: [
    { title: "Barbiturates and benzodiazepines under international control", publisher: "UNODC", kind: "Manual", year: "–", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-the-identification-and-analysis-of-barbiturates-and-benzodiazepines-under-international-control.html" },
    { title: "Barbiturates and benzodiazepines in biological specimens", publisher: "UNODC", kind: "Manual", year: "1997", url: "https://unodc.org/unodc/en/scientists/recommended-methods-for-the-detection-and-assay-of-barbiturates-and-benzodiazepines-in-biological-specimens.html" },
  ] },
  { key: "opioid", families: "fentanyl-type, nitazene, morphinan, opioid-other", documents: [
    { title: "Fentanyl and its analogues in biological specimens", publisher: "UNODC", kind: "Manual", year: "2017", url: "https://unodc.org/unodc/en/scientists/recommended-methods-for-the-identification-and-analysis-of-fentanyl-and-its-analogues-in-biological-specimens.html" },
    { title: "Opium, morphine and heroin", publisher: "UNODC", kind: "Manual", year: "1998", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-testing-opium--morphine-and-heroin.html" },
    { title: "Isotonitazene, a nitazene", publisher: "WHO", kind: "Critical review", year: "2020", url: "https://cdn.who.int/media/docs/default-source/controlled-substances/43rd-ecdd/isonitazene-43rd-final-complete-a.pdf" },
    { title: "N-pyrrolidino isotonitazene, a nitazene", publisher: "WHO", kind: "Critical review", year: "2025", url: "https://www.who.int/groups/ecdd/48th-expert-committee-on-drug-dependence-documents" },
  ] },
  { key: "cannabinoid", families: "indole-ketone-SC, carboxamide-ester-SC, cannabinoid-other", documents: [
    { title: "Synthetic cannabinoid receptor agonists in seized materials", publisher: "UNODC", kind: "Manual", year: "–", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-the-identification-and-analysis-of-synthetic-cannabinoid-receptor-agonists-in-seized-materials.html" },
  ] },
  { key: "psychedelic", families: "tryptamine, phenethylamine-psychedelic, psychedelic-other", documents: [
    { title: "Testing for LSD", publisher: "UNODC", kind: "Manual", year: "1989", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-testing-lysergide-lsd.html" },
    { title: "Peyote, mescaline, Psilocybe mushrooms and psilocybin", publisher: "UNODC", kind: "Manual", year: "–", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-testing-peyote-cactus-mescal-buttons-mescaline-and-psilocybe-mushrooms-psilocybin.html" },
    { title: "LSD, PCP, psilocybin and methaqualone in biological specimens", publisher: "UNODC", kind: "Manual", year: "1999", url: "https://www.unodc.org/unodc/en/scientists/recommended-methods-for-the-detection-and-assay-of-lysergide-lsd--phencyclidine-pcp--psilocybin-and-methaqualone-in-biological-specimens.html" },
    { title: "Lysergic acid diethylamide (LSD)", publisher: "SWGDRUG", kind: "Monograph", year: "1999", url: "https://www.swgdrug.org/Monographs/LYSERGIC%20ACID%20DIETHYLAMIDE.pdf" },
  ] },
  { key: "dissociative", families: "arylcyclohexylamine", documents: [
    { title: "Ketamine (36th Expert Committee report)", publisher: "WHO", kind: "Critical review", year: "2014", url: "https://iris.who.int/server/api/core/bitstreams/0dc35e54-36fd-4b9f-9632-a1cefbc4e085/content" },
    { title: "3-Methoxyphencyclidine (3-MeO-PCP)", publisher: "WHO", kind: "Critical review", year: "2020", url: "https://cdn.who.int/media/docs/default-source/controlled-substances/43rd-ecdd/3-meo-pcp-finalreport-a.pdf?sfvrsn=8c513cd7_2" },
    { title: "2-Fluorodeschloroketamine", publisher: "WHO", kind: "Critical review", year: "2023", url: "https://cdn.who.int/media/docs/default-source/46th-ecdd/2-fdck_46th-ecdd-critical-review_public-version.pdf?sfvrsn=5c6e5f45_1" },
  ] },
  { key: "other", families: "steroid, other-medicine", documents: [
    { title: "Testosterone and esters", publisher: "SWGDRUG", kind: "Monograph", year: "2005", url: "https://www.swgdrug.org/Monographs/TESTOSTERONE_AND_ESTERS.pdf" },
    { title: "Prohibited List (anabolic agents)", publisher: "WADA", kind: "List", year: "2026", url: "https://www.wada-ama.org/en/resources/world-anti-doping-code-and-international-standards/prohibited-list" },
  ] },
  { key: "general", families: "every class", documents: [
    { title: "Current NPS threats, volume VII", publisher: "UNODC", kind: "Report", year: "2024", url: "https://unodc.org/documents/scientific/Current_NPS_threats_VII.pdf" },
    { title: "25 years of early warning and response in Europe", publisher: "EMCDDA", kind: "Report", year: "2022", url: "https://www.euda.europa.eu/system/files/publications/14637/20222218_PDF_TD0522113ENN_002.pdf" },
    { title: "European Drug Report 2024: new psychoactive substances", publisher: "EUDA", kind: "Report", year: "2024", url: "https://www.euda.europa.eu/publications/european-drug-report/2024/new-psychoactive-substances_en" },
  ] },
];
