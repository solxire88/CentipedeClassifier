"use client";
import { useRef } from "react";
import { Button, Segmented, TextField, Wave } from "../ui";
import { Sparkline } from "../classify-charts";
import { Check, TriangleAlert } from "lucide-react";
import { LEVELS, Level, Peaks } from "@/lib/api";
import { EXAMPLES } from "@/lib/examples";

export type Parsed = { peaks: Peaks; bad: number[]; error: string | null };

export function parsePeaks(text: string): Parsed {
  const peaks: Peaks = [];
  const bad: number[] = [];
  let error: string | null = null;
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    const parts = line.trim().split(/[\s,;]+/).filter(Boolean);
    const a = Number(parts[0]), b = Number(parts[1]);
    if (parts.length < 2) { bad.push(i); error ??= `Line ${i + 1} has one number; expected m/z and intensity.`; }
    else if (isNaN(a) || isNaN(b)) { bad.push(i); error ??= `Line ${i + 1} is not numeric: "${line.trim().slice(0, 30)}".`; }
    else if (a <= 0 || b < 0) { bad.push(i); error ??= `Line ${i + 1}: m/z must be positive and intensity must not be negative.`; }
    else peaks.push([a, b]);
  });
  return { peaks, bad, error };
}

export const precursorState = (v: string): { state?: "valid" | "error"; help?: string } => {
  if (!v.trim()) return {};
  const n = Number(v);
  if (isNaN(n)) return { state: "error", help: "That is not a number." };
  if (n < 50 || n >= 650) return { state: "error", help: "The precursor m/z must be between 50 and 650." };
  return { state: "valid", help: `Read as ${n}` };
};

function PeakList({ level, text, onText, onLevel, parsed }: { level: Level; text: string; onText: (t: string) => void; onLevel: (l: Level) => void; parsed: Parsed }) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = Math.max(text.split("\n").length, 7);
  return (
    <div className="ms-field" style={{ width: "100%" }}>
      <div className="ms-field__label" style={{ alignItems: "center" }}>
        <label htmlFor="peaks">Peak list</label>
        <Segmented label="Fragmentation level" value={level} onChange={onLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
      </div>
      <div className={`ms-peaks${parsed.error ? " is-error" : ""}`} style={{ height: 160 }}>
        <div className="ms-peaks__gutter" aria-hidden style={{ overflow: "hidden", height: "100%" }}><div ref={gutter}>{Array.from({ length: lines }, (_, i) => <span key={i} className={parsed.bad.includes(i) ? "is-bad" : undefined}>{i + 1}</span>)}</div></div>
        <textarea id="peaks" key={level} value={text} rows={7} spellCheck={false} wrap="off" aria-label={`${level} peak list`} aria-invalid={!!parsed.error} aria-describedby="peaks-help"
          placeholder={"m/z intensity\n135.08 100\n163.07 42"} onChange={(e) => onText(e.target.value)}
          onScroll={(e) => { if (gutter.current) gutter.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`; }} />
      </div>
      <div id="peaks-help" className={`ms-help${text.trim() ? (parsed.error ? " is-error" : " is-valid") : ""}`}>
        {text.trim() && (parsed.error ? <TriangleAlert className="ms-icon" aria-hidden /> : <Check className="ms-icon" aria-hidden />)}
        <span>{!text.trim() ? "One peak per line: m/z, then intensity. Paste all three levels." : parsed.error ?? `${parsed.peaks.length} peaks parsed`}</span>
      </div>
    </div>
  );
}

export function InputCard({ precursor, onPrecursor, texts, onText, level, onLevel, parsed, canRun, busy, onRun, onPick, onClear, loaded, onExample, backendReady }: {
  precursor: string; onPrecursor: (v: string) => void; texts: Record<Level, string>; onText: (l: Level, t: string) => void;
  level: Level; onLevel: (l: Level) => void; parsed: Record<Level, Parsed>; canRun: boolean; busy: boolean; onRun: () => void;
  onPick: () => void; onClear: () => void; loaded?: string; onExample: (key: string) => void; backendReady: boolean;
}) {
  const p = precursorState(precursor);
  return (
    <section className="ms-card" aria-label="Input" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
      <TextField id="precursor" label="Precursor m/z" unit="[M+H]⁺" inputMode="decimal" placeholder="e.g. 337.2274" value={precursor} onChange={(e) => onPrecursor(e.target.value)} state={p.state} help={p.help} />
      <PeakList level={level} text={texts[level]} onText={(t) => onText(level, t)} onLevel={onLevel} parsed={parsed[level]} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {LEVELS.map((l) => (
          <div key={l} style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
            <span className="ms-mono ms-muted">{l}</span>
            <Sparkline peaks={parsed[l].peaks} />
            <span className="ms-mono ms-muted" style={{ textAlign: "right", whiteSpace: "nowrap", minWidth: 64 }}>{parsed[l].peaks.length} peaks</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Button variant="primary" disabled={!canRun || busy} onClick={onRun} aria-busy={busy}>{busy ? <><Wave />Classifying</> : "Classify"}</Button>
          <Button disabled={!backendReady} onClick={onPick}>Load from library</Button>
          <Button variant="quiet" onClick={onClear}>Clear</Button>
        </div>
        <div className="ms-muted" style={{ fontSize: 12, lineHeight: "18px" }}>Positive-mode DART-MS [M+H]⁺, three in-source levels, 7 classes.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 20, borderTop: "1px solid var(--border)" }} data-tour="examples">
        <span className="ms-label">Try these</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXAMPLES.map((e) => (
            <button key={e.key} className="ms-chip ms-chip--filter" aria-pressed={loaded === e.key} disabled={!backendReady} title={e.note} onClick={() => onExample(e.key)}>
              <svg className="ms-mark" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="6.25" fill="currentColor" /><path d="M4 7.2 6.1 9.3 10 5.2" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span>{e.name}</span><span className="ms-num">{e.tag}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
