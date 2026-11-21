"use client";
import { useEffect, useRef, useState } from "react";
import { CLASSES, ClassName, Peaks } from "@/lib/api";
import { ClassGlyph, FamilySwatch } from "./marks";
import { useFamilies } from "@/lib/families";
import { useReducedMotion } from "@/lib/browser";

/** Counts up to `value` once (the design's gauge number), or shows it at once under reduced motion. */
export function useCountUp(value: number, ms = 750) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduce]);
  return reduce ? value : v;
}

const C = { x: 74, y: 64, r: 56 };
const at = (v: number, r = C.r) => {
  const a = ((135 + 270 * v) * Math.PI) / 180;
  return [C.x + r * Math.cos(a), C.y + r * Math.sin(a)] as const;
};

/** 270 degree gauge with a tick at the threshold. `small` is the inline variant used in lists. */
export function ConfidenceGauge({ value, threshold, uncertain, cls, small }: {
  value: number; threshold: number; uncertain?: boolean; cls?: ClassName; small?: boolean;
}) {
  const shown = useCountUp(value);
  const [x0, y0] = at(0);
  const [x1, y1] = at(Math.min(Math.max(value, 0.001), 0.999));
  const track = `M${x0.toFixed(2)} ${y0.toFixed(2)} A${C.r} ${C.r} 0 1 1 ${at(1)[0].toFixed(2)} ${at(1)[1].toFixed(2)}`;
  const val = `M${x0.toFixed(2)} ${y0.toFixed(2)} A${C.r} ${C.r} 0 ${value > 2 / 3 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  const [ti, tj] = at(threshold, 48), [to, tp] = at(threshold, 64);
  return (
    <div className={`ms-gauge${small ? " ms-gauge--sm" : ""}${uncertain ? " is-uncertain" : ""}`} data-class={uncertain ? undefined : cls} role="img"
      aria-label={`Confidence ${value.toFixed(2)}, threshold ${threshold.toFixed(2)}`}>
      <svg width={small ? 56 : 148} height={small ? 48 : 128} viewBox="0 0 148 128">
        <path className="track" d={track} />
        <path className="value" d={val} pathLength={1} strokeDasharray={uncertain ? undefined : 1} strokeDashoffset={0}
          style={uncertain ? undefined : { animation: "ms-sweep var(--dur-reveal) var(--ease-standard) both" }} />
        <line className="tick" x1={ti} y1={tj} x2={to} y2={tp} />
        <text className="ticklabel" x={to - 7.4} y={tp - 7.7} textAnchor="end">{threshold.toFixed(2)}</text>
      </svg>
      <div className="ms-gauge__num">{shown.toFixed(2)}</div>
      <div className="ms-gauge__cap">confidence</div>
    </div>
  );
}

/** Seven sorted bars with a glyph, the threshold mark on the first bar, and arrow-key movement between bars. */
export function ClassBars({ probabilities, threshold }: { probabilities: Record<string, number>; threshold: number }) {
  const rows = CLASSES.map((c) => [c, probabilities[c] ?? 0] as const).sort((a, b) => b[1] - a[1]);
  const list = useRef<HTMLUListElement>(null);
  const move = (e: React.KeyboardEvent, i: number) => {
    const items = list.current?.querySelectorAll<HTMLElement>("li");
    if (!items) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), items.length - 1)].focus(); }
  };
  return (
    <ul className="ms-bars" ref={list}>
      {rows.map(([name, p], i) => (
        <li key={name} className={`ms-bar${i === 0 ? " is-top" : ""}`} data-class={name} tabIndex={0} aria-label={`${name}: ${p.toFixed(4)}`} title={`${name}: ${p.toFixed(4)}`} onKeyDown={(e) => move(e, i)}>
          <span className="ms-bar__name"><ClassGlyph name={name} />{name}</span>
          <span className="ms-bar__track">
            {i === 0 && <i className="ms-bar__thr" style={{ left: `${threshold * 100}%` }} />}
            <i className="ms-bar__fill" data-variant={1} style={{ ["--p" as string]: p, animation: `ms-grow var(--dur-reveal) var(--ease-standard) ${i * 40}ms both` }} />
          </span>
          <span className="ms-bar__val">{p.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

export function FamilyBars({ families }: { families: { family: string; class: ClassName; probability: number }[] }) {
  const info = useFamilies();
  return (
    <ul className="ms-bars ms-bars--family">
      {families.map((f, i) => (
        <li key={f.family} className={`ms-bar${i === 0 ? " is-top" : ""}`} data-class={f.class} tabIndex={0} aria-label={`${f.family}: ${f.probability.toFixed(4)}`} title={`${f.family}: ${f.probability.toFixed(4)}`}>
          <span className="ms-bar__name"><FamilySwatch family={f.family} />{f.family}</span>
          <span className="ms-bar__track">
            <i className="ms-bar__fill" data-variant={info[f.family]?.variant ?? 1} style={{ ["--p" as string]: f.probability, animation: `ms-grow var(--dur-reveal) var(--ease-standard) ${i * 40}ms both` }} />
          </span>
          <span className="ms-bar__val">{f.probability.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tiny spectrum for one level: baseline plus one line per peak (cleaned intensity, scaled to the strongest). */
export function Sparkline({ peaks, w = 280, h = 26 }: { peaks: Peaks; w?: number; h?: number }) {
  if (peaks.length === 0) return <div className="ms-minispec is-empty">no peaks</div>;
  const maxMz = Math.max(...peaks.map((p) => p[0]), 100) * 1.05;
  const maxI = Math.max(...peaks.map((p) => p[1]), 1e-9);
  return (
    <div className="ms-minispec">
      <svg className="ms-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden style={{ width: "100%", height: h, display: "block" }}>
        <path d={`M0 ${h - 0.5}H${w}`} stroke="currentColor" strokeOpacity={0.35} />
        {peaks.map(([mz, i], k) => <path key={k} d={`M${(mz / maxMz) * w} ${h - 0.5}V${h - 0.5 - (i / maxI) * (h - 4)}`} stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />)}
      </svg>
    </div>
  );
}
