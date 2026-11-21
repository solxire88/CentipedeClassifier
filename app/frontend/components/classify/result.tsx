"use client";
import { forwardRef } from "react";
import { Check, CircleSlash, Download, Share2, X } from "lucide-react";
import { Button } from "../ui";
import { ClassBars, ConfidenceGauge, FamilyBars } from "../classify-charts";
import { ClassChip, ClassGlyph, FamilyChip, HonestyTag, TAG_NOTE, cap } from "../marks";
import { ClassName, Prediction } from "@/lib/api";
import { useFamilies } from "@/lib/families";

const Label = ({ children }: { children: React.ReactNode }) => <span className="ms-label">{children}</span>;
const CardHead = ({ title, tag }: { title: string; tag?: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
    <Label>{title}</Label>{tag && <span className="ms-illus">{tag}</span>}
  </div>
);

export const Verdict = forwardRef<HTMLElement, { result: Prediction; modelLabel: string; onShare: () => void; onDownload: () => void; custom: boolean }>(
  function Verdict({ result, modelLabel, onShare, onDownload, custom }, ref) {
    const cls = result.class, top = result.top_families[0];
    return (
      <section ref={ref} className={`ms-verdict${result.uncertain ? " is-uncertain" : ""}`} data-class={result.uncertain ? undefined : cls}
        aria-label={result.uncertain ? `No answer given. Closest: ${cls}, confidence ${result.confidence.toFixed(2)}` : `Prediction: ${cls}, ${result.family}, confidence ${result.confidence.toFixed(2)}`}>
        <div className="ms-verdict__body">
          <Label>{result.uncertain ? "No answer given" : "Suggested class and family"}</Label>
          {result.uncertain ? (
            <>
              <div className="ms-verdict__word"><span>Uncertain</span></div>
              <div className="ms-verdict__family">The model is not sure.</div>
              <div className="ms-verdict__closest">Closest: {cls} ({result.confidence.toFixed(2)})</div>
            </>
          ) : (
            <>
              <div className="ms-verdict__word"><ClassGlyph name={cls} /><span>{cap(cls)}</span></div>
              <div className="ms-verdict__family">{result.family} <span className="ms-muted">· family, {top.probability.toFixed(2)}</span></div>
            </>
          )}
        </div>
        <ConfidenceGauge value={result.confidence} threshold={result.threshold} uncertain={result.uncertain} cls={cls} />
        <div className="ms-verdict__foot">
          <span className="ms-mono ms-muted">{modelLabel}</span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button variant="quiet" size="sm" onClick={onShare}><Share2 className="ms-icon" aria-hidden />{custom ? "Copy input" : "Share this result"}</Button>
            <Button variant="quiet" size="sm" onClick={onDownload}><Download className="ms-icon" aria-hidden />Download PNG</Button>
          </span>
        </div>
        <p className="ms-muted" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, lineHeight: "18px" }}>{result.provisional ? `Threshold ${result.threshold.toFixed(2)} was not tuned for this model: it is the default.` : `Threshold ${result.threshold.toFixed(2)}, chosen from cross-validation: below it the app says uncertain.`}</p>
      </section>
    );
  },
);

/** Tag, the true answer and whether the prediction matches. Only for compounds taken from the library. */
export function Honesty({ result }: { result: Prediction }) {
  const t = result.truth;
  if (!t) return null;
  const labeled = t.tag !== "unlabeled" && t.class;
  const right = result.class === t.class;
  let note = TAG_NOTE[t.tag];
  if (labeled && t.tag === "held_out" && result.uncertain)
    note = right
      ? `The closest guess, ${result.class}, was right, but the confidence is below the threshold, so no answer was given.`
      : `The closest guess, ${result.class}, would have been wrong. Saying "uncertain" was the right call here.`;
  return (
    <div className="ms-honesty">
      <HonestyTag tag={t.tag} label={t.tag === "held_out" ? "Held out · fair test" : undefined} />
      {labeled && (
        <span className="ms-honesty__truth"><span className="ms-muted">True:</span><ClassChip name={t.class as ClassName} />{t.family && <FamilyChip family={t.family} cls={t.class as ClassName} />}</span>
      )}
      {labeled && (
        result.uncertain ? <span className="ms-verify"><CircleSlash className="ms-icon" aria-hidden /><span>No answer was given</span></span>
          : right ? <span className="ms-verify is-right"><Check className="ms-icon" aria-hidden /><span>Matches the prediction</span></span>
          : <span className="ms-verify"><X className="ms-icon" aria-hidden /><span>Does not match the prediction</span></span>
      )}
      <div className="ms-honesty__note">{note}</div>
    </div>
  );
}

export function ProbabilityCards({ result }: { result: Prediction }) {
  const families = useFamilies();
  const inClass = Object.values(families).filter((f) => f.class === result.class).length;
  const maxFam = result.top_families[0]?.probability ?? 0;
  const note = result.uncertain
    ? `No family reaches ${((Math.floor(maxFam * 20) + 1) / 20).toFixed(2)}. The probability is spread thin, which is why no answer is given.`
    : result.target === "sum"
      ? `${cap(result.class)} ${result.class_probabilities[result.class]?.toFixed(2)} is the sum of its ${inClass || "several"} families.`
      : `The answer is the class of the single most likely family.`;
  return (
    <>
      <section className="ms-card">
        <CardHead title="Class probabilities" />
        <ClassBars probabilities={result.class_probabilities} threshold={result.threshold} />
        <div className="ms-help" style={{ marginTop: 16 }}>The seven probabilities add up to 1. The thin mark on the first bar is the {result.threshold.toFixed(2)} threshold.</div>
      </section>
      <section className="ms-card">
        <CardHead title="Top 5 families" />
        <FamilyBars families={result.top_families} />
        <div className="ms-help" style={{ marginTop: 16 }}>{note}</div>
      </section>
    </>
  );
}

export function ResultSkeleton() {
  const bar = (w: string, h = 8) => <div className="ms-skel" style={{ width: w, maxWidth: "100%", height: h }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }} aria-busy="true" aria-label="Classifying">
      <section className="ms-card" style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 24, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>{bar("160px", 10)}{bar("190px", 38)}{bar("230px", 14)}</div>
        <div className="ms-skel" style={{ width: 120, height: 120, borderRadius: "50%" }} />
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 16 }}>{bar("220px", 12)}{bar("120px", 24)}</div>
      </section>
      {[7, 5].map((n) => (
        <section key={n} className="ms-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {bar("150px", 10)}
          {Array.from({ length: n }, (_, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 40px", gap: 12 }}>{bar("100%", 10)}{bar(`${90 - i * 9}%`, 10)}{bar("100%", 10)}</div>)}
        </section>
      ))}
    </div>
  );
}
