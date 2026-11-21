"use client";
import { useEffect, useMemo, useState } from "react";
import { WarmUp, useBackend } from "@/components/backend";
import { ClassGlyph } from "@/components/marks";
import { ChartFrame, Skeleton } from "@/components/ui";
import { ScoreRuler, Sankey, StatCounter, Term } from "@/components/longform";
import { ScrollProgress, TableOfContents } from "@/components/toc";
import { useWidth } from "@/components/spectrum";
import { modelName } from "@/components/classify/model-cards";
import { ConfusionMatrix, HoldoutPrediction, PerClassRow, RecallCompare, RejectionRow, ThresholdLines, ThresholdRow, UnseenBars } from "@/components/results-charts";
import { ClassName, LibraryItem, get } from "@/lib/api";

type Method = { method: string; setting: string; target: string; drug_f1: number; spread: number; other_recall: number; family_f1: number };
type Fraction = { method: string; fraction: number; drug_f1: number; spread: number };
type PerClass = Record<string, string | number>;

const ORDER = ["self-training", "co-training", "label-spreading", "cluster-then-label"];
const NAMES: Record<string, string> = { "self-training": "Self-training", "co-training": "Co-training", "label-spreading": "Label spreading", "cluster-then-label": "Cluster then label" };
const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmt = (n: number) => n.toLocaleString("en-US");
const SERIES = [
  { stroke: "var(--text)", dash: undefined },
  { stroke: "var(--text)", dash: "6 4" },
  { stroke: "var(--text-muted)", dash: undefined },
  { stroke: "var(--text-muted)", dash: "2 4" },
];

const TOC = [
  { id: "r0", num: "R0", label: "Summary" }, { id: "r1", num: "R1", label: "The data" }, { id: "r2", num: "R2", label: "Fair testing" },
  { id: "r3", num: "R3", label: "Four methods" }, { id: "r4", num: "R4", label: "Family to class" }, { id: "r5", num: "R5", label: "Fewer labels" },
  { id: "r6", num: "R6", label: "Per class" }, { id: "r7", num: "R7", label: "Threshold" }, { id: "r8", num: "R8", label: "Unseen classes" },
  { id: "r9", num: "R9", label: "Holdout" }, { id: "r10", num: "R10", label: "Mistakes" }, { id: "r11", num: "R11", label: "Verdict" },
];

