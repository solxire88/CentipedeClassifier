"use client";
import { ClassGlyph } from "@/components/marks";
import { useWidth } from "@/components/spectrum";
import { CLASSES, ClassName } from "@/lib/api";

const f2 = (v: number) => v.toFixed(2);

export type ThresholdRow = { threshold: number; answered_share: number; accuracy_answered: number };
export type RejectionRow = { left_out_class: ClassName; compounds: number; uncertain_share: number };
export type PerClassRow = { class: ClassName; compounds: number; precision: number; recall: number; f1: number; cv_recall: number };
export type HoldoutPrediction = { name: string; family: string; class: ClassName; predicted_family: string; predicted_class: ClassName; confidence: number; uncertain: boolean };

/** Share answered (solid, circles) and accuracy on the answered (dashed, squares) against the threshold; the chosen value is marked. */
export function ThresholdLines({ rows, chosen }: { rows: ThresholdRow[]; chosen: number }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width || 700, 320), H = 280, L = 40, R = 16, T = 16, B = 40;
  const lo = rows[0].threshold, hi = rows[rows.length - 1].threshold;
  const x = (t: number) => L + ((t - lo) / (hi - lo)) * (W - L - R);
  const y = (v: number) => H - B - v * (H - B - T);
  const series = [
    { key: "answered_share" as const, label: "share answered", dash: undefined, stroke: "var(--text)", square: false },
    { key: "accuracy_answered" as const, label: "accuracy on the answered", dash: "6 4", stroke: "var(--text-muted)", square: true },
  ];
  return (
    <div ref={box} className="ms-chart">
      <ul className="ms-legend" aria-label="Legend">
        <li style={{ whiteSpace: "nowrap" }}><svg width="28" height="10" aria-hidden><line x1="0" x2="28" y1="5" y2="5" stroke="var(--text)" strokeWidth="2" /><circle cx="14" cy="5" r="3.5" fill="var(--text)" /></svg>{series[0].label}</li>
        <li style={{ whiteSpace: "nowrap" }}><svg width="28" height="10" aria-hidden><line x1="0" x2="28" y1="5" y2="5" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="6 4" /><rect x="10.5" y="1.5" width="7" height="7" fill="var(--text-muted)" /></svg>{series[1].label}</li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label="Share answered and accuracy on the answered compounds against the confidence threshold" style={{ display: "block", width: "100%" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text className="lbl" x={L - 8} y={y(t) + 4} textAnchor="end">{t.toFixed(2)}</text></g>)}
        <line className="axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
        {rows.filter((_, i) => i % 2 === 0).map((r) => <text key={r.threshold} className="lbl" x={x(r.threshold)} y={H - B + 18} textAnchor="middle">{r.threshold.toFixed(2)}</text>)}
        <text className="lbl lbl--sans" x={(L + W - R) / 2} y={H - 4} textAnchor="middle">confidence threshold</text>
        <line x1={x(chosen)} x2={x(chosen)} y1={T} y2={H - B} stroke="var(--signal)" strokeWidth={1.5} />
        <text className="lbl lbl--sans lbl--strong" x={x(chosen) + 6} y={T + 10}>chosen: {chosen.toFixed(2)}</text>
        {series.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.stroke} strokeWidth={2} strokeDasharray={s.dash} points={rows.map((r) => `${x(r.threshold)},${y(r[s.key])}`).join(" ")} />
            {rows.map((r) => s.square
              ? <rect key={r.threshold} x={x(r.threshold) - 3.5} y={y(r[s.key]) - 3.5} width={7} height={7} fill={s.stroke}><title>{`threshold ${r.threshold.toFixed(2)}, ${s.label}: ${f2(r[s.key])}`}</title></rect>
              : <circle key={r.threshold} cx={x(r.threshold)} cy={y(r[s.key])} r={3.5} fill={s.stroke}><title>{`threshold ${r.threshold.toFixed(2)}, ${s.label}: ${f2(r[s.key])}`}</title></circle>)}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Share called uncertain when a class is left out of training, one bar per class; a tick marks the normal rate. */
export function UnseenBars({ rows, normal }: { rows: RejectionRow[]; normal: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ul className="ms-legend" aria-label="Legend">
        <li><i className="ms-fam" data-variant="1" style={{ ["--c" as string]: "var(--text)" }} />class left out of training</li>
        <li><svg width="14" height="14" aria-hidden><line x1="7" x2="7" y1="0" y2="14" stroke="var(--signal)" strokeWidth="2" /></svg>normal predictions ({Math.round(normal * 100)}%)</li>
      </ul>
      <ul className="ms-bars">
        {rows.map((r, i) => (
          <li key={r.left_out_class} className="ms-bar" data-class={r.left_out_class} tabIndex={0}
            title={`${r.left_out_class}: ${Math.round(r.uncertain_share * 100)}% of ${r.compounds} compounds called uncertain when the class was left out (normal predictions: ${Math.round(normal * 100)}%)`}>
            <span className="ms-bar__name"><ClassGlyph name={r.left_out_class} />{r.left_out_class}</span>
            <span className="ms-bar__track">
              <i className="ms-bar__fill" style={{ ["--p" as string]: r.uncertain_share, animation: `ms-grow var(--dur-reveal) var(--ease-standard) ${i * 40}ms both` }} />
              <i style={{ position: "absolute", top: -4, bottom: -4, left: `${normal * 100}%`, width: 2, background: "var(--signal)" }} />
            </span>
            <span className="ms-bar__val">{Math.round(r.uncertain_share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** True class in rows, the answer in columns; the shade is the share of the row, the number is the count. Hover lists the compounds. */
export function ConfusionMatrix({ rows }: { rows: HoldoutPrediction[] }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const n = CLASSES.length, side = Math.min(Math.max((width || 560) - 110, 280), 600), cell = side / n, L = 100, T = 8, H = T + side + 70;
  const cells = CLASSES.map((t) => CLASSES.map((p) => rows.filter((r) => r.class === t && r.predicted_class === p)));
  return (
    <div ref={box} className="ms-chart">
      <svg viewBox={`0 0 ${L + side + 8} ${H}`} height={H} role="img" aria-label="Confusion matrix of the holdout compounds: true class in rows, answer in columns" style={{ display: "block", width: "100%" }}>
        {CLASSES.map((t, i) => {
          const total = cells[i].reduce((s, c) => s + c.length, 0);
          return (
            <g key={t}>
              <text className="lbl lbl--sans" x={L - 8} y={T + i * cell + cell / 2 + 4} textAnchor="end">{t}</text>
              {CLASSES.map((p, j) => {
                const list = cells[i][j], share = total ? list.length / total : 0;
                return (
                  <g key={p}>
                    <rect x={L + j * cell + 1} y={T + i * cell + 1} width={cell - 2} height={cell - 2} rx={3} fill={`color-mix(in srgb, var(--text) ${Math.round(share * 85)}%, transparent)`} stroke="var(--border)" strokeWidth={1}>
                      <title>{`true ${t}, answer ${p}: ${list.length}${list.length ? "\n" + list.slice(0, 8).map((r) => r.name).join("\n") + (list.length > 8 ? "\n…" : "") : ""}`}</title>
                    </rect>
                    <text x={L + j * cell + cell / 2} y={T + i * cell + cell / 2 + 4} textAnchor="middle" className="lbl lbl--sans"
                      style={{ fill: share > 0.5 ? "var(--surface)" : "var(--text)", fontWeight: i === j ? 600 : 400, pointerEvents: "none" }}>{list.length}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
        {CLASSES.map((p, j) => <text key={p} className="lbl lbl--sans" textAnchor="end" transform={`translate(${L + j * cell + cell / 2 + 4} ${T + side + 14}) rotate(-40)`}>{p}</text>)}
        <text className="lbl lbl--sans lbl--strong" x={L + side / 2} y={H - 4} textAnchor="middle">answer</text>
        <text className="lbl lbl--sans lbl--strong" textAnchor="middle" transform={`translate(10 ${T + side / 2}) rotate(-90)`}>true class</text>
      </svg>
    </div>
  );
}

/** Recall per class: cross-validation (solid) beside the holdout (hatched). */
export function RecallCompare({ rows }: { rows: PerClassRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ul className="ms-legend" aria-label="Legend">
        <li><i className="ms-fam" data-variant="1" style={{ ["--c" as string]: "var(--text)" }} />cross-validation</li>
        <li><i className="ms-fam" data-variant="3" style={{ ["--c" as string]: "var(--text)" }} />holdout</li>
      </ul>
      {rows.map((r) => (
        <div key={r.class} style={{ display: "grid", gap: 4 }} data-class={r.class}>
          <span style={{ fontSize: 13, fontWeight: 500, display: "flex", gap: 6, alignItems: "center" }}><ClassGlyph name={r.class} />{r.class} <span className="ms-muted">· {r.compounds} holdout compounds</span></span>
          {([["cross-validation", r.cv_recall, 1], ["holdout", r.recall, 3]] as const).map(([k, v, variant]) => (
            <div key={k} className="ms-bar" data-class={r.class} style={{ gridTemplateColumns: "130px 1fr 44px", whiteSpace: "nowrap" }} title={`${r.class}, ${k}: recall ${f2(v)}`}>
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
