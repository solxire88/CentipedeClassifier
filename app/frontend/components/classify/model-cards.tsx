"use client";
import { ModelCard } from "@/lib/api";

const NAMES: Record<string, string> = { "self-training": "Self-training", "co-training": "Co-training", "label-spreading": "Label spreading", "cluster-then-label": "Cluster then label" };
export const modelName = (m: Pick<ModelCard, "method" | "setting">) => `${NAMES[m.method] ?? m.method}, ${m.setting}`;

/** The radio row of models. Only the final model was scored on the holdout (once); the other rows say "not scored". */
export function ModelCards({ models, value, onChange }: { models: ModelCard[]; value: string; onChange: (id: string) => void }) {
  const move = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = models[(i + d + models.length) % models.length];
    onChange(next.id);
    (e.currentTarget.parentElement?.children[(i + d + models.length) % models.length] as HTMLElement | undefined)?.focus();
  };
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }} data-tour="model">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span className="ms-label">Model</span>
        <span className="ms-muted" style={{ fontSize: 12, lineHeight: "16px" }}>{models.length || "Four"} methods were compared. Scores are macro-F1 over the six drug classes.</span>
      </div>
      <div role="radiogroup" aria-label="Model" style={{ display: "flex", gap: 16, overflowX: "auto", padding: "2px 2px 6px" }}>
        {models.length === 0 && [0, 1, 2, 3].map((i) => <div key={i} className="ms-skel" style={{ flex: "1 1 200px", minWidth: 200, height: 178 }} />)}
        {models.map((m, i) => (
          <button key={m.id} role="radio" aria-checked={value === m.id} tabIndex={value === m.id ? 0 : -1} className="ms-model"
            style={{ flex: "1 1 200px", width: "auto", minWidth: 200 }} onClick={() => onChange(m.id)} onKeyDown={(e) => move(e, i)}>
            <span className="ms-model__top"><span className="ms-model__name">{modelName(m)}</span><span className="ms-model__radio" aria-hidden /></span>
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {m.recommended && <span className="ms-badge ms-badge--solid">Recommended</span>}
              {m.holdout ? <span className="ms-badge">Scored on holdout</span> : <span className="ms-badge ms-badge--dashed">CV only</span>}
            </span>
            <dl>
              <dt>Approach</dt><dd>{m.target === "sum" ? "family → class" : "top family"}</dd>
              <dt>CV macro-F1</dt><dd>{m.cv_drug_f1?.toFixed(2)} <small>± {m.cv_spread?.toFixed(2)}</small></dd>
              <dt>Holdout macro-F1</dt><dd>{m.holdout ? <>{m.holdout.drug_f1.toFixed(2)} <small>({m.holdout.drug_f1_low.toFixed(2)}–{m.holdout.drug_f1_high.toFixed(2)})</small></> : <small>not scored</small>}</dd>
              <dt>Class accuracy</dt><dd>{m.holdout ? m.holdout.accuracy.toFixed(2) : <small>not scored</small>}</dd>
            </dl>
          </button>
        ))}
      </div>
    </section>
  );
}