function Table({ rows, cols }: { rows: Record<string, unknown>[]; cols: [string, string, ((v: unknown) => string)?][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ms-table">
        <thead><tr>{cols.map(([k, label]) => <th key={k} className={typeof rows[0]?.[k] === "number" ? "num" : undefined}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([k, , f]) => <td key={k} className={typeof r[k] === "number" ? "num" : undefined}>{f ? f(r[k]) : String(r[k] ?? "")}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Neutral horizontal bars (methods are not classes, so no class colour), value and spread on the right. */
function MethodBars({ rows }: { rows: { label: string; value: number; spread: number; strong?: boolean }[] }) {
  return (
    <ul className="ms-bars">
      {rows.map((r, i) => (
        <li key={r.label} className={`ms-bar${r.strong ? " is-top" : ""}`} tabIndex={0} title={`${r.label}: ${r.value.toFixed(3)} ± ${r.spread.toFixed(3)}`}
          style={{ ["--c" as string]: r.strong ? "var(--text)" : "var(--text-muted)", gridTemplateColumns: "minmax(120px, 190px) 1fr 92px" }}>
          <span className="ms-bar__name">{r.label}</span>
          <span className="ms-bar__track">
            <i className="ms-bar__fill" style={{ ["--p" as string]: r.value, animation: `ms-grow var(--dur-reveal) var(--ease-standard) ${i * 40}ms both` }} />
            <i style={{ position: "absolute", top: -3, bottom: -3, left: `${(r.value - r.spread) * 100}%`, width: `${Math.max(r.spread * 200, 0.3)}%`, borderLeft: "1px solid var(--text)", borderRight: "1px solid var(--text)" }} aria-hidden />
          </span>
          <span className="ms-bar__val">{f2(r.value)} <span className="ms-muted">± {f2(r.spread)}</span></span>
        </li>
      ))}
    </ul>
  );
}

/** Two bars per method: families added up (solid) and the single top family (hatched). */
function TargetBars({ rows }: { rows: { label: string; sum: number; top: number }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ul className="ms-legend" aria-label="Legend">
        <li><i className="ms-fam" data-variant="1" style={{ ["--c" as string]: "var(--text)" }} />families added up (sum)</li>
        <li><i className="ms-fam" data-variant="3" style={{ ["--c" as string]: "var(--text)" }} />single top family (top)</li>
      </ul>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</span>
          {([["sum", r.sum, 1], ["top", r.top, 3]] as const).map(([k, v, variant]) => (
            <div key={k} className="ms-bar" style={{ ["--c" as string]: "var(--text)", gridTemplateColumns: "40px 1fr 44px" }} title={`${r.label}, ${k}: ${v.toFixed(3)}`}>
              <span className="ms-mono ms-muted">{k}</span>
              <span className="ms-bar__track"><i className="ms-bar__fill" data-variant={variant} style={{ ["--p" as string]: v }} /></span>
              <span className="ms-bar__val">{f2(v)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Score against the share of labels, one line per method, the spread as a soft band, direct labels at the end. */
function FractionLines({ rows }: { rows: Fraction[] }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width || 700, 320), H = 280, L = 40, R = Math.min(150, W * 0.32), T = 16, B = 36;
  const xs = [0.1, 0.2, 0.5, 1];
  const x = (f: number) => L + (xs.indexOf(f) / (xs.length - 1)) * (W - L - R);
  const y = (v: number) => H - B - v * (H - B - T);
  const ends = ORDER.map((m, k) => ({ m, k, y: y(rows.find((r) => r.method === m && r.fraction === 1)?.drug_f1 ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 15);
  return (
    <div ref={box} className="ms-chart">
      <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label="Macro-F1 against the share of training labels used, one line per method" style={{ display: "block", width: "100%" }}>
        {[0, 0.2, 0.4, 0.6, 0.8].map((t) => <g key={t}><line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text className="lbl" x={L - 8} y={y(t) + 4} textAnchor="end">{t.toFixed(1)}</text></g>)}
        <line className="axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
        {xs.map((f) => <text key={f} className="lbl" x={x(f)} y={H - B + 18} textAnchor="middle">{f * 100}%</text>)}
        <text className="lbl lbl--sans" x={L} y={10}>macro-F1, six drug classes</text>
        {ORDER.map((m, k) => {
          const pts = xs.map((f) => rows.find((r) => r.method === m && r.fraction === f)).filter(Boolean) as Fraction[];
          const band = [...pts.map((p) => `${x(p.fraction)},${y(p.drug_f1 + p.spread)}`), ...[...pts].reverse().map((p) => `${x(p.fraction)},${y(p.drug_f1 - p.spread)}`)].join(" ");
          return (
            <g key={m}>
              <polygon points={band} fill={SERIES[k].stroke} opacity={0.08} />
              <polyline fill="none" stroke={SERIES[k].stroke} strokeWidth={2} strokeDasharray={SERIES[k].dash} points={pts.map((p) => `${x(p.fraction)},${y(p.drug_f1)}`).join(" ")} />
              {pts.map((p) => <circle key={p.fraction} cx={x(p.fraction)} cy={y(p.drug_f1)} r={3} fill={SERIES[k].stroke}><title>{`${NAMES[m]}, ${p.fraction * 100}% of labels: ${p.drug_f1.toFixed(3)} ± ${p.spread.toFixed(3)}`}</title></circle>)}
            </g>
          );
        })}
        {ends.map((e) => <text key={e.m} className="lbl lbl--sans lbl--strong" x={W - R + 10} y={e.y + 4}>{NAMES[e.m]}</text>)}
      </svg>
    </div>
  );
}

function ClassF1({ perClass, method }: { perClass: PerClass[]; method: string }) {
  const rows = perClass.map((r) => ({ c: r.class as ClassName, v: Number(r[method]) })).sort((a, b) => b.v - a.v);
  return (
    <ul className="ms-bars">
      {rows.map((r, i) => (
        <li key={r.c} className="ms-bar" data-class={r.c} tabIndex={0} title={`${r.c}: ${r.v.toFixed(3)}`}>
          <span className="ms-bar__name"><ClassGlyph name={r.c} />{r.c}</span>
          <span className="ms-bar__track"><i className="ms-bar__fill" style={{ ["--p" as string]: r.v, animation: `ms-grow var(--dur-reveal) var(--ease-standard) ${i * 40}ms both` }} /></span>
          <span className="ms-bar__val">{f2(r.v)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Results() {
  const { state } = useBackend();
  const [methods, setMethods] = useState<Method[] | null>(null);
  const [perClass, setPerClass] = useState<PerClass[]>([]);
  const [fractions, setFractions] = useState<Fraction[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdRow[]>([]);
  const [unseen, setUnseen] = useState<(RejectionRow & { normal_uncertain_share: number })[]>([]);
  const [holdoutRes, setHoldoutRes] = useState<Record<string, number>[]>([]);
  const [holdoutClass, setHoldoutClass] = useState<PerClassRow[]>([]);
  const [preds, setPreds] = useState<HoldoutPrediction[]>([]);

  useEffect(() => {
    if (state !== "ready") return;
    get<Method[]>("/results/cv_methods").then(setMethods).catch(() => {});
    get<PerClass[]>("/results/cv_per_class").then(setPerClass).catch(() => {});
    get<Fraction[]>("/results/label_fractions").then(setFractions).catch(() => {});
    get<LibraryItem[]>("/library").then(setLibrary).catch(() => {});
    get<ThresholdRow[]>("/results/threshold_table").then(setThresholds).catch(() => {});
    get<(RejectionRow & { normal_uncertain_share: number })[]>("/results/rejection_test").then(setUnseen).catch(() => {});
    get<Record<string, number>[]>("/results/holdout_results").then(setHoldoutRes).catch(() => {});
    get<PerClassRow[]>("/results/holdout_per_class").then(setHoldoutClass).catch(() => {});
    get<HoldoutPrediction[]>("/results/holdout_predictions").then(setPreds).catch(() => {});
  }, [state]);

  const d = useMemo(() => {
    if (!methods || !library.length || !perClass.length || !fractions.length || !thresholds.length || !unseen.length || !holdoutRes.length || !holdoutClass.length || !preds.length) return null;
    const best = ORDER.map((m) => methods.filter((r) => r.method === m).sort((a, b) => b.drug_f1 - a.drug_f1)[0]).filter(Boolean);
    const top = best[0];
    const tags = { held_out: 0, training: 0, unlabeled: 0 } as Record<string, number>;
    const fam: Record<string, { family: string; class: ClassName; count: number }> = {};
    for (const c of library) {
      tags[c.tag]++;
      if (c.family && c.class) fam[c.family] = { family: c.family, class: c.class, count: (fam[c.family]?.count ?? 0) + 1 };
    }
    const settings = new Set(methods.map((m) => `${m.method}|${m.setting}`)).size;
    const targets = best.map((b) => ({ label: NAMES[b.method], sum: methods.find((m) => m.method === b.method && m.setting === b.setting && m.target === "sum")?.drug_f1 ?? 0, top: methods.find((m) => m.method === b.method && m.setting === b.setting && m.target === "top")?.drug_f1 ?? 0 }));
    const maxGap = Math.max(...targets.map((t) => Math.abs(t.sum - t.top)));
    const tf = (m: string, f: number) => fractions.find((r) => r.method === m && r.fraction === f)?.drug_f1 ?? 0;
    const classRows = perClass.map((r) => ({ c: r.class as string, v: Number(r[top.method]) })).sort((a, b) => b.v - a.v);
    const drugRows = classRows.filter((r) => r.c !== "other");
    const h = holdoutRes[0];
    const wrong = preds.filter((p) => p.class !== p.predicted_class).sort((a, b) => b.confidence - a.confidence);
    const pairCount: Record<string, number> = {};
    for (const w of wrong) pairCount[`${w.class} → ${w.predicted_class}`] = (pairCount[`${w.class} → ${w.predicted_class}`] ?? 0) + 1;
    const pairs = Object.entries(pairCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const drop = [...holdoutClass].sort((a, b) => (b.cv_recall - b.recall) - (a.cv_recall - a.recall))[0];
    const otherHold = holdoutClass.find((c) => c.class === "other")!;
    const normal = unseen[0].normal_uncertain_share;
    const unseenMean = unseen.reduce((sum, r) => sum + r.uncertain_share, 0) / unseen.length;
    return {
      h, wrong, pairs, drop, otherHold, normal, unseenMean, threshold: h.threshold,
      best, top, tags, families: Object.values(fam), labeled: tags.held_out + tags.training, settings, targets, maxGap,
      f10: tf(top.method, 0.1), f50: tf(top.method, 0.5), f100: tf(top.method, 1), strong: drugRows.slice(0, 2), weak: drugRows.slice(-2),
      otherF1: classRows.find((r) => r.c === "other")?.v ?? 0,
    };
  }, [methods, library, perClass, fractions, thresholds, unseen, holdoutRes, holdoutClass, preds]);

  return (
    <>
      <ScrollProgress />
      <div className="wrap page">
        <header className="hero" id="r0" style={{ scrollMarginTop: 80 }}>
          <div className="ms-label">Results · R0</div>
          <h1 className="hero__title">What worked, and how well</h1>
          {d ? (
                <p className="hero__sub">Four semi-supervised methods learned from the {fmt(d.tags.training)} labeled training compounds together with the {fmt(d.tags.unlabeled)} unlabeled ones, and were compared by grouped <Term k="cross-validation" />. Every number on this page comes from files the project produced.</p>
              ) : <p className="hero__sub">How the four semi-supervised methods compare, measured honestly.</p>}
          <div className="ms-frame hero__frame">
            <div className="ms-frame__head"><div><div className="ms-label">The final model on {d ? fmt(d.h.holdout_compounds) : "the"} compounds it never saw</div></div></div>
            <div className="ms-frame__body">{d ? <ScoreRuler score={d.h.drug_f1} lo={d.h.drug_f1_low} hi={d.h.drug_f1_high} label="Holdout macro-F1" refs={[{ value: d.top.drug_f1, label: "Cross-validation" }]} /> : <Skeleton h={132} />}</div>
          </div>
        </header>
        <div className="results">
          <aside className="results__toc"><TableOfContents items={TOC} /></aside>
          <div className="results__body">

            {state !== "ready" ? <WarmUp /> : !d ? <Skeleton h={600} /> : (
              <>
                <section className="rsection" style={{ marginTop: 0 }}>
                  <div className="prose">
                    <ul className="ms-list">
                      <li>The best method, <b>{modelName(d.top)}</b>, reaches a <Term k="macro-F1" /> of <b>{f2(d.top.drug_f1)}</b> over the six drug classes (spread ± {f2(d.top.spread)} across three repeats).</li>
                      <li>It recognises <b>{pct(d.top.other_recall)}</b> of the &ldquo;other&rdquo; compounds (steroids and ordinary medicines) as other; the rest are called a drug class.</li>
                      <li>Scores keep rising with more labels: <b>{f2(d.f10)}</b> with 10% of the training labels, <b>{f2(d.f100)}</b> with all of them.</li>
                      <li>On the {fmt(d.h.holdout_compounds)} <Term k="holdout">held-out</Term> compounds, scored once, the final model reaches <b>{f2(d.h.drug_f1)}</b> (<Term k="bootstrap / 95% range">95% range</Term> {f2(d.h.drug_f1_low)} to {f2(d.h.drug_f1_high)}). The range is wide because the test is small.</li>
                      <li>The app answers &ldquo;uncertain&rdquo; below a confidence of <b>{f2(d.threshold)}</b>. That holds back {pct(d.h.uncertain_share)} of the held-out compounds, and the answered ones are right {pct(d.h.accuracy_answered)} of the time.</li>
                    </ul>
                  </div>
                  <div className="scorecards">
                    <StatCounter value={d.top.drug_f1} what="macro-F1" ctx={`six drug classes · ± ${f2(d.top.spread)}`} />
                    <StatCounter value={d.top.family_f1} what="family macro-F1" ctx={`${d.families.length} families`} />
                    <StatCounter value={Math.round(d.top.other_recall * 100)} decimals={0} suffix="%" what={'"other" recall'} ctx="other compounds kept out of the drug classes" />
                    <StatCounter value={d.h.drug_f1} what="holdout macro-F1" ctx={`${fmt(d.h.holdout_compounds)} compounds · range ${f2(d.h.drug_f1_low)}–${f2(d.h.drug_f1_high)}`} />
                  </div>
                  <ChartFrame label="R0 · the scoreboard" title="Where the best score sits" finding={`${NAMES[d.top.method]} is ahead of the other methods by more than its spread.`}
                    source="reports/tables/cv_methods.csv" table={<Table rows={d.best as unknown as Record<string, unknown>[]} cols={[["method", "Method"], ["setting", "Setting"], ["drug_f1", "macro-F1", (v) => f2(v as number)], ["spread", "Spread", (v) => f2(v as number)]]} />}>
                    <ScoreRuler score={d.top.drug_f1} lo={d.top.drug_f1 - d.top.spread} hi={d.top.drug_f1 + d.top.spread} label={NAMES[d.top.method]}
                      refs={d.best.slice(1).map((b) => ({ value: b.drug_f1, label: NAMES[b.method] }))} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r1">
                  <div className="ms-label">R1</div>
                  <h2>What the model learned from</h2>
                  <div className="prose">
                    <p>The library has {fmt(library.length)} compounds. {fmt(d.labeled)} of them were labeled by hand with a chemical <Term k="family" /> ({d.families.length} families, grouped into 7 <Term k="class">classes</Term>); the other {fmt(d.tags.unlabeled)} have a spectrum but no label.</p>
                    <p>{fmt(d.tags.held_out)} labeled compounds were set aside as the <Term k="holdout" />, not used to train or choose the model. The remaining {fmt(d.tags.training)} are used for training and for every comparison on this page.</p>
                  </div>
                  <ChartFrame label="R1 · families into classes" title={`${d.families.length} families → 7 classes`} finding="Each band is drawn in its class colour; its width is the number of labeled compounds. Families named “-other” are drawn lighter."
                    source="data/labels/labels.csv · family_to_class.csv" table={<Table rows={[...d.families].sort((a, b) => b.count - a.count) as unknown as Record<string, unknown>[]} cols={[["family", "Family"], ["class", "Class"], ["count", "Labeled"]]} />}>
                    <Sankey families={d.families} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r2">
                  <div className="ms-label">R2</div>
                  <h2>Why a random test would be misleading</h2>
                  <div className="prose">
                    <p>Many compounds in the library are close relatives. If a random split put one relative in training and its twin in the test, the model would simply recognise the twin: that measures memory, not understanding.</p>
                    <p>So the compounds were put into groups of similar structures, measured with a <Term k="fingerprint" /> and <Term k="Tanimoto similarity" />, and every group went to one side only. This <Term k="grouped split" /> is used for the holdout and for the 5 folds of cross-validation, repeated 3 times.</p>
                  </div>
                </section>

                <section className="rsection" id="r3">
                  <div className="ms-label">R3</div>
                  <h2>Four methods, {d.settings} settings</h2>
                  <div className="prose">
                    <p>All four methods use the unlabeled compounds while they learn. <Term k="self-training">Self-training</Term> adds the compounds it is sure about to its own training data. Co-training does the same with two models that each see a different part of the spectrum. Label spreading passes labels to neighbouring spectra. Cluster-then-label groups all spectra and gives each group the family of its labeled members.</p>
                    <p>{NAMES[d.best[0].method]} scores {f2(d.best[0].drug_f1)}; the methods that depend on distances between whole spectra (label spreading {f2(d.best.find((b) => b.method === "label-spreading")?.drug_f1 ?? 0)}, cluster-then-label {f2(d.best.find((b) => b.method === "cluster-then-label")?.drug_f1 ?? 0)}) lose most of their accuracy.</p>
                  </div>
                  <ChartFrame label="R3 · best setting of each method" title="macro-F1 over the six drug classes" finding={`${modelName(d.top)} is ahead; the whiskers show the spread over three repeats.`}
                    source="reports/tables/cv_methods.csv" table={<Table rows={[...methods!].sort((a, b) => b.drug_f1 - a.drug_f1) as unknown as Record<string, unknown>[]} cols={[["method", "Method"], ["setting", "Setting"], ["target", "Target"], ["drug_f1", "macro-F1", (v) => f2(v as number)], ["spread", "Spread", (v) => f2(v as number)], ["other_recall", "Other recall", (v) => f2(v as number)], ["family_f1", "Family F1", (v) => f2(v as number)]]} />}>
                    <MethodBars rows={d.best.map((b, i) => ({ label: modelName(b), value: b.drug_f1, spread: b.spread, strong: i === 0 }))} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r4">
                  <div className="ms-label">R4</div>
                  <h2>Two ways to reach a class</h2>
                  <div className="prose">
                    <p>Every method predicts a family. The class can then come from adding up the probabilities of the families in each class, or from the class of the single most likely family. The two can disagree when a class is spread over several families.</p>
                    <p>Here they differ by at most {f2(d.maxGap)}, which is about the size of the spread, so neither way is clearly better. The app adds the families up for the methods where that scored higher.</p>
                  </div>
                  <ChartFrame label="R4 · sum against top" title="macro-F1 by way of reaching the class" finding={`The two ways differ by at most ${f2(d.maxGap)}.`}
                    source="reports/tables/cv_methods.csv" table={<Table rows={d.targets as unknown as Record<string, unknown>[]} cols={[["label", "Method"], ["sum", "Sum", (v) => f2(v as number)], ["top", "Top", (v) => f2(v as number)]]} />}>
                    <TargetBars rows={d.targets} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r5">
                  <div className="ms-label">R5</div>
                  <h2>Fewer labels, lower scores</h2>
                  <div className="prose">
                    <p>Each method was run again with only 10%, 20% and 50% of the training labels; the hidden labels joined the unlabeled compounds. {NAMES[d.top.method]} goes from {f2(d.f10)} to {f2(d.f50)} to {f2(d.f100)}.</p>
                    <p>The curve has not flattened at 100%, so more labeled compounds would most likely raise the score further. That points to labeling, not the choice of method, as the main limit.</p>
                  </div>
                  <ChartFrame label="R5 · score against the number of labels" title="macro-F1 with 10, 20, 50 and 100% of the labels" finding="Every method keeps improving as labels are added; the soft band is the spread over three repeats."
                    source="reports/tables/label_fractions.csv" table={<Table rows={fractions as unknown as Record<string, unknown>[]} cols={[["method", "Method"], ["fraction", "Labels", (v) => `${(v as number) * 100}%`], ["drug_f1", "macro-F1", (v) => f2(v as number)], ["spread", "Spread", (v) => f2(v as number)]]} />}>
                    <FractionLines rows={fractions} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r6">
                  <div className="ms-label">R6</div>
                  <h2>Where it is strong, and where it is weak</h2>
                  <div className="prose">
                    <p>With {NAMES[d.top.method]}, the best classes are {d.strong.map((s) => `${s.c} (${f2(s.v)})`).join(" and ")}; the weakest drug classes are {d.weak.map((s) => `${s.c} (${f2(s.v)})`).join(" and ")}. The &ldquo;other&rdquo; class, which holds steroids and ordinary medicines, has an F-score of {f2(d.otherF1)}: many of them are called a drug.</p>
                  </div>
                  <ChartFrame label="R6 · F1 per class" title={`${NAMES[d.top.method]}, best setting`} finding="Each bar is one class's F-score in cross-validation; the table compares all four methods."
                    source="reports/tables/cv_per_class.csv" table={<Table rows={perClass} cols={[["class", "Class"], ...ORDER.map((m) => [m, NAMES[m], (v: unknown) => f2(Number(v))] as [string, string, (v: unknown) => string])]} />}>
                    <ClassF1 perClass={perClass} method={d.top.method} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r7">
                  <div className="ms-label">R7</div>
                  <h2>When the app says &ldquo;uncertain&rdquo;</h2>
                  <div className="prose">
                    <p>The app answers &ldquo;uncertain&rdquo; when the confidence of the answer is below a <Term k="threshold" />. A higher threshold holds back more compounds and the answered ones are right more often.</p>
                    <p>The threshold is the lowest value at which at least 85% of the answered compounds are right while at least 60% of all compounds are answered. It was read from the cross-validation predictions, never from the holdout. It is <b>{f2(d.threshold)}</b>. A first rule (75% right) was already met at the lowest value tried, 0.30, where only 3% of compounds are held back; I changed the rule after seeing that, so the threshold would actually do something.</p>
                  </div>
                  <ChartFrame label="R7 · the threshold" title="What each threshold keeps" finding={`At ${f2(d.threshold)} the app answers ${pct(thresholds.find((t) => t.threshold === d.threshold)?.answered_share ?? 0)} of the compounds in cross-validation, and ${pct(thresholds.find((t) => t.threshold === d.threshold)?.accuracy_answered ?? 0)} of those answers are right.`}
                    source="reports/tables/threshold_table.csv" table={<Table rows={thresholds as unknown as Record<string, unknown>[]} cols={[["threshold", "Threshold", (v) => f2(v as number)], ["answered_share", "Answered", (v) => pct(v as number)], ["accuracy_answered", "Right among answered", (v) => pct(v as number)]]} />}>
                    <ThresholdLines rows={thresholds} chosen={d.threshold} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r8">
                  <div className="ms-label">R8</div>
                  <h2>Drugs the model has never seen</h2>
                  <div className="prose">
                    <p>A useful model should say &ldquo;uncertain&rdquo; when a compound belongs to a class it was never taught. To test that, each class was left out of the labeled training compounds in turn, and the compounds of that class were scored.</p>
                    <p>On average <b>{pct(d.unseenMean)}</b> of the compounds of a class the model had never seen were called uncertain, against <b>{pct(d.normal)}</b> for normal predictions. That is a little more, not a lot: <b>the model is still overconfident on unfamiliar classes</b>, and a confident answer is not proof that the compound belongs to a known class.</p>
                  </div>
                  <ChartFrame label="R8 · unseen classes" title="Share called uncertain when the class was left out" finding={`The bars sit only a little above the normal rate of ${pct(d.normal)}.`}
                    source="reports/tables/rejection_test.csv" table={<Table rows={unseen as unknown as Record<string, unknown>[]} cols={[["left_out_class", "Class left out"], ["compounds", "Compounds"], ["uncertain_share", "Called uncertain", (v) => pct(v as number)]]} />}>
                    <UnseenBars rows={unseen} normal={d.normal} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r9">
                  <div className="ms-label">R9</div>
                  <h2>The holdout exam</h2>
                  <div className="prose">
                    <p>The {fmt(d.h.holdout_compounds)} <Term k="holdout">held-out</Term> compounds were set aside before any model was trained and scored once, for the final model only, after the threshold was fixed. Nothing was changed because of the result.</p>
                    <p>The macro-F1 over the six drug classes is <b>{f2(d.h.drug_f1)}</b>, close to the cross-validation score of {f2(d.top.drug_f1)}. With so few compounds the honest <Term k="bootstrap / 95% range">95% range</Term> is {f2(d.h.drug_f1_low)} to {f2(d.h.drug_f1_high)}. The class is right for {pct(d.h.accuracy)} of the compounds and the family for {pct(d.h.family_accuracy)}.</p>
                  </div>
                  <div className="scorecards">
                    <StatCounter value={d.h.drug_f1} what="holdout macro-F1" ctx={`range ${f2(d.h.drug_f1_low)}–${f2(d.h.drug_f1_high)}`} />
                    <StatCounter value={Math.round(d.h.accuracy * 100)} decimals={0} suffix="%" what="class accuracy" ctx={`${fmt(d.h.holdout_compounds)} held-out compounds`} />
                    <StatCounter value={Math.round(d.h.uncertain_share * 100)} decimals={0} suffix="%" what="called uncertain" ctx={`threshold ${f2(d.threshold)}`} />
                    <StatCounter value={Math.round(d.h.accuracy_answered * 100)} decimals={0} suffix="%" what="right among the answered" ctx="answers above the threshold" />
                  </div>
                  <ChartFrame label="R9 · holdout against cross-validation" title="Where the holdout score sits" finding={`Holdout ${f2(d.h.drug_f1)}, with a range of ${f2(d.h.drug_f1_low)} to ${f2(d.h.drug_f1_high)}; cross-validation gave ${f2(d.top.drug_f1)} ± ${f2(d.top.spread)}.`}
                    source="reports/tables/holdout_results.csv" table={<Table rows={[{ what: "Cross-validation", value: d.top.drug_f1, lo: d.top.drug_f1 - d.top.spread, hi: d.top.drug_f1 + d.top.spread }, { what: "Holdout", value: d.h.drug_f1, lo: d.h.drug_f1_low, hi: d.h.drug_f1_high }]} cols={[["what", "Measured on"], ["value", "macro-F1", (v) => f2(v as number)], ["lo", "Low", (v) => f2(v as number)], ["hi", "High", (v) => f2(v as number)]]} />}>
                    <ScoreRuler score={d.h.drug_f1} lo={d.h.drug_f1_low} hi={d.h.drug_f1_high} label="Holdout" refs={[{ value: d.top.drug_f1, label: "Cross-validation" }]} />
                  </ChartFrame>
                  <ChartFrame label="R9 · confusion matrix" title="True class against the answer" finding="Each row is one true class; the shade is the share of the row and the number is the count. Hover a cell to see the compounds."
                    source="reports/tables/holdout_predictions.csv" table={<Table rows={d.wrong as unknown as Record<string, unknown>[]} cols={[["name", "Compound"], ["class", "True class"], ["predicted_class", "Answer"], ["confidence", "Confidence", (v) => f2(v as number)]]} />}>
                    <ConfusionMatrix rows={preds} />
                  </ChartFrame>
                  <ChartFrame label="R9 · recall per class" title="Cross-validation beside the holdout" finding={`The largest drop is ${d.drop.class}: recall ${f2(d.drop.cv_recall)} in cross-validation, ${f2(d.drop.recall)} on the ${d.drop.compounds} held-out compounds.`}
                    source="reports/tables/holdout_per_class.csv" table={<Table rows={holdoutClass as unknown as Record<string, unknown>[]} cols={[["class", "Class"], ["compounds", "Held out"], ["precision", "Precision", (v) => f2(v as number)], ["recall", "Recall", (v) => f2(v as number)], ["cv_recall", "CV recall", (v) => f2(v as number)]]} />}>
                    <RecallCompare rows={holdoutClass} />
                  </ChartFrame>
                  <div className="detail-note">Each class has only {Math.min(...holdoutClass.map((c) => c.compounds))} to {Math.max(...holdoutClass.map((c) => c.compounds))} held-out compounds, so one compound moves a recall by several points. Read the bars as a rough guide.</div>
                </section>

                <section className="rsection" id="r10">
                  <div className="ms-label">R10</div>
                  <h2>The mistakes</h2>
                  <div className="prose">
                    <p>{d.wrong.length} of the {fmt(d.h.holdout_compounds)} held-out compounds got the wrong class. The most common mix-ups: {d.pairs.map(([k, n]) => `${k} (${n})`).join(", ")}. The &ldquo;other&rdquo; class errs the other way: its precision is {f2(d.otherHold.precision)}, so many compounds called &ldquo;other&rdquo; are really drugs.</p>
                  </div>
                  <ChartFrame label="R10 · wrong answers" title="Held-out compounds the model got wrong" finding="Highest confidence first: the top rows are confident mistakes."
                    source="reports/tables/holdout_predictions.csv" table={<Table rows={d.wrong as unknown as Record<string, unknown>[]} cols={[["name", "Compound"], ["family", "True family"], ["predicted_family", "Answered family"], ["class", "True class"], ["predicted_class", "Answer"], ["confidence", "Confidence", (v) => f2(v as number)]]} />}>
                    <Table rows={d.wrong.slice(0, 12) as unknown as Record<string, unknown>[]} cols={[["name", "Compound"], ["family", "True family"], ["predicted_family", "Answered family"], ["confidence", "Confidence", (v) => f2(v as number)]]} />
                  </ChartFrame>
                </section>

                <section className="rsection" id="r11">
                  <div className="ms-label">R11</div>
                  <h2>An honest verdict</h2>
                  <div className="prose">
                    <p>The model is a <b>useful first hint, not an identification</b>. Over the six drug classes it scores {f2(d.h.drug_f1)} macro-F1 on {fmt(d.h.holdout_compounds)} compounds it never saw (range {f2(d.h.drug_f1_low)} to {f2(d.h.drug_f1_high)}), close to its cross-validation score of {f2(d.top.drug_f1)}. It is strongest on {d.strong.map((s) => s.c).join(" and ")}.</p>
                    <p>Its weak spots are real. Recall for {d.drop.class} was {f2(d.drop.recall)} on the holdout, against {f2(d.drop.cv_recall)} in cross-validation. Only {pct(d.otherHold.precision)} of the compounds it calls &ldquo;other&rdquo; really are, so it often calls a drug ordinary medicine. And it is overconfident on classes it has not seen: {pct(d.unseenMean)} of them are called uncertain, against {pct(d.normal)} of normal predictions.</p>
                    <p>The clearest way to improve it is more labeled compounds: the score was still rising when all labels were used.</p>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
