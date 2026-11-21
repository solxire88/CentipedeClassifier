"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import { GithubMark } from "../github";
import { ConfidenceGauge } from "../classify-charts";
import { ScoreRuler, StatCounter } from "../longform";
import { ClassGlyph, FamilyChip, HonestyTag, cap } from "../marks";
import { Segmented } from "../ui";
import { API, CLASSES, ClassName, Tag } from "@/lib/api";
import { GITHUB } from "@/lib/links";
import { useInView } from "@/lib/browser";

type Peaks = [number, number][];
export type LandingData = {
  computed: string;
  model: { method: string; setting: string; threshold: number };
  scores: Record<string, number | string>;
  labels: { labeled: number; unlabeled: number; training: number; holdout: number; families: number; per_class: Record<string, number> };
  examples: { role: string; inchikey: string; name: string; true_class: ClassName; true_family: string; class: ClassName; family: string; confidence: number; uncertain: boolean; tag: Tag }[];
  mirror: { top: { name: string; precursor_mz: number; peaks: Peaks }; bottom: { name: string; precursor_mz: number; peaks: Peaks; similarity: number; tag: Tag }; shared: number[] };
};

const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmt = (n: number) => n.toLocaleString("en-US");

const noSubscribe = () => () => {};
/** False on the server and while hydrating, true afterwards: the reveal only hides content once the page can show it again. */
const useHydrated = () => useSyncExternalStore(noSubscribe, () => true, () => false);

/** Fades and lifts its content when it scrolls into view; `i` staggers siblings. Content is visible until the page has hydrated. */
function Reveal({ children, i = 0, className = "", as: Tag = "div" }: { children: React.ReactNode; i?: number; className?: string; as?: "div" | "li" }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const armed = useHydrated();
  const Wrapper = Tag as React.ElementType;
  return <Wrapper ref={ref} className={`${armed ? "lp-reveal" : ""}${seen ? " is-in" : ""} ${className}`} style={{ ["--i" as string]: i }}>{children}</Wrapper>;
}

/** One request to /health when the page opens: the free server wakes up while the visitor reads, so the classifier is ready when they get there. */
function WakeBackend() {
  useEffect(() => { fetch(`${API}/health`, { mode: "no-cors" }).catch(() => {}); }, []);
  return null;
}

function Section({ id, label, title, children, lead }: { id: string; label: string; title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section id={id} className="lp-section">
      <Reveal>
        <div className="ms-label">{label}</div>
        <h2 className="lp-h2">{title}</h2>
        {lead && <p className="lp-lead">{lead}</p>}
      </Reveal>
      {children}
    </section>
  );
}

