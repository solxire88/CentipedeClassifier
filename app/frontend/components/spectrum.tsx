"use client";
import { DATASET } from "@/lib/links";
import { useEffect, useMemo, useRef, useState } from "react";
import { Table2, ZoomOut } from "lucide-react";
import { Button } from "./ui";
import { Peaks } from "@/lib/api";

const PAD_L = 40, PAD_R = 44, TOP = 32, BASE = 190, H = 220;

function ticks(lo: number, hi: number) {
  const raw = (hi - lo) / 7;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Width of an element, kept up to date, so chart text stays 11 px instead of scaling with the card. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** One spectrum: peaks as lines with a dot, grid at 50 and 100 %, zoom by dragging, tooltip, arrow keys, table view. */
export function SpectrumPlot({ peaks, precursor, level, cleaned, name }: { peaks: Peaks; precursor: number; level: string; cleaned: boolean; name: string }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width || 636, 300);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [hover, setHover] = useState<{ mz: number; px: number } | null>(null);
  const [asTable, setAsTable] = useState(false);
  const svg = useRef<SVGSVGElement>(null);

  const data = useMemo(() => { const m = Math.max(...peaks.map((p) => p[1]), 1e-9); return peaks.map(([mz, i]) => ({ mz, f: i / m })); }, [peaks]);
  const [lastPeaks, setLastPeaks] = useState(peaks);   // a new spectrum resets the zoom
  if (peaks !== lastPeaks) { setLastPeaks(peaks); setRange(null); }

  const maxMz = Math.max(precursor, ...data.map((p) => p.mz), 50);
  const allTicks = ticks(0, maxMz * 1.25);
  const domainHi = allTicks.find((t) => t >= maxMz * 1.01) ?? maxMz * 1.05;
  const [lo, hi] = range ?? [0, domainHi];
  const x1 = W - PAD_R;
  const x = (mz: number) => PAD_L + ((mz - lo) / (hi - lo)) * (x1 - PAD_L);
  const inv = (px: number) => lo + ((px - PAD_L) / (x1 - PAD_L)) * (hi - lo);
  const visible = data.filter((p) => p.mz >= lo && p.mz <= hi);
  const strongest = [...data].sort((a, b) => b.f - a.f).slice(0, 3).filter((p) => p.f >= 0.25).map((p) => p.mz);
  const top = (f: number) => BASE - f * (BASE - TOP);

  const pxOf = (e: React.PointerEvent) => { const r = svg.current!.getBoundingClientRect(); return e.clientX - r.left; };
  const nearest = (mz: number) => {
    let best: (typeof data)[number] | null = null;
    for (const p of visible) if (!best || Math.abs(p.mz - mz) < Math.abs(best.mz - mz)) best = p;
    return best && Math.abs(best.mz - mz) < (hi - lo) / 90 ? best : null;
  };
  const onMove = (e: React.PointerEvent) => {
    const px = pxOf(e), mz = inv(px);
    if (drag) setDrag([drag[0], mz]);
    const p = nearest(mz);
    setHover(p ? { mz: p.mz, px: x(p.mz) } : null);
  };
  const end = () => {
    if (drag && Math.abs(drag[1] - drag[0]) > (hi - lo) / 40) setRange([Math.max(0, Math.min(...drag)), Math.max(...drag)]);
    setDrag(null);
  };
  const sorted = useMemo(() => [...visible].sort((a, b) => a.mz - b.mz), [visible]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setHover(null);
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const cur = hover?.mz ?? (e.key === "ArrowRight" ? -1 : Infinity);
    const next = e.key === "ArrowRight" ? sorted.find((p) => p.mz > cur) : [...sorted].reverse().find((p) => p.mz < cur);
    if (next) setHover({ mz: next.mz, px: x(next.mz) });
  };
  const hp = hover ? data.find((p) => p.mz === hover.mz) : null;
  const px = x(precursor);
  const note = cleaned ? "cleaned intensity (square root), % of strongest peak" : "intensity, % of strongest peak";

  return (
    <>
      <div className="ms-frame__body" style={{ paddingBottom: 8 }}>
        <div ref={box} className="ms-chart is-rise" key={`${level}-${cleaned}-${peaks.length}`}>
          {asTable ? (
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              <table className="ms-table"><thead><tr><th className="num">m/z</th><th className="num">Intensity %</th></tr></thead>
                <tbody>{[...data].sort((a, b) => b.f - a.f).slice(0, 60).map((p) => <tr key={p.mz}><td className="num">{p.mz.toFixed(3)}</td><td className="num">{(p.f * 100).toFixed(1)}</td></tr>)}</tbody></table>
            </div>
          ) : (
            <>
              <svg ref={svg} viewBox={`0 0 ${W} ${H}`} height={H} role="img" tabIndex={0} aria-label={`${name} ${level} spectrum, ${peaks.length} peaks. Use the left and right arrow keys to move between peaks.`}
                style={{ display: "block", width: "100%", touchAction: "pan-y" }} onPointerDown={(e) => { const mz = inv(pxOf(e)); setDrag([mz, mz]); }}
                onPointerMove={onMove} onPointerUp={end} onPointerLeave={() => { setHover(null); setDrag(null); }} onKeyDown={onKey}>
                <line className="grid" x1={PAD_L} x2={x1} y1={top(0.5)} y2={top(0.5)} /><text className="lbl" x={PAD_L - 8} y={top(0.5) + 4} textAnchor="end">50</text>
                <line className="grid" x1={PAD_L} x2={x1} y1={TOP} y2={TOP} /><text className="lbl" x={PAD_L - 8} y={TOP + 4} textAnchor="end">100</text>
                <text className="lbl lbl--sans" x={PAD_L} y={12}>{note} · {level}</text>
                <line className="axis" x1={PAD_L} x2={x1} y1={BASE} y2={BASE} />
                {allTicks.filter((t) => t >= lo && t <= hi).map((t) => (
                  <g key={t}><line className="axis" x1={x(t)} x2={x(t)} y1={BASE} y2={BASE + 4} /><text className="lbl" x={x(t)} y={206} textAnchor="middle">{t}</text></g>
                ))}
                <text className="lbl lbl--sans" x={x1 + 18} y={206}>m/z</text>
                {visible.map((p, i) => (
                  <g key={p.mz} className={`pk${hover?.mz === p.mz ? " is-on" : ""}`} style={{ ["--i" as string]: Math.min(i, 40) }}>
                    <line x1={x(p.mz)} x2={x(p.mz)} y1={BASE} y2={top(p.f)} /><circle cx={x(p.mz)} cy={top(p.f)} r={2} />
                  </g>
                ))}
                {visible.filter((p) => strongest.includes(p.mz)).map((p) => <text key={`l${p.mz}`} className="lbl lbl--strong" x={x(p.mz)} y={top(p.f) - 7} textAnchor="middle">{p.mz.toFixed(0)}</text>)}
                {precursor >= lo && precursor <= hi && (
                  <g>
                    <line className="leader" x1={px} x2={px} y1={BASE} y2={TOP + 6} strokeDasharray="3 3" />
                    <text className="lbl lbl--sans" x={px} y={TOP + 2} textAnchor={px > W - 130 ? "end" : "start"} dx={px > W - 130 ? -6 : 6}>precursor [M+H]⁺ {precursor.toFixed(2)}</text>
                  </g>
                )}
                {hover && <line className="cross" x1={hover.px} x2={hover.px} y1={TOP} y2={BASE} />}
                {drag && <rect x={x(Math.min(...drag))} width={Math.abs(x(drag[1]) - x(drag[0]))} y={TOP} height={BASE - TOP} fill="var(--text)" opacity={0.08} />}
              </svg>
              {hover && hp && (
                <div className="ms-tip is-on" role="status" style={{ left: Math.min(hover.px, W - 200), top: 40 }}>
                  <b>m/z {hp.mz.toFixed(3)}</b> <span>{(hp.f * 100).toFixed(0)}% · Δ {(precursor - hp.mz).toFixed(2)} from precursor</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="ms-frame__foot">
        <Button variant="quiet" size="sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}><Table2 className="ms-icon" aria-hidden />{asTable ? "View as chart" : "View as table"}</Button>
        {range && <Button variant="quiet" size="sm" onClick={() => setRange(null)}><ZoomOut className="ms-icon" aria-hidden />Reset zoom</Button>}
        <span>Source: <a className="ms-link" href={DATASET} target="_blank" rel="noreferrer">NIST DART-MS Forensics Database</a>. {peaks.length} peaks shown · drag to zoom.</span>
      </div>
    </>
  );
}

/** Six-line spectrum drawing for lists and cards: the ten strongest HIGH peaks of a compound. */
export function Spark({ spark, precursor, w = 96, h = 22 }: { spark: [number, number][]; precursor: number; w?: number; h?: number }) {
  const maxMz = Math.max(precursor * 1.04, ...spark.map((p) => p[0]), 60);
  return (
    <svg className="ms-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={`M0 ${h - 0.5}H${w}`} stroke="currentColor" strokeOpacity={0.35} fill="none" />
      {spark.map(([mz, f], i) => <path key={i} d={`M${((mz / maxMz) * w).toFixed(1)} ${h - 0.5}V${(h - 0.5 - f * (h - 3)).toFixed(1)}`} stroke="currentColor" strokeWidth={1.25} fill="none" />)}
    </svg>
  );
}
