"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { glossary } from "@/lib/glossary";
import { CLASSES, ClassName } from "@/lib/api";
import { useWidth } from "./spectrum";

/** Dotted-underline term with a hover / focus definition and a Wikipedia link (glossary in lib/glossary.ts). */
export function Term({ k, children }: { k: string; children?: React.ReactNode }) {
  const g = glossary(k);
  if (!g) return <>{children ?? k}</>;
  return (
    <span className="ms-term" tabIndex={0}>
      {children ?? k}
      <span className="ms-pop" role="tooltip">
        <dfn>{g.term}</dfn>
        <span className="pop-d">{g.definition}</span>
        {g.link && <a className="ms-link ms-link--ext" href={g.link} target="_blank" rel="noreferrer">Read more<ArrowUpRight className="ms-icon" aria-hidden /></a>}
      </span>
    </span>
  );
}

/** Starts counting when the card scrolls into view (once), then holds the final value. */
function useCountWhenVisible(value: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setV(0);
    let raf = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => { const k = Math.min(1, (t - t0) / 750); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return [ref, v] as const;
}

export function StatCounter({ value, decimals = 2, suffix = "", what, ctx }: { value: number; decimals?: number; suffix?: string; what: string; ctx: string }) {
  const [ref, v] = useCountWhenVisible(value);
  return (
    <div className="ms-stat" ref={ref}>
      <div className="ms-stat__num">{v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</div>
      <div className="ms-stat__what">{what}</div>
      <div className="ms-stat__ctx">{ctx}</div>
    </div>
  );
}

/** 0 to 1 line: a dot for the score with a whisker for its spread, and reference ticks below. */
export function ScoreRuler({ score, lo, hi, label, refs }: { score: number; lo: number; hi: number; label: string; refs: { value: number; label: string }[] }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width || 710, 320), X0 = 16, X1 = W - 16;
  const x = (v: number) => X0 + v * (X1 - X0);
  const sorted = [...refs].sort((a, b) => a.value - b.value);
  const rows: number[] = [];
  sorted.forEach((r, i) => { rows[i] = i > 0 && x(r.value) - x(sorted[i - 1].value) < 130 && rows[i - 1] === 0 ? 1 : 0; });
  return (
    <div ref={box} className="ms-chart">
      <svg viewBox={`0 0 ${W} 132`} height={132} role="img" aria-label={`${label} ${score.toFixed(2)}, range ${lo.toFixed(2)} to ${hi.toFixed(2)}. ${refs.map((r) => `${r.label} ${r.value.toFixed(2)}`).join(", ")}.`} style={{ display: "block", width: "100%" }}>
        <line className="axis" x1={X0} x2={X1} y1={58} y2={58} />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}><line className="axis" x1={x(t)} x2={x(t)} y1={55} y2={61} /><text className="lbl" x={x(t)} y={76} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}>{t === 0 || t === 1 ? t : t.toFixed(2)}</text></g>
        ))}
        {sorted.map((r, i) => (
          <g key={r.label}>
            <line x1={x(r.value)} x2={x(r.value)} y1={51} y2={65} stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="2 2" />
            <line className="leader" x1={x(r.value)} x2={x(r.value)} y1={80} y2={90 + rows[i] * 16} />
            <text className="lbl lbl--sans" x={x(r.value)} y={104 + rows[i] * 16} textAnchor={x(r.value) < 80 ? "start" : x(r.value) > W - 80 ? "end" : "middle"}>{r.label} {r.value.toFixed(2)}</text>
          </g>
        ))}
        <g className="whisk" style={{ transformOrigin: `${x(score)}px 58px`, animation: "ms-grow var(--dur-reveal) var(--ease-standard) both" }}>
          <line x1={x(lo)} x2={x(hi)} y1={58} y2={58} stroke="var(--text)" strokeWidth={2} />
          <line x1={x(lo)} x2={x(lo)} y1={52} y2={64} stroke="var(--text)" strokeWidth={2} />
          <line x1={x(hi)} x2={x(hi)} y1={52} y2={64} stroke="var(--text)" strokeWidth={2} />
        </g>
        <circle cx={x(score)} cy={58} r={6} fill="var(--signal)" stroke="var(--surface)" strokeWidth={2} />
        <text className="lbl lbl--sans lbl--strong" x={x(score)} y={20} textAnchor="middle" style={{ fontWeight: 600, fontSize: 12 }}>{label} {score.toFixed(2)}</text>
        <line className="leader" x1={x(score)} x2={x(score)} y1={26} y2={49} />
      </svg>
    </div>
  );
}

