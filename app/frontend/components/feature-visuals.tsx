"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useBackend } from "./backend";
import { Tex } from "./tex";
import { useWidth } from "./spectrum";
import { ChartFrame, Segmented, Skeleton } from "./ui";
import { Compound, LEVELS, Level, LibraryItem, Peaks, get } from "@/lib/api";
import {
  A_DIVISORS, A_NAMES, D_DIVISORS, D_FEATURES, STEPS, binValues, cleaning, cosine, featureName, massDefect, stepView,
} from "@/lib/features-demo";

// ---- data ---------------------------------------------------------------------------------------
const cache = new Map<string, Promise<unknown>>();
function useApi<T>(path: string | null) {
  const { state } = useBackend();
  const [got, setGot] = useState<{ path: string; data: T } | null>(null);
  useEffect(() => {
    if (state !== "ready" || !path) return;
    let live = true;
    if (!cache.has(path)) cache.set(path, get<T>(path));
    (cache.get(path) as Promise<T>).then((data) => { if (live) setGot({ path, data }); }).catch(() => { cache.delete(path); });
    return () => { live = false; };
  }, [state, path]);
  return got && got.path === path ? got.data : null;
}

type FeatureData = {
  inchikey: string; name: string; precursor_mz: number;
  groups: { prefix: string; label: string; start: number; end: number }[];
  vector: number[];
  formula: { true: string; n_candidates: number; candidates: { formula: string; ppm: number; weight: number; is_true: boolean }[]; averaged: Record<string, number> };
};

/** One compound per class; the first one is the default (the compound of the hero on the same page). */
export const PICKS = [
  { key: "PJMPHNIQZUBGLI-UHFFFAOYSA-N", label: "Fentanyl (opioid)" },
  { key: "SHXWCVYOXRDMCX-UHFFFAOYSA-N", label: "MDMA (stimulant)" },
  { key: "YQEZLKZALYSWHR-UHFFFAOYSA-N", label: "Ketamine (dissociative)" },
  { key: "AAOVKJBEBIDNHE-UHFFFAOYSA-N", label: "Diazepam (depressant)" },
  { key: "VAYOSLLFUXYJDT-UHFFFAOYSA-N", label: "LSD (psychedelic)" },
  { key: "JDNLPKCAXICMBW-UHFFFAOYSA-N", label: "JWH-018 (cannabinoid)" },
  { key: "HEFNNWSXXWATRW-UHFFFAOYSA-N", label: "Ibuprofen (other)" },
];
const Ctx = createContext<{ key: string; setKey: (k: string) => void }>({ key: PICKS[0].key, setKey: () => {} });

