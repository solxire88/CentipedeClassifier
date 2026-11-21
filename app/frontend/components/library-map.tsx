"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Search, ZoomIn, ZoomOut } from "lucide-react";
import { CLASSES, ClassName } from "@/lib/api";
import { ClassGlyph } from "./marks";

export type MapPoint = { inchikey: string; name: string; class: ClassName | null; family: string | null; tag: string; x: number; y: number };
export type Sample = { x: number; y: number; class: ClassName; name?: string };

const SHAPES: Record<ClassName, string> = {
  stimulant: "M5 0.8 9.6 9H0.4z", depressant: "M5 9.2 0.4 1h9.2z", opioid: "M5 0.8a4.2 4.2 0 1 0 0 8.4a4.2 4.2 0 1 0 0-8.4z",
  cannabinoid: "M1 1h8v8H1z", psychedelic: "M5 0.2 9.8 5 5 9.8 0.2 5z", dissociative: "M3.6 0.6h2.8v3h3v2.8h-3v3H3.6v-3h-3V3.6h3z", other: "M0.4 3.4h9.2v3.2H0.4z",
};
const PATHS = typeof Path2D === "undefined" ? null : Object.fromEntries(Object.entries(SHAPES).map(([k, d]) => [k, new Path2D(d)]));
const TAG_TEXT: Record<string, string> = { held_out: "held out", training: "used in training", unlabeled: "unlabeled" };
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** All library compounds on the PCA plane (canvas). Full mode has a legend, search and zoom; mini mode only marks one compound. */
export function LibraryMap({ points, mini, focusKey, sample, onFind, caption, tall }: {
  points: MapPoint[]; mini?: boolean; focusKey?: string | null; sample?: Sample | null; onFind?: () => void; caption?: React.ReactNode; tall?: boolean;
}) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ cx: 0, cy: 0, k: 1 });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<{ p: MapPoint; sx: number; sy: number } | null>(null);
  const [, setTheme] = useState(0);   // a theme change re-renders, and the canvas is drawn on every render
  const [pulse, setPulse] = useState(0);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Fit the view to the middle 98% of the compounds: a few outliers would otherwise squeeze everyone else into a corner.
  const b = useMemo(() => {
    const q = (v: number[], p: number) => { const a = [...v].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]; };
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99);
    return { mx: (x0 + x1) / 2, my: (y0 + y1) / 2, w: x1 - x0 || 1, h: y1 - y0 || 1 };
  }, [points]);
  const base = Math.min((size.w - 48) / b.w, (size.h - 48) / b.h) || 1;
  const toScreen = (p: { x: number; y: number }, v = view) => [size.w / 2 + ((p.x - b.mx) * base - v.cx) * v.k, size.h / 2 - ((p.y - b.my) * base - v.cy) * v.k] as const;
  const group = (p: MapPoint) => p.class ?? "unlabeled";

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setSize({ w: c.clientWidth, h: c.clientHeight }));
    ro.observe(c);
    const obs = new MutationObserver(() => setTheme((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { ro.disconnect(); obs.disconnect(); };
  }, []);

  // Centre on the focused compound (zoomed in on the full map).
  const focus = useMemo(() => points.find((p) => p.inchikey === focusKey) ?? null, [points, focusKey]);
  const focusId = focus && size.w ? focus.inchikey : null;
  const [centredOn, setCentredOn] = useState<string | null>(null);
  if (focus && focusId !== centredOn) {
    setCentredOn(focusId);
    if (focusId) setView(mini ? { cx: 0, cy: 0, k: 1 } : { cx: (focus.x - b.mx) * base, cy: (focus.y - b.my) * base, k: 3 });
  }
  useEffect(() => {
    if (!focus || !size.w || reduced()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => { setPulse((t - t0) / 1500); if (t - t0 < 1500) raf = requestAnimationFrame(tick); else setPulse(0); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [focus, size.w]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !size.w) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = size.w * ratio; c.height = size.h * ratio;
    const g = c.getContext("2d")!;
    g.scale(ratio, ratio);
    const css = getComputedStyle(document.documentElement);
    const col = (name: string) => css.getPropertyValue(name).trim();
    const on = (p: MapPoint, f: (sx: number, sy: number) => void) => {
      if (hidden.has(group(p))) return;
      const [sx, sy] = toScreen(p);
      if (sx > -8 && sy > -8 && sx < size.w + 8 && sy < size.h + 8) f(sx, sy);
    };
    const grow = 1 + Math.min(view.k - 1, 3) * 0.12;
    g.fillStyle = col("--unlabeled");
    for (const p of points) if (!p.class) on(p, (sx, sy) => { g.beginPath(); g.arc(sx, sy, 1.6 * grow, 0, 7); g.fill(); });
    for (const p of points) {
      if (!p.class) continue;
      g.fillStyle = col(`--class-${p.class}`);
      on(p, (sx, sy) => {
        if (view.k >= 3 && PATHS) { g.save(); g.translate(sx - 4.5, sy - 4.5); g.scale(0.9, 0.9); g.fill(PATHS[p.class!]); g.restore(); }
        else { g.beginPath(); g.arc(sx, sy, 2.6 * grow, 0, 7); g.fill(); }
      });
    }
    const ring = (sx: number, sy: number, r: number, glow = false) => {
      g.strokeStyle = col("--signal"); g.lineWidth = 2;
      if (glow) { const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4); gr.addColorStop(0, "rgba(244,247,251,.55)"); gr.addColorStop(1, "rgba(244,247,251,0)"); g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, r * 2.4, 0, 7); g.fill(); }
      g.beginPath(); g.arc(sx, sy, r, 0, 7); g.stroke();
    };
    const t = hover?.p ?? focus;
    if (t && !hidden.has(group(t))) { const [sx, sy] = toScreen(t); ring(sx, sy, 8 + (pulse > 0 && pulse < 1 ? Math.sin(pulse * Math.PI * 3) * 4 + 4 : 0)); }
    if (sample) { const [sx, sy] = toScreen(sample); ring(sx, sy, 7, true); g.fillStyle = col("--signal"); g.beginPath(); g.arc(sx, sy, 3.5, 0, 7); g.fill(); }
  }); // redraw on every render; the work is a few thousand dots

  const nearest = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect();
    const mx = clientX - r.left, my = clientY - r.top;
    let best: MapPoint | null = null, bd = 100, bx = 0, by = 0;
    for (const p of points) {
      if (hidden.has(group(p))) continue;
      const [sx, sy] = toScreen(p);
      const d = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d < bd) { bd = d; best = p; bx = sx; by = sy; }
    }
    return best ? { p: best, sx: bx, sy: by } : null;
  };
  const zoomAt = (sx: number, sy: number, factor: number) => setView((v) => {
    const k = Math.min(40, Math.max(0.2, v.k * factor));
    const nx = (sx - size.w / 2) / v.k + v.cx, ny = (size.h / 2 - sy) / v.k + v.cy;
    return { k, cx: nx - (sx - size.w / 2) / k, cy: ny - (size.h / 2 - sy) / k };
  });

  useEffect(() => {
    const c = canvas.current;
    if (!c || mini) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = c.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 0.87); };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  });

  const counts = useMemo(() => { const m: Record<string, number> = {}; for (const p of points) m[group(p)] = (m[group(p)] ?? 0) + 1; return m; }, [points]);
  const key = (e: React.KeyboardEvent) => {
    const step = 40 / view.k;
    if (e.key === "ArrowLeft") setView((v) => ({ ...v, cx: v.cx - step }));
    else if (e.key === "ArrowRight") setView((v) => ({ ...v, cx: v.cx + step }));
    else if (e.key === "ArrowUp") setView((v) => ({ ...v, cy: v.cy + step }));
    else if (e.key === "ArrowDown") setView((v) => ({ ...v, cy: v.cy - step }));
    else if (e.key === "+" || e.key === "=") zoomAt(size.w / 2, size.h / 2, 1.3);
    else if (e.key === "-") zoomAt(size.w / 2, size.h / 2, 0.77);
    else return;
    e.preventDefault();
  };

  const tip = hover ?? (focus && !mini ? (() => { const [sx, sy] = toScreen(focus); return { p: focus, sx, sy }; })() : null);
  return (
    <div className={`ms-map${tall ? " map-tall" : ""}`} style={mini ? { height: 300 } : undefined} data-map={mini ? "mini" : "full"}>
      <canvas ref={canvas} tabIndex={mini ? -1 : 0} role="img" aria-label={`Map of ${points.length} library compounds. Arrow keys move, plus and minus zoom. The library list has the same compounds as text.`}
        style={{ height: mini ? "100%" : undefined, touchAction: "pan-y", cursor: mini ? "pointer" : dragging ? "grabbing" : hover ? "pointer" : "grab" }}
        onKeyDown={mini ? undefined : key}
        onPointerDown={(e) => { if (e.pointerType === "touch") return; drag.current = { x: e.clientX, y: e.clientY, moved: false }; setDragging(true); (e.target as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && !mini) {
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
            d.x = e.clientX; d.y = e.clientY;
            setView((v) => ({ ...v, cx: v.cx - dx / v.k, cy: v.cy + dy / v.k }));
          } else if (!mini) setHover(nearest(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          const moved = drag.current?.moved; drag.current = null; setDragging(false);
          if (mini) { if (focusKey) router.push(`/map?focus=${focusKey}`); return; }
          if (!moved) { const n = nearest(e.clientX, e.clientY); if (n) router.push(`/library/${n.p.inchikey}`); }
        }}
        onPointerLeave={() => { drag.current = null; setDragging(false); setHover(null); }} />
      {!mini && (
        <div className="ms-map__legend">
          <ul className="ms-legend" aria-label="Classes">
            {[...CLASSES, "unlabeled" as const].map((c) => (
              <li key={c}>
                <button aria-pressed={!hidden.has(c)} data-class={c} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(c)) n.delete(c); else n.add(c); return n; })}>
                  {c === "unlabeled"
                    ? <svg className="ms-glyph" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.8" /></svg>
                    : <ClassGlyph name={c} />}
                  {c}<span className="ms-num">{(counts[c] ?? 0).toLocaleString("en-US")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!mini && (
        <div className="ms-map__tools">
          {onFind && <button className="ms-searchbtn" onClick={onFind}><Search className="ms-icon" aria-hidden />Find a compound</button>}
          <button className="ms-btn ms-btn--secondary ms-btn--sm ms-btn--icon" aria-label="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.4)}><ZoomIn className="ms-icon" aria-hidden /></button>
          <button className="ms-btn ms-btn--secondary ms-btn--sm ms-btn--icon" aria-label="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, 0.7)}><ZoomOut className="ms-icon" aria-hidden /></button>
          <button className="ms-btn ms-btn--secondary ms-btn--sm ms-btn--icon" aria-label="Reset the view" onClick={() => setView({ cx: 0, cy: 0, k: 1 })}><Maximize2 className="ms-icon" aria-hidden /></button>
        </div>
      )}
      {tip && !mini && (
        <div className="ms-tip is-on" role="status" style={{ left: Math.min(tip.sx, size.w - 260), top: tip.sy }}>
          <b>{tip.p.name}</b><br /><span>{tip.p.class ?? "unlabeled"}{tip.p.family ? ` · ${tip.p.family}` : ""} · {TAG_TEXT[tip.p.tag] ?? tip.p.tag}</span>
        </div>
      )}
      {sample && !mini && (() => { const [sx, sy] = toScreen(sample); return (
        <div className="ms-tip is-on" style={{ left: Math.min(sx + 8, size.w - 240), top: sy - 34 }}><b>Your sample</b><br /><span>closest neighbourhood: {sample.class}</span></div>
      ); })()}
      {caption && <div className="ms-map__cap">{caption}</div>}
    </div>
  );
}