/** Families on the left, classes on the right; band width = labeled compounds. "-other" families are drawn lighter. */
export function Sankey({ families }: { families: { family: string; class: ClassName; count: number }[] }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width || 670, 320);
  const [hover, setHover] = useState<string | null>(null);
  const layout = useMemo(() => {
    const order = [...families].sort((a, b) => CLASSES.indexOf(a.class) - CLASSES.indexOf(b.class) || a.family.localeCompare(b.family));
    const total = order.reduce((s, f) => s + f.count, 0);
    const GAP = 6, unit = Math.max(0.6, Math.min(1.1, 620 / total));
    const left: (typeof order[number] & { y: number; h: number })[] = [];
    let y = 12;
    for (const f of order) { const h = f.count * unit; left.push({ ...f, y, h }); y += h + GAP; }
    const height = y + 6;
    const classTotals = CLASSES.map((c) => ({ c, n: order.filter((f) => f.class === c).reduce((s, f) => s + f.count, 0) })).filter((c) => c.n > 0);
    const span = height - 24 - (classTotals.length - 1) * 18;
    const right: { c: ClassName; n: number; y: number; h: number }[] = [];
    let cy = 12;
    for (const { c, n } of classTotals) { const h = (n / total) * span; right.push({ c, n, y: cy, h }); cy += h + 18; }
    const used: Record<string, number> = {};
    const bands = left.map((f) => {
      const r = right.find((n) => n.c === f.class)!;
      const h2 = (f.count / r.n) * r.h;
      const y2 = r.y + (used[f.class] ?? 0);
      used[f.class] = (used[f.class] ?? 0) + h2;
      return { ...f, y2, h2 };
    });
    return { bands, right, height };
  }, [families]);
  const LX = Math.min(200, W * 0.36), RX = W - Math.min(160, W * 0.28);
  return (
    <div ref={box} className="ms-chart">
      <svg viewBox={`0 0 ${W} ${layout.height}`} height={layout.height} role="img" aria-label={`${families.length} families flowing into ${layout.right.length} classes`} style={{ display: "block", width: "100%" }}>
        {layout.bands.map((b) => {
          const light = b.family.endsWith("-other");
          const dim = hover && hover !== b.family && hover !== b.class;
          const mid = (LX + 10 + RX) / 2;
          const d = `M${LX + 10} ${b.y} C${mid} ${b.y} ${mid} ${b.y2} ${RX} ${b.y2} L${RX} ${b.y2 + b.h2} C${mid} ${b.y2 + b.h2} ${mid} ${b.y + b.h} ${LX + 10} ${b.y + b.h}Z`;
          return (
            <g key={b.family} data-class={b.class} className="band" style={{ opacity: dim ? 0.25 : 1, transition: "opacity var(--dur-ui) var(--ease-standard)" }}
              onMouseEnter={() => setHover(b.family)} onMouseLeave={() => setHover(null)}>
              <path d={d} fill="var(--c)" fillOpacity={light ? 0.14 : 0.3}><title>{`${b.family}: ${b.count} labeled compounds → ${b.class}`}</title></path>
              <rect x={LX} y={b.y} width={10} height={Math.max(b.h, 2)} rx={2} fill="var(--c)" fillOpacity={light ? 0.4 : 1} />
              <text className={`lbl lbl--sans${light ? "" : " lbl--strong"}`} x={LX - 10} y={b.y + b.h / 2 + 4} textAnchor="end">{b.family}<tspan dx={8} style={{ fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{b.count}</tspan></text>
            </g>
          );
        })}
        {layout.right.map((r) => (
          <g key={r.c} data-class={r.c} onMouseEnter={() => setHover(r.c)} onMouseLeave={() => setHover(null)}>
            <rect x={RX} y={r.y} width={10} height={r.h} rx={2} fill="var(--c)" />
            <text className="lbl lbl--sans lbl--strong" x={RX + 18} y={r.y + r.h / 2 + 4}>{r.c}<tspan dx={8} style={{ fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{r.n}</tspan></text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export type FigureImage = { src: string; alt: string };

/** A figure of the Science page: the supplied images (side by side when there are two), or the dashed slot while none is given. */
export function FigureSlot({ id, caption, credit, images }: { id: string; caption: string; credit?: string; images?: FigureImage[] }) {
  return (
    <figure className="ms-figure" style={images ? { maxWidth: "100%" } : undefined}>
      {images?.length ? (
        <div className="ms-figure__images" data-count={images.length}>
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.src} src={img.src} alt={img.alt} loading="lazy" />
          ))}
        </div>
      ) : (
        <div className="ms-figure__slot"><span className="ms-mono">{id} · image to add</span></div>
      )}
      <figcaption>{caption}{credit && <small>{credit}</small>}</figcaption>
    </figure>
  );
}