/** Holds the compound chosen in the picker, so that every figure of section S6 follows it. */
export function FeatureStory({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(PICKS[0].key);
  return <Ctx.Provider value={{ key, setKey }}>{children}</Ctx.Provider>;
}

const useCompound = () => useApi<Compound>(`/library/${useContext(Ctx).key}`);
const useFeatures = () => useApi<FeatureData>(`/features/${useContext(Ctx).key}`);

export function CompoundPicker() {
  const { key, setKey } = useContext(Ctx);
  return (
    <div className="ms-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "8px 0 24px" }}>
      <label className="ms-label" htmlFor="s6-pick">Follow this compound</label>
      <select id="s6-pick" className="ms-input" style={{ width: "auto", minWidth: 220 }} value={key} onChange={(e) => setKey(e.target.value)}>
        {PICKS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <span className="ms-muted" style={{ fontSize: 13 }}>Every figure in this section follows it.</span>
    </div>
  );
}

const sub = (formula: string) => formula.split(/(\d+)/).map((p, i) => (i % 2 ? <sub key={i}>{p}</sub> : p));
const f2 = (v: number) => v.toFixed(2);

function LevelSwitch({ level, setLevel }: { level: Level; setLevel: (l: Level) => void }) {
  return <Segmented label="Fragmentation level" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />;
}

// ---- spectra -------------------------------------------------------------------------------------
const PAD = { L: 52, R: 12, T: 10, B: 30 };

function Axes({ W, H, xMax, ticks, format }: { W: number; H: number; xMax: number; ticks: number[]; format: (v: number) => string }) {
  const y = (v: number) => H - PAD.B - v * (H - PAD.B - PAD.T);
  const x = (v: number) => PAD.L + (v / xMax) * (W - PAD.L - PAD.R);
  const xticks = [0, 100, 200, 300, 400, 500, 600].filter((t) => t <= xMax);
  return (
    <g>
      {ticks.map((t) => <g key={t}><line className="grid" x1={PAD.L} x2={W - PAD.R} y1={y(t)} y2={y(t)} /><text className="lbl" x={PAD.L - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>)}
      <line className="axis" x1={PAD.L} x2={W - PAD.R} y1={H - PAD.B} y2={H - PAD.B} />
      {xticks.map((t) => <text key={t} className="lbl" x={x(t)} y={H - PAD.B + 18} textAnchor="middle">{t}</text>)}
      <text className="lbl lbl--sans" x={W - PAD.R} y={H - 2} textAnchor="end">m/z</text>
    </g>
  );
}

/** Raw spectrum above, cleaned spectrum below, on one m/z axis; the peaks the cleaning removes are grey. */
export function RawVsCleaned() {
  const c = useCompound();
  const [level, setLevel] = useState<Level>("HIGH");
  const [zoom, setZoom] = useState(false);
  const [box, width] = useWidth<HTMLDivElement>();
  const data = useMemo(() => (c ? cleaning(c.spectra[level].raw) : null), [c, level]);
  if (!c || !data) return <Skeleton h={420} />;
  const top = zoom ? 0.05 : 1;   // the raw panel shows the bottom 5% of the height when zoomed, so the small peaks can be seen
  const W = Math.max(width || 720, 320), H = 190;
  const xMax = Math.max(...data.mz) + 10;
  const x = (v: number) => PAD.L + (v / xMax) * (W - PAD.L - PAD.R);
  const y = (v: number) => H - PAD.B - v * (H - PAD.B - PAD.T);
  const removed = data.kept.filter((k) => !k).length, n = data.mz.length;
  const low = data.aboveNoise.filter((k) => !k).length;
  const panel = (values: number[], isRaw: boolean) => (
    <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label={isRaw ? "Raw spectrum" : "Cleaned spectrum"} style={{ display: "block", width: "100%" }}>
      <Axes W={W} H={H} xMax={xMax} ticks={[0, 0.5, 1]} format={(t) => (isRaw ? `${Math.round((t * top * data.rawMax) / 1000)}k` : f2(t))} />
      {isRaw && zoom && <g><line x1={PAD.L} x2={W - PAD.R} y1={y(0.005 / top)} y2={y(0.005 / top)} stroke="var(--signal)" strokeWidth={1} /><text className="lbl lbl--sans" x={W - PAD.R - 4} y={y(0.005 / top) - 4} textAnchor="end">0.5% of the strongest peak</text></g>}
      {values.map((v, i) => {
        const gone = !data.kept[i];
        if (!isRaw && gone) return null;
        return <line key={i} x1={x(data.mz[i])} x2={x(data.mz[i])} y1={y(0)} y2={y(Math.min(v / (isRaw ? top : 1), 1))} stroke={isRaw && gone ? "var(--text-muted)" : "var(--text)"} strokeOpacity={isRaw && gone ? 0.55 : 1} strokeWidth={1.4} strokeDasharray={isRaw && gone ? "2 2" : undefined} />;
      })}
      <text className="lbl lbl--sans lbl--strong" x={PAD.L + 4} y={PAD.T + 8}>{isRaw ? (zoom ? "Raw, zoomed on the bottom 5%: intensity in counts" : "Raw: intensity in counts") : "Cleaned: intensity, length 1"}</text>
    </svg>
  );
  return (
    <ChartFrame label="S6 · raw against cleaned" title={`${c.name}, ${level} spectrum`}
      finding={`${n} raw peaks become ${n - removed}: ${low} are below 0.5% of the strongest${removed - low > 0 ? ` and ${removed - low} more fall outside the 200 strongest` : ""}. The shape of the spectrum stays; the scale and the noise go.`}
      source="NIST DART-MS Forensics “Locust” library · notebook 01"
      table={<table className="ms-table"><thead><tr><th>Step</th><th className="num">Peaks left</th></tr></thead><tbody><tr><td>Raw</td><td className="num">{n}</td></tr><tr><td>Above 0.5%</td><td className="num">{n - low}</td></tr><tr><td>200 strongest</td><td className="num">{n - removed}</td></tr></tbody></table>}>
      <div ref={box} className="ms-chart" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <LevelSwitch level={level} setLevel={setLevel} />
            <Segmented label="Scale of the raw spectrum" value={zoom ? "zoom" : "full"} onChange={(v) => setZoom(v === "zoom")} options={[{ value: "full", label: "FULL" }, { value: "zoom", label: "ZOOM ON SMALL PEAKS" }]} />
          </div>
          <ul className="ms-legend" aria-label="Legend">
            <li style={{ whiteSpace: "nowrap" }}><svg width="22" height="10" aria-hidden><line x1="2" x2="20" y1="5" y2="5" stroke="var(--text)" strokeWidth="2" /></svg>kept</li>
            <li style={{ whiteSpace: "nowrap" }}><svg width="22" height="10" aria-hidden><line x1="2" x2="20" y1="5" y2="5" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="2 2" /></svg>removed by the cleaning</li>
          </ul>
        </div>
        {panel(data.scaled, true)}
        {panel(data.unit, false)}
      </div>
    </ChartFrame>
  );
}

const STEP_TEX = [
  "",
  String.raw`\tilde{x}_i = \dfrac{x_i}{\max_j x_j}`,
  String.raw`\text{keep } \tilde{x}_i \ge 0.005`,
  String.raw`\text{keep the 200 largest } \tilde{x}_i`,
  String.raw`y_i = \sqrt{\tilde{x}_i}`,
  String.raw`\hat{y}_i = \dfrac{y_i}{\lVert y \rVert_2}, \qquad \lVert y \rVert_2 = \sqrt{\textstyle\sum_i y_i^{2}}`,
  String.raw`b_i = \lfloor m/z_i \rfloor, \qquad v_b = \max_{i:\, b_i = b} \hat{y}_i`,
];

/** The cleaning one step at a time, with the animation of each change. */
export function CleaningStepper() {
  const c = useCompound();
  const [level, setLevel] = useState<Level>("HIGH");
  const [step, setStep] = useState(0);
  const [box, width] = useWidth<HTMLDivElement>();
  const data = useMemo(() => (c ? cleaning(c.spectra[level].raw) : null), [c, level]);
  if (!c || !data) return <Skeleton h={420} />;
  const view = stepView(data, step);
  const W = Math.max(width || 720, 320), H = 280;
  const xMax = Math.max(...data.mz) + 10;
  const x = (v: number) => PAD.L + (v / xMax) * (W - PAD.L - PAD.R);
  const h = (v: number) => v * (H - PAD.B - PAD.T);
  const left = view.alive.filter(Boolean).length;
  const info = [
    `${data.mz.length} peaks, the strongest at ${Math.round(data.rawMax).toLocaleString()} counts.`,
    "The strongest peak is now 1. Spectra from samples of different sizes can be compared.",
    `${left} peaks left, ${data.mz.length - left} removed as noise.`,
    `${left} peaks left.`,
    "Small peaks rise, so that the large ones do not drown them.",
    `The length of the spectrum was ${data.length.toFixed(2)}; it is now 1. Every level of every compound has the same overall size.`,
    `${data.bins.filter((v) => v > 0).length} of the 650 slots hold a peak; the others stay 0.`,
  ][step];
  const binW = Math.max(x(1) - x(0), 0.8);
  return (
    <ChartFrame label="S6 · the cleaning, step by step" title={`${c.name}, ${level}: ${STEPS[step].title}`} finding={info}
      source="notebook 01 · the same steps in the same order"
      table={<table className="ms-table"><thead><tr><th>Peak (m/z)</th><th className="num">Height in this step</th></tr></thead><tbody>{view.values.map((v, i) => [v, i] as const).filter(([, i]) => view.alive[i]).sort((a, b) => b[0] - a[0]).slice(0, 12).map(([v, i]) => <tr key={i}><td>{data.mz[i].toFixed(4)}</td><td className="num">{v.toFixed(4)}</td></tr>)}</tbody></table>}>
      <div ref={box} className="ms-chart" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <LevelSwitch level={level} setLevel={setLevel} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="ms-btn ms-btn--sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            <span className="ms-mono ms-muted" aria-live="polite">{step} / {STEPS.length - 1}</span>
            <button type="button" className="ms-btn ms-btn--sm ms-btn--primary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Next</button>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label={`${STEPS[step].title}. ${info}`} style={{ display: "block", width: "100%" }}>
          <Axes W={W} H={H} xMax={xMax} ticks={[0, 0.25, 0.5, 0.75, 1]} format={(t) => (step === 0 ? `${Math.round(t * data.rawMax / 1000)}k` : f2(t))} />
          {data.mz.map((m, i) => (
            <rect key={i} x={x(m) - 0.8} width={1.6} style={{ y: H - PAD.B - h(view.values[i]), height: h(view.values[i]), opacity: view.alive[i] && !view.bins ? 1 : 0, transition: "y .45s, height .45s, opacity .45s" }}
              fill="var(--text)" />
          ))}
          {data.bins.map((v, b) => (v > 0 ? <rect key={b} x={x(b)} width={binW} style={{ y: H - PAD.B - h(v), height: h(v), opacity: view.bins ? 1 : 0, transition: "opacity .45s" }} fill="var(--text)" /> : null))}
          <text className="lbl lbl--sans" x={PAD.L + 4} y={PAD.T + 8}>{STEPS[step].axis}</text>
        </svg>
        {STEP_TEX[step] && <div style={{ textAlign: "center" }}><Tex tex={STEP_TEX[step]} block /></div>}
        <div style={{ display: "flex", gap: 6 }} aria-hidden>
          {STEPS.map((s, i) => <button key={s.key} type="button" onClick={() => setStep(i)} title={s.title} style={{ flex: 1, height: 6, border: 0, borderRadius: 3, cursor: "pointer", background: i <= step ? "var(--text)" : "var(--border-strong)", opacity: i <= step ? 1 : 0.5 }} />)}
        </div>
      </div>
    </ChartFrame>
  );
}

// ---- mass defect ---------------------------------------------------------------------------------
/** Every precursor of the library: mass defect against m/z, in two series by the parity of the whole mass (the nitrogen rule). */
export function MassDefectPlot() {
  const lib = useApi<LibraryItem[]>("/library");
  const { key } = useContext(Ctx);
  const [box, width] = useWidth<HTMLDivElement>();
  if (!lib) return <Skeleton h={360} />;
  const W = Math.max(width || 720, 320), H = 340, L = 50, R = 14, T = 12, B = 40;
  const xMin = 50, xMax = 650;
  const x = (v: number) => L + ((v - xMin) / (xMax - xMin)) * (W - L - R);
  const y = (d: number) => T + (0.55 - d) / 0.75 * (H - T - B);
  const pts = lib.map((c) => ({ c, d: massDefect(c.precursor_mz), odd: Math.round(c.precursor_mz) % 2 === 1 }));
  const me = pts.find((p) => p.c.inchikey === key);
  const count = (odd: boolean) => pts.filter((p) => p.odd === odd).length;
  return (
    <ChartFrame label="S6 · group A: mass defect" title="Mass defect against m/z, 1,570 compounds"
      finding="Atoms leave a signature after the decimal point, and heavier molecules drift upwards. The compounds with an odd whole mass (orange squares) tend to sit a little higher than those with an even one (blue circles): the parity follows the number of nitrogens."
      source="data/processed/compounds.csv · notebook 02"
      table={<table className="ms-table"><thead><tr><th>Whole mass</th><th className="num">Compounds</th></tr></thead><tbody><tr><td>odd (even number of N)</td><td className="num">{count(true)}</td></tr><tr><td>even (odd number of N)</td><td className="num">{count(false)}</td></tr></tbody></table>}>
      <div ref={box} className="ms-chart">
        <ul className="ms-legend" aria-label="Legend" style={{ marginBottom: 8 }}>
          <li style={{ whiteSpace: "nowrap" }}><svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill="#2a78d6" /></svg>even whole mass ({count(false)})</li>
          <li style={{ whiteSpace: "nowrap" }}><svg width="12" height="12" aria-hidden><rect x="2" y="2" width="8" height="8" fill="#eb6834" /></svg>odd whole mass ({count(true)})</li>
          <li style={{ whiteSpace: "nowrap" }}><svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--text)" strokeWidth="2" /></svg>the compound chosen above</li>
        </ul>
        <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label="Mass defect against m/z" style={{ display: "block", width: "100%" }}>
          {[-0.2, 0, 0.2, 0.4].map((d) => <g key={d}><line className="grid" x1={L} x2={W - R} y1={y(d)} y2={y(d)} /><text className="lbl" x={L - 8} y={y(d) + 4} textAnchor="end">{d.toFixed(2)}</text></g>)}
          <line className="axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
          {[100, 200, 300, 400, 500, 600].map((t) => <text key={t} className="lbl" x={x(t)} y={H - B + 18} textAnchor="middle">{t}</text>)}
          <text className="lbl lbl--sans" x={(L + W - R) / 2} y={H - 6} textAnchor="middle">precursor m/z</text>
          <text className="lbl lbl--sans" x={L} y={T - 1}>mass defect</text>
          {pts.map(({ c, d, odd }) => odd
            ? <rect key={c.inchikey} x={x(c.precursor_mz) - 2} y={y(d) - 2} width={4} height={4} fill="#eb6834" fillOpacity={0.6}><title>{`${c.name}: m/z ${c.precursor_mz.toFixed(4)}, defect ${d.toFixed(4)}`}</title></rect>
            : <circle key={c.inchikey} cx={x(c.precursor_mz)} cy={y(d)} r={2.4} fill="#2a78d6" fillOpacity={0.6}><title>{`${c.name}: m/z ${c.precursor_mz.toFixed(4)}, defect ${d.toFixed(4)}`}</title></circle>)}
          {me && <g><circle cx={x(me.c.precursor_mz)} cy={y(me.d)} r={7} fill="none" stroke="var(--text)" strokeWidth={2} /><text className="lbl lbl--sans lbl--strong" x={x(me.c.precursor_mz) + 10} y={y(me.d) - 8}>{me.c.name}</text></g>}
        </svg>
      </div>
    </ChartFrame>
  );
}

// ---- the numbers of one compound: groups A and D --------------------------------------------------
function groupSlice(f: FeatureData, prefix: string) {
  const g = f.groups.find((x) => x.prefix === prefix)!;
  return f.vector.slice(g.start, g.end);
}

export function SummaryCards({ group }: { group: "A" | "D" }) {
  const f = useFeatures();
  if (!f) return <Skeleton h={160} />;
  const values = groupSlice(f, `${group}_`);
  const items = group === "A"
    ? A_NAMES.map((n, i) => ({ name: n, value: values[i] * A_DIVISORS[i], scaled: values[i] }))
    : LEVELS.flatMap((l, li) => D_FEATURES.map((n, i) => ({ name: `${l}: ${n}`, value: values[li * 4 + i] * D_DIVISORS[i], scaled: values[li * 4 + i] })));
  return (
    <ChartFrame label={`S6 · group ${group}: the numbers of ${f.name}`} title={group === "A" ? "The six mass-defect numbers" : "The twelve summary numbers"}
      finding="The large number is the value itself; the small one below it is the scaled number the model receives."
      source="`/features` · the training row of the compound"
      table={<table className="ms-table"><thead><tr><th>Feature</th><th className="num">Value</th><th className="num">Scaled</th></tr></thead><tbody>{items.map((it) => <tr key={it.name}><td>{it.name}</td><td className="num">{it.value.toFixed(4)}</td><td className="num">{it.scaled.toFixed(4)}</td></tr>)}</tbody></table>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
        {items.map((it) => (
          <div key={it.name} className="ms-card" style={{ padding: 12 }}>
            <div className="ms-muted" style={{ fontSize: 12, lineHeight: "16px", minHeight: 32 }}>{it.name}</div>
            <div className="ms-mono" style={{ fontSize: 20, lineHeight: "28px" }}>{Math.abs(it.value) >= 100 ? it.value.toFixed(0) : it.value.toFixed(3)}</div>
            <div className="ms-mono ms-muted" style={{ fontSize: 11 }}>scaled {it.scaled.toFixed(3)}</div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

// ---- formula --------------------------------------------------------------------------------------
type Check = { mass_range: string; compounds: number; true_formula_is_candidate: number; rank_1: number; in_top_3: number; median_candidates: number };

function parseCounts(formula: string) {
  const out: Record<string, number> = {};
  for (const [, el, n] of formula.matchAll(/([A-Z][a-z]?)(\d+)/g)) out[el] = Number(n);
  return out;
}

export function FormulaCandidates() {
  const f = useFeatures();
  const check = useApi<Check[]>("/results/formula_check");
  if (!f || !check) return <Skeleton h={360} />;
  const truth = parseCounts(f.formula.true);
  const els = ["C", "N", "O", "S", "F", "Cl", "Br"];
  const avg = f.formula.averaged;
  const rows = check.filter((r) => r.mass_range !== "all");
  const all = check.find((r) => r.mass_range === "all");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ChartFrame label={`S6 · group B: the formula of ${f.name}`} title={`${f.formula.n_candidates} formulas fit the mass`}
        finding={`The true formula, ${f.formula.true}, ${f.formula.candidates[0]?.is_true ? "has by far the largest weight" : "is not the heaviest candidate"}. The ten numbers of group B are weighted averages over all candidates.`}
        source="`/features` · notebook 02, group B"
        table={<table className="ms-table"><thead><tr><th>Formula</th><th className="num">Error (ppm)</th><th className="num">Weight</th></tr></thead><tbody>{f.formula.candidates.map((c) => <tr key={c.formula}><td>{c.formula}{c.is_true ? " (true)" : ""}</td><td className="num">{c.ppm.toFixed(3)}</td><td className="num">{c.weight.toFixed(4)}</td></tr>)}</tbody></table>}>
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <div>
            <div className="ms-label" style={{ marginBottom: 8 }}>Candidate formulas (share of the total weight)</div>
            <ul className="ms-bars">
              {f.formula.candidates.map((c) => (
                <li key={c.formula} className="ms-bar" tabIndex={0} title={`${c.formula}: ${c.ppm.toFixed(3)} ppm, weight ${c.weight.toFixed(4)}`} style={{ ["--c" as string]: "var(--text)", gridTemplateColumns: "minmax(150px, 190px) 1fr 84px" }}>
                  <span className="ms-bar__name" style={{ fontFamily: "var(--font-mono)", fontWeight: c.is_true ? 600 : 400, display: "block", whiteSpace: "nowrap" }}><span>{sub(c.formula)}</span>{c.is_true ? " ✓" : ""}</span>
                  <span className="ms-bar__track"><i className="ms-bar__fill" data-variant={c.is_true ? undefined : "3"} style={{ ["--p" as string]: c.weight }} /></span>
                  <span className="ms-bar__val ms-muted" style={{ whiteSpace: "nowrap" }}>{c.ppm.toFixed(2)} ppm</span>
                </li>
              ))}
            </ul>
            <p className="ms-muted" style={{ fontSize: 12, marginTop: 8 }}>✓ marks the true formula, from the library. Solid bar: the true formula; hatched: other candidates.</p>
          </div>
          <div>
            <div className="ms-label" style={{ marginBottom: 8 }}>Atoms: true count against the weighted average</div>
            <table className="ms-table"><thead><tr><th>Atom</th><th className="num">True</th><th className="num">Average</th></tr></thead>
              <tbody>{els.map((e) => <tr key={e}><td>{e}</td><td className="num">{truth[e] ?? 0}</td><td className="num">{(avg[e] ?? 0).toFixed(2)}</td></tr>)}
                <tr><td>double bonds and rings</td><td className="num">–</td><td className="num">{avg.dbe.toFixed(2)}</td></tr>
                <tr><td>hydrogen per carbon</td><td className="num">{((truth.H ?? 0) / (truth.C ?? 1)).toFixed(2)}</td><td className="num">{avg.h_per_c.toFixed(2)}</td></tr></tbody></table>
          </div>
        </div>
      </ChartFrame>
      <ChartFrame label="S6 · group B: does the true formula appear?" title="How often the true formula is among the candidates"
        finding={all ? `Over all ${all.compounds} compounds with a plain formula, the true one is a candidate ${Math.round(all.true_formula_is_candidate * 100)}% of the time and has the largest weight ${Math.round(all.rank_1 * 100)}% of the time.` : ""}
        source="reports/tables/formula_check.csv"
        table={<table className="ms-table"><thead><tr><th>Mass range</th><th className="num">Compounds</th><th className="num">Is a candidate</th><th className="num">In the top 3</th><th className="num">Largest weight</th></tr></thead><tbody>{check.map((r) => <tr key={r.mass_range}><td>{r.mass_range}</td><td className="num">{r.compounds}</td><td className="num">{f2(r.true_formula_is_candidate)}</td><td className="num">{f2(r.in_top_3)}</td><td className="num">{f2(r.rank_1)}</td></tr>)}</tbody></table>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ul className="ms-legend" aria-label="Legend">
            {[["is a candidate", "1"], ["in the top 3", "2"], ["largest weight", "3"]].map(([label, v]) => <li key={label}><i className="ms-fam" data-variant={v} style={{ ["--c" as string]: "var(--text)" }} />{label}</li>)}
          </ul>
          {rows.map((r) => (
            <div key={r.mass_range} style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>m/z {r.mass_range} <span className="ms-muted">· {r.compounds} compounds</span></span>
              {([["is a candidate", r.true_formula_is_candidate, "1"], ["in the top 3", r.in_top_3, "2"], ["largest weight", r.rank_1, "3"]] as const).map(([label, v, variant]) => (
                <div key={label} className="ms-bar" style={{ ["--c" as string]: "var(--text)", gridTemplateColumns: "120px 1fr 44px" }} title={`${r.mass_range}, ${label}: ${f2(v)}`}>
                  <span className="ms-mono ms-muted" style={{ whiteSpace: "nowrap" }}>{label}</span>
                  <span className="ms-bar__track"><i className="ms-bar__fill" data-variant={variant} style={{ ["--p" as string]: v }} /></span>
                  <span className="ms-bar__val">{f2(v)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ChartFrame>
    </div>
  );
}

// ---- neutral losses -------------------------------------------------------------------------------
const PAIR = ["KKMGSAIPMRCJFU-UHFFFAOYSA-N", "UUAVKYBZWVMWSM-ZIAGYGMSSA-N"];

/** Two relatives drawn as fragments and as neutral losses, with the cosine similarity of each way of looking. */
export function NeutralLossMirror() {
  const a = useApi<Compound>(`/library/${PAIR[0]}`);
  const b = useApi<Compound>(`/library/${PAIR[1]}`);
  const [mode, setMode] = useState<"fragments" | "losses">("fragments");
  const [box, width] = useWidth<HTMLDivElement>();
  const calc = useMemo(() => {
    if (!a || !b) return null;
    const side = (c: Compound) => {
      const peaks = c.spectra.HIGH.clean as Peaks;
      const mz = peaks.map((p) => p[0]), inten = peaks.map((p) => p[1]);
      const loss = mz.map((m) => c.precursor_mz - m);
      const keep = loss.map((l) => l >= 0);
      return {
        mz, inten, loss, keep,
        fragBins: binValues(mz, inten),
        lossBins: binValues(loss.filter((_, i) => keep[i]), inten.filter((_, i) => keep[i])),
      };
    };
    const sa = side(a), sb = side(b);
    return { sa, sb, frag: cosine(sa.fragBins, sb.fragBins), loss: cosine(sa.lossBins, sb.lossBins) };
  }, [a, b]);
  if (!a || !b || !calc) return <Skeleton h={380} />;
  const W = Math.max(width || 720, 320), H = 320, L = 14, R = 14, T = 14, B = 30;
  const xMax = 340;
  const x = (v: number) => L + (v / xMax) * (W - L - R);
  const mid = (H - T - B) / 2 + T, half = (H - T - B) / 2 - 6;
  const maxI = Math.max(...calc.sa.inten, ...calc.sb.inten);
  const draw = (s: typeof calc.sa, dir: 1 | -1, color: string) => s.mz.map((m, i) => {
    const pos = mode === "fragments" ? m : s.loss[i];
    const ok = mode === "fragments" || s.keep[i];
    return <line key={i} style={{ transition: "all .5s" }} x1={x(pos)} x2={x(pos)} y1={mid} y2={mid - dir * (s.inten[i] / maxI) * half} stroke={color} strokeWidth={1.6} opacity={ok ? 1 : 0} />;
  });
  const fmt = (v: number) => v.toFixed(2);
  return (
    <ChartFrame label="S6 · group C: neutral losses" title="Two relatives: different fragments, the same losses"
      finding={`${a.name} and ${b.name} differ by one group on the part that stays in the fragments. Their fragments barely overlap (cosine ${fmt(calc.frag)}), but they lose the same pieces (cosine ${fmt(calc.loss)}).`}
      source="NIST DART-MS Forensics “Locust” library · HIGH spectra · notebook 02"
      table={<table className="ms-table"><thead><tr><th>Seen as</th><th className="num">Cosine similarity</th></tr></thead><tbody><tr><td>fragments</td><td className="num">{fmt(calc.frag)}</td></tr><tr><td>neutral losses</td><td className="num">{fmt(calc.loss)}</td></tr></tbody></table>}>
      <div ref={box} className="ms-chart" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Segmented label="Seen as" value={mode} onChange={setMode} options={[{ value: "fragments", label: "FRAGMENTS" }, { value: "losses", label: "NEUTRAL LOSSES" }]} />
          <ul className="ms-legend" aria-label="Legend">
            <li style={{ whiteSpace: "nowrap" }}><svg width="22" height="10" aria-hidden><line x1="2" x2="20" y1="5" y2="5" stroke="#2a78d6" strokeWidth="2.5" /></svg>{a.name} (above)</li>
            <li style={{ whiteSpace: "nowrap" }}><svg width="22" height="10" aria-hidden><line x1="2" x2="20" y1="5" y2="5" stroke="#eb6834" strokeWidth="2.5" strokeDasharray="5 2" /></svg>{b.name} (below)</li>
          </ul>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label={`Mirror plot of the two spectra seen as ${mode}`} style={{ display: "block", width: "100%" }}>
          <line className="axis" x1={L} x2={W - R} y1={mid} y2={mid} />
          {[0, 100, 200, 300].map((t) => <text key={t} className="lbl" x={x(t)} y={H - B + 18} textAnchor="middle">{t}</text>)}
          <text className="lbl lbl--sans" x={W - R} y={H - 2} textAnchor="end">{mode === "fragments" ? "m/z of the fragment" : "m/z of the piece that was lost"}</text>
          {draw(calc.sa, 1, "#2a78d6")}
          <g strokeDasharray="5 2">{draw(calc.sb, -1, "#eb6834")}</g>
        </svg>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "baseline" }}>
          <div><span className="ms-mono" style={{ fontSize: 28 }}>{fmt(mode === "fragments" ? calc.frag : calc.loss)}</span> <span className="ms-muted">cosine similarity, seen as {mode === "fragments" ? "fragments" : "neutral losses"}</span></div>
          <Tex tex={String.raw`\ell_i = m_{\text{precursor}} - (m/z)_i \qquad \cos\theta = \dfrac{a \cdot b}{\lVert a \rVert\, \lVert b \rVert}`} />
        </div>
      </div>
    </ChartFrame>
  );
}

// ---- the whole row --------------------------------------------------------------------------------
/** Every number of the compound as a strip, one band per group; each cell is shaded by its value. */
export function FeatureBarcode({ only }: { only?: string[] }) {
  const f = useFeatures();
  const [hover, setHover] = useState<string | null>(null);
  if (!f) return <Skeleton h={300} />;
  const groups = f.groups.filter((g) => !only || only.includes(g.prefix));
  const total = groups.reduce((s, g) => s + g.end - g.start, 0);
  return (
    <ChartFrame label={only ? "S6 · the first 1,951 numbers" : "S6 · the whole row"} title={`${f.name}: ${total.toLocaleString()} numbers`}
      finding={only ? "The three spectra and the precursor, one after the other. The larger a number, the more solid its cell." : "One row per compound, the only thing the model sees: no name and no structure. The larger a number, the more solid its cell; each band is scaled on its own."}
      source="`/features` · the training row of the compound"
      table={<table className="ms-table"><thead><tr><th>Band</th><th className="num">Numbers</th></tr></thead><tbody>{groups.map((g) => <tr key={g.prefix}><td>{g.label}</td><td className="num">{g.end - g.start}</td></tr>)}</tbody></table>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groups.map((g) => <Band key={g.prefix} g={g} values={f.vector.slice(g.start, g.end)} onHover={setHover} />)}
        <div className="ms-mono ms-muted" style={{ fontSize: 12, minHeight: 18 }} aria-live="polite">{hover ?? "Hover a cell to read it."}</div>
      </div>
    </ChartFrame>
  );
}

function Band({ g, values, onHover }: { g: FeatureData["groups"][number]; values: number[]; onHover: (s: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [box, width] = useWidth<HTMLDivElement>();
  const n = values.length, wide = n <= 20;
  const cell = wide ? Math.max(8, Math.min(22, Math.floor((width || 300) / n))) : 0;   // small groups: a block per number, narrower on a phone
  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const w = wide ? n * cell : Math.max(width, 120), h = 22, dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#000";
    const max = Math.max(...values.map(Math.abs), 1e-9);
    ctx.fillStyle = ink;
    values.forEach((v, i) => {
      ctx.globalAlpha = 0.06 + 0.94 * Math.sqrt(Math.abs(v) / max);
      const x0 = wide ? i * cell : (i / n) * w, x1 = wide ? (i + 1) * cell - 2 : ((i + 1) / n) * w;
      ctx.fillRect(x0, 0, Math.max(x1 - x0, 1), h);
    });
  };
  useEffect(() => {
    draw();
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  });
  const where = (e: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
    onHover(`${featureName(g.prefix, i)}: ${values[i].toFixed(4)}`);
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(96px, 170px) minmax(0, 1fr)", gap: 12, alignItems: "center" }}>
      <div style={{ fontSize: 13, lineHeight: "16px" }}><b style={{ fontWeight: 500 }}>{g.label}</b><div className="ms-muted ms-mono" style={{ fontSize: 11 }}>{n} number{n > 1 ? "s" : ""}</div></div>
      <div ref={box} style={{ minWidth: 0, overflow: "hidden" }}>
        <canvas ref={canvas} role="img" aria-label={`${g.label}: ${n} numbers`} onMouseMove={where} onMouseLeave={() => onHover(null)} style={{ display: "block", borderRadius: 3 }} />
      </div>
    </div>
  );
}

export const S6_VISUALS: Record<string, React.ComponentType> = {
  "s6-picker": CompoundPicker,
  "s6-raw-clean": RawVsCleaned,
  "s6-stepper": CleaningStepper,
  "s6-joined": () => <FeatureBarcode only={["LOW_", "MID_", "HIGH_", "precursor_mz"]} />,
  "s6-defect": MassDefectPlot,
  "s6-a-values": () => <SummaryCards group="A" />,
  "s6-formula": FormulaCandidates,
  "s6-losses": NeutralLossMirror,
  "s6-d-values": () => <SummaryCards group="D" />,
  "s6-barcode": () => <FeatureBarcode />,
};


/** The server page names a figure; the lookup happens here, because a map of components cannot cross from a client file to a server page. */
export function S6Visual({ name }: { name: string }) {
  const Visual = S6_VISUALS[name];
  return Visual ? <div className="s6-visual"><Visual /></div> : null;
}