// ---- hero ---------------------------------------------------------------------------------------
function MirrorHero({ m }: { m: LandingData["mirror"] }) {
  const [ref, seen] = useInView<HTMLElement>("0px 0px -5% 0px");
  const W = 1200, H = 340, L = 44, R = 16, T = 18, B = 30;
  const xMax = Math.ceil((Math.max(m.top.precursor_mz, m.bottom.precursor_mz) + 10) / 50) * 50;
  const x = (v: number) => L + (v / xMax) * (W - L - R);
  const mid = T + (H - T - B) / 2, half = (H - T - B) / 2 - 8;
  const peaks = (list: Peaks, dir: 1 | -1, color: string, dash?: string) => list.map(([mz, raw], i) => {
    const v = raw / Math.max(...list.map((p) => p[1]));   // each spectrum drawn relative to its strongest peak
    const shared = m.shared.includes(Math.round(mz)) && v >= 0.1;
    return <line key={i} className="lp-peak" x1={x(mz)} x2={x(mz)} y1={mid} y2={mid - dir * v * half} stroke={color} strokeWidth={shared ? 2.4 : 1.6} strokeDasharray={dash} opacity={shared ? 1 : 0.55}
      style={{ transformOrigin: `${x(mz)}px ${mid}px`, animationDelay: `${120 + i * 18}ms` }} />;
  });
  const topMax = Math.max(...m.top.peaks.map((p) => p[1]));
  const labelled = m.top.peaks.filter(([mz]) => m.shared.includes(Math.round(mz))).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <figure ref={ref} className={`lp-figure ms-chart${seen ? " is-in" : ""}`}>
      <ul className="ms-legend" aria-label="Legend" style={{ marginBottom: 8 }}>
        <li><svg width="26" height="10" aria-hidden style={{ flex: "none" }}><line x1="2" x2="24" y1="5" y2="5" stroke="#2a78d6" strokeWidth="2.5" /></svg>{m.top.name} (above)</li>
        <li><svg width="26" height="10" aria-hidden style={{ flex: "none" }}><line x1="2" x2="24" y1="5" y2="5" stroke="#eb6834" strokeWidth="2.5" strokeDasharray="5 2" /></svg>{m.bottom.name}, its nearest neighbour in the library (below)</li>
      </ul>
      <svg className="lp-mirror" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mirror plot of the HIGH spectra of ${m.top.name} and ${m.bottom.name}. They share peaks at m/z ${m.shared.join(", ")}.`} style={{ display: "block", width: "100%", height: "auto" }}>
        <line className="axis" x1={L} x2={W - R} y1={mid} y2={mid} />
        {Array.from({ length: xMax / 50 + 1 }, (_, i) => i * 50).map((t) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="lbl">{t}</text>)}
        <text x={W - R} y={H - 24} textAnchor="end" className="lbl lbl--sans">m/z</text>
        {peaks(m.top.peaks, 1, "#2a78d6")}
        {peaks(m.bottom.peaks, -1, "#eb6834", "5 2")}
        {labelled.map(([mz, v]) => <text key={mz} className="lp-peaklabel lbl lbl--strong" x={x(mz)} y={mid - (v / topMax) * half - 8} textAnchor="middle">{Math.round(mz)}</text>)}
      </svg>
      <figcaption>
        A spectrum mirrored against its nearest neighbour (cosine similarity {m.bottom.similarity.toFixed(2)}). Peaks that both share are drawn bolder; that pattern is what the model learns from.
      </figcaption>
    </figure>
  );
}

const FEATURES = 3929;   // 1,951 spectrum numbers + 6 + 10 + 1,950 + 12 (see the steps below)

function Hero({ d }: { d: LandingData }) {
  const s = d.scores as Record<string, number>;
  const stats: [string, string][] = [
    [f2(s.drug_f1), "macro-F1 on unseen compounds"],
    [fmt(s.holdout_compounds), "held-out compounds"],
    [fmt(FEATURES), "features per spectrum"],
    [`${d.labels.families} → 7`, "families → classes"],
  ];
  return (
    <section id="top" className="lp-hero">
      {/* eslint-disable @next/next/no-img-element */}
      <img className="lp-logo on-dark" src="/brand/centipede-C-segments-sharp-white-horizontal.svg" alt="CentipedeClassifier" />
      <img className="lp-logo on-light" src="/brand/centipede-C-segments-sharp-black-horizontal.svg" alt="" aria-hidden />
      {/* eslint-enable @next/next/no-img-element */}
      <p className="ms-label">Semi-supervised learning · NIST DART-MS Forensics library</p>
      <h1 className="lp-title">Read a drug’s class from its broken pieces.</h1>
      <p className="lp-sub">Mass-spectrum classification with an honest confidence.</p>
      <div className="lp-actions">
        <Link className="ms-btn ms-btn--primary lp-btn" href="/classify">Open the classifier<ArrowRight className="ms-icon" aria-hidden /></Link>
        <a className="ms-btn ms-btn--secondary lp-btn" href="#numbers">See the results</a>
        <a className="ms-btn ms-btn--quiet lp-btn" href={GITHUB} target="_blank" rel="noreferrer"><GithubMark />GitHub</a>
      </div>
      <dl className="lp-stats">
        {stats.map(([value, what]) => <div key={what}><dt className="ms-mono">{value}</dt><dd>{what}</dd></div>)}
      </dl>
      <MirrorHero m={d.mirror} />
    </section>
  );
}

// ---- worked examples ----------------------------------------------------------------------------
const ANSWER_LABEL = ["Correct call", "Abstention", "Confident miss"];
const ANSWER_NOTE = [
  "A high-confidence prediction that matches the reference label.",
  "Below the threshold the model abstains and reports its closest class instead: an informative outcome, not a failure to answer.",
  "A high confidence is evidence, not proof: a confident prediction can still disagree with the reference label.",
];

function Answers({ d }: { d: LandingData }) {
  const [i, setI] = useState(0);
  const e = d.examples[i], threshold = d.model.threshold;
  const right = !e.uncertain && e.class === e.true_class;
  return (
    <Section id="demo" label="Worked examples" title="Each prediction comes with a confidence score."
      lead={<>The model abstains below a confidence of {f2(threshold)}. Three compounds withheld from training are shown against their reference labels.</>}>
      <Segmented label="Example" value={String(i)} onChange={(v) => setI(Number(v))}
        options={d.examples.map((_, k) => ({ value: String(k), label: ANSWER_LABEL[k] }))} />
      <div className="lp-answer" key={i}>
        <div className={`ms-verdict${e.uncertain ? " is-uncertain" : ""}`} data-class={e.uncertain ? undefined : e.class}>
          <div className="ms-verdict__body">
            <span className="ms-label">{e.uncertain ? "Abstention" : "Predicted class and family"}</span>
            {e.uncertain ? (
              <>
                <div className="ms-verdict__word"><span>Uncertain</span></div>
                <div className="ms-verdict__family">Confidence below the threshold.</div>
                <div className="ms-verdict__closest">Closest class: {e.class} ({f2(e.confidence)})</div>
              </>
            ) : (
              <>
                <div className="ms-verdict__word"><ClassGlyph name={e.class} /><span>{cap(e.class)}</span></div>
                <div className="ms-verdict__family">{e.family}</div>
              </>
            )}
          </div>
          <ConfidenceGauge value={e.confidence} threshold={threshold} uncertain={e.uncertain} cls={e.class} />
        </div>
        <div className="ms-card lp-truth">
          <span className="ms-label">Input: {e.name}, from the library</span>
          <div className="ms-row"><HonestyTag tag={e.tag} /><span className="ms-mono ms-muted" style={{ fontSize: 12 }}>confidence {e.confidence.toFixed(3)}</span></div>
          <div className="lp-truthline">Reference: <ClassGlyph name={e.true_class} /> <b>{e.true_class}</b> · <FamilyChip family={e.true_family} cls={e.true_class} /></div>
          <div className="lp-truthline"><b>{e.uncertain ? "Abstained" : right ? "Matches the reference" : "Disagrees with the reference"}</b></div>
          <p className="ms-muted lp-note">{ANSWER_NOTE[i]}</p>
        </div>
      </div>
    </Section>
  );
}

// ---- method -------------------------------------------------------------------------------------
const PARTS = [["Spectrum bins", 1951], ["A", 6], ["B", 10], ["C", 1950], ["D", 12]] as const;

function How({ d }: { d: LandingData }) {
  const total = PARTS.reduce((s, p) => s + p[1], 0);
  return (
    <Section id="how" label="Method" title="From a peak list to a family and a class.">
      <ol className="lp-steps">
        <Reveal as="li" i={0} className="ms-card">
          <span className="lp-num">01</span>
          <h3>Input: peak lists</h3>
          <p>Three fragmentation levels (LOW, MID, HIGH) and the precursor m/z, from positive-mode DART-MS.</p>
          <pre className="ms-mono lp-code" aria-label="An example of a peak list">{"m/z        intensity\n84.0808       6\n105.0699     62\n134.0964     12\n188.1434    100\n337.2274     38"}</pre>
        </Reveal>
        <Reveal as="li" i={1} className="ms-card">
          <span className="lp-num">02</span>
          <h3>Feature extraction: {fmt(total)} features</h3>
          <p>Each spectrum is cleaned, normalised and binned, then enriched with exact-mass descriptors: mass defect, candidate molecular formula, neutral losses and spectral summaries.</p>
          <div className="lp-bar" role="img" aria-label={`${fmt(total)} features in five groups: ${PARTS.map((p) => `${p[0]} ${p[1]}`).join(", ")}`}>
            {PARTS.map(([name, n], k) => <span key={name} style={{ flex: Math.max(n, 40), opacity: 1 - k * 0.15, ["--k" as string]: k }} title={`${name}: ${n} features`} />)}
          </div>
          <p className="ms-muted lp-note">1,951 spectral features + 6 + 10 + 1,950 + 12. <Link className="ms-link" href="/science#s6">Feature groups in detail</Link></p>
        </Reveal>
        <Reveal as="li" i={2} className="ms-card">
          <span className="lp-num">03</span>
          <h3>Semi-supervised classification</h3>
          <p>A logistic regression, trained by self-training on labeled and unlabeled spectra, predicts one of {d.labels.families} chemical families, aggregates them into 7 drug classes and reports a confidence.</p>
          <p className="ms-muted lp-note">Predictions below a confidence of {f2(d.model.threshold)} are reported as uncertain.</p>
        </Reveal>
      </ol>
    </Section>
  );
}

// ---- evaluation ---------------------------------------------------------------------------------
function Score({ d }: { d: LandingData }) {
  const s = d.scores as Record<string, number>;
  return (
    <Section id="numbers" label="Evaluation" title={`${pct(s.accuracy)} class accuracy on held-out compounds.`}
      lead={<>Final evaluation on {fmt(s.holdout_compounds)} compounds withheld from training and from model selection, scored once, with a 95% bootstrap interval.{" "}
        <Link className="ms-link" href="/results">Full results</Link></>}>
      <div className="lp-cards">
        <StatCounter value={s.drug_f1} what="holdout macro-F1" ctx={`95% interval ${f2(s.drug_f1_low)} to ${f2(s.drug_f1_high)}, ${fmt(s.holdout_compounds)} held-out compounds`} />
        <StatCounter value={Math.round(s.accuracy * 100)} decimals={0} suffix="%" what="class accuracy" ctx="over the seven drug classes" />
        <StatCounter value={s.guessing_drug_f1} what="majority-class baseline" ctx={`always predicting the most common class (${s.guessing_class})`} />
        <StatCounter value={s.cv_drug_f1} what="cross-validation macro-F1" ctx={`grouped folds, ± ${f2(s.cv_spread)}: consistent with the holdout`} />
      </div>
      <div className="ms-frame lp-ruler">
        <div className="ms-frame__head"><div><div className="ms-label">Macro-F1 on a 0 to 1 scale</div></div></div>
        <div className="ms-frame__body">
          <ScoreRuler score={s.drug_f1} lo={s.drug_f1_low} hi={s.drug_f1_high} label="Holdout macro-F1"
            refs={[{ value: s.cv_drug_f1, label: "Cross-validation" }, { value: s.guessing_drug_f1, label: "Baseline" }]} />
        </div>
      </div>
    </Section>
  );
}

// ---- scope --------------------------------------------------------------------------------------
function Limits({ d }: { d: LandingData }) {
  const s = d.scores as Record<string, number>;
  const cards: [string, string, string][] = [
    [pct(s.accuracy_answered), "Accuracy on answered compounds", `The model answers ${pct(1 - s.uncertain_share)} of held-out compounds and abstains on the rest. Of its answers, ${pct(s.accuracy_answered)} match the reference label, and ${s.strong_right} of ${s.strong_answered} at a confidence of 0.80 or more.`],
    [`${d.labels.families} → 7`, "Coverage", `${d.labels.families} chemical families grouped into 7 drug classes. Compounds outside them, including ordinary medicines that resemble drugs, are handled less reliably: abstention rises only from ${pct(s.normal_uncertain)} to ${pct(s.unseen_uncertain)} for classes withheld from training, and the heterogeneous “other” class reaches ${pct(s.other_recall)} recall at ${pct(s.other_precision)} precision.`],
    ["3 levels", "Measurement domain", "Positive-mode DART-MS spectra at the library’s LOW, MID and HIGH fragmentation levels."],
    ["Screening", "Intended use", "A prediction is a ranked hypothesis from the spectrum. Identification still requires confirmation with reference methods."],
  ];
  return (
    <Section id="limits" label="Scope" title="Built for screening, with its boundaries stated."
      lead="Where the model applies, how it behaves at the edges, and how each prediction is qualified.">
      <div className="lp-fair" aria-label="Every prediction states its evidential status">
        <span className="ms-label">Each prediction states its evidential status</span>
        <HonestyTag tag="held_out" /><HonestyTag tag="training" /><HonestyTag tag="unlabeled" />
        <span className="ms-chip">Uncertain</span>
      </div>
      <div className="lp-limits lp-limits--four">
        {cards.map(([big, title, text], k) => (
          <Reveal key={title} i={k % 2} className="ms-card">
            <div className="ms-mono lp-big">{big}</div>
            <h3>{title}</h3>
            <p>{text}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ---- training data ------------------------------------------------------------------------------
function Learned({ d }: { d: LandingData }) {
  const l = d.labels;
  const max = Math.max(...Object.values(l.per_class));
  const order = [...CLASSES].sort((a, b) => (l.per_class[b] ?? 0) - (l.per_class[a] ?? 0));
  return (
    <Section id="classes" label="Training data" title={`${fmt(l.labeled + l.unlabeled)} spectra, ${fmt(l.labeled)} expert-labeled.`}
      lead={<>{fmt(l.labeled)} compounds were labeled by hand with one of {l.families} chemical families (7 drug classes). The other {fmt(l.unlabeled)} enter training as unlabeled spectra through semi-supervised learning.{" "}
        <Link className="ms-link" href="/science#s7">Labeling protocol</Link></>}>
      <p className="ms-mono ms-muted lp-split">{fmt(l.labeled)} labeled · {fmt(l.training)} training · {fmt(l.holdout)} held out · {fmt(l.unlabeled)} unlabeled</p>
      <ul className="ms-bars lp-classbars">
        {order.map((c, k) => (
          <li key={c} className="ms-bar" data-class={c} style={{ gridTemplateColumns: "minmax(120px, 170px) 1fr 52px" }}>
            <span className="ms-bar__name"><ClassGlyph name={c} />{c}</span>
            <span className="ms-bar__track"><i className="ms-bar__fill" style={{ ["--p" as string]: (l.per_class[c] ?? 0) / max, animation: `ms-grow var(--dur-reveal) var(--ease-standard) ${k * 40}ms both` }} /></span>
            <span className="ms-bar__val">{l.per_class[c]}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---- explore ------------------------------------------------------------------------------------
function Explore({ d }: { d: LandingData }) {
  const cards = [
    ["/library", fmt(d.labels.labeled + d.labels.unlabeled) + " compounds", "Library", "Spectra at three fragmentation levels with 2D and 3D structures."],
    ["/map", "Projection", "Map", "Every compound in one embedding: similar spectra cluster together."],
    ["/results", "R0 to R11", "Results", "The full evaluation: per-class scores, comparisons and thresholds."],
    ["/science", "S0 to S9", "Science", "Spectrometry, feature engineering and the learning method, step by step."],
  ];
  return (
    <Section id="explore" label="Explore" title="Inspect the library and the model.">
      <div className="lp-explore">
        {cards.map(([href, kicker, title, text], k) => (
          <Reveal key={href} i={k}>
            <Link href={href} className="ms-card lp-link">
              <span className="ms-mono ms-muted">{kicker}</span>
              <h3>{title}<ArrowRight className="ms-icon" aria-hidden /></h3>
              <p>{text}</p>
            </Link>
          </Reveal>
        ))}
      </div>
      <Reveal className="lp-cta">
        <h2 className="lp-h2">Classify a spectrum.</h2>
        <p className="lp-lead">Load a library example or paste peak lists for the three fragmentation levels. The first request may take up to a minute while the server starts.</p>
        <div className="lp-actions" style={{ marginBottom: 0 }}>
          <Link className="ms-btn ms-btn--primary lp-btn" href="/classify">Open the classifier<ArrowRight className="ms-icon" aria-hidden /></Link>
          <a className="ms-btn ms-btn--secondary lp-btn" href={GITHUB} target="_blank" rel="noreferrer"><GithubMark />Read the code on GitHub</a>
        </div>
      </Reveal>
      <p className="ms-muted lp-stamp">Figures on this page were computed with the final model on {d.computed}.</p>
    </Section>
  );
}

/** Marks the landing nav once the page is scrolled, and the in-page link of the section being read. */
function useNavState() {
  useEffect(() => {
    const nav = document.querySelector(".lp-nav");
    const ids = ["how", "numbers", "limits", "explore"];
    const update = () => {
      nav?.classList.toggle("is-scrolled", window.scrollY > 8);
      const line = window.innerHeight * 0.35;
      let active: string | null = null;
      for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= line) active = id; }
      document.querySelectorAll<HTMLAnchorElement>(".lp-links a").forEach((a) => { if (a.getAttribute("href") === `#${active}`) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
}

export function Landing({ data }: { data: LandingData }) {
  useNavState();
  return (
    <div className="lp wrap">
      <WakeBackend />
      <Hero d={data} />
      <Answers d={data} />
      <How d={data} />
      <Score d={data} />
      <Limits d={data} />
      <Learned d={data} />
      <Explore d={data} />
    </div>
  );
}
