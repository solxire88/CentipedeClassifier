"use client";
import Link from "next/link";
import { DATASET } from "@/lib/links";
import { useEffect, useMemo, useRef, useState } from "react";
import { Table2, ZoomOut } from "lucide-react";
import { Button, Segmented } from "./ui";
import { ClassName, Compound, LEVELS, Level, Neighbour, Peaks, Prediction, get } from "@/lib/api";
import { FamilyChip, HonestyTag } from "./marks";

const W = 1152, X0 = 40, X1 = 1108, YU = 158, YD = 174, TOP = 22, BOT = 310, H = 340, SHARED_TOL = 0.5;

function ticks(lo: number, hi: number) {
  const raw = (hi - lo) / 8;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

type P = { mz: number; f: number };
const scale = (peaks: Peaks): P[] => {
  const m = Math.max(...peaks.map((p) => p[1]), 1e-9);
  return peaks.map(([mz, i]) => ({ mz, f: i / m }));
};

export function MirrorCard({ result, inputName, levelState }: {
  result: Prediction; inputName?: string; levelState?: [Level, (l: Level) => void];
}) {
  const own = useState<Level>("HIGH");
  const [level, setLevel] = levelState ?? own;
  const [which, setWhich] = useState(0);
  const [cache, setCache] = useState<Record<string, Compound>>({});
  const [range, setRange] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [hover, setHover] = useState<{ mz: number; x: number; w: number; text: React.ReactNode } | null>(null);
  const [asTable, setAsTable] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const n = result.neighbours[which] as Neighbour | undefined;
  const nb = n ? cache[n.inchikey] : undefined;

  useEffect(() => {
    if (!n || cache[n.inchikey]) return;
    get<Compound>(`/library/${n.inchikey}`).then((c) => setCache((x) => ({ ...x, [n.inchikey]: c }))).catch(() => {});
  }, [n, cache]);

  const up = useMemo(() => scale(result.input_spectra[level]), [result, level]);
  const down = useMemo(() => (nb ? scale(nb.spectra[level].clean) : []), [nb, level]);
  const shared = useMemo(() => up.filter((p) => down.some((q) => Math.abs(q.mz - p.mz) <= SHARED_TOL)), [up, down]);

  const maxMz = Math.max(...up.map((p) => p.mz), ...down.map((p) => p.mz), 50);
  const allTicks = ticks(0, maxMz * 1.25);
  const domainHi = allTicks.find((t) => t >= maxMz * 1.01) ?? maxMz * 1.05; // the axis ends on the first tick past the last peak
  const ts = allTicks.filter((t) => t <= domainHi);
  const [lo, hi] = range ?? [0, domainHi];
  const x = (mz: number) => X0 + ((mz - lo) / (hi - lo)) * (X1 - X0);
  const inv = (px: number) => lo + ((px - X0) / (X1 - X0)) * (hi - lo);
  const visible = (p: P) => p.mz >= lo && p.mz <= hi;

  const strongest = [...up].sort((a, b) => b.f - a.f);
  const labelled = new Set(strongest.slice(0, 3).filter((p) => p.f >= 0.25).map((p) => p.mz));
  const topShared = strongest[0] && shared.includes(strongest[0]);
  const MAX_MARKS = 12; // with 200 peaks per spectrum a diamond on every shared peak hides the plot
  const marked = [...shared].sort((a, b) => b.f - a.f).slice(0, MAX_MARKS);
  const close = (n?.similarity ?? 0) >= 0.5;
  const finding = !nb ? "Loading the closest library spectrum…"
    : shared.length === 0 ? `No peaks line up within ${SHARED_TOL} m/z.${close ? "" : " Even the nearest library compound is not close, which fits an uncertain answer."}`
    : `${shared.length === 1 ? "One peak lines" : `${shared.length} peaks line`} up${topShared ? `, including the strongest, ${strongest[0].mz.toFixed(0)}` : ""}.`;

  const toSvg = (e: React.PointerEvent | React.MouseEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, px: e.clientX - r.left, w: r.width };
  };
  const describe = (mz: number) => {
    const a = up.find((p) => Math.abs(p.mz - mz) < 1e-6), b = down.find((p) => Math.abs(p.mz - mz) < 1e-6);
    return (
      <>
        <b>m/z {mz.toFixed(2)}</b> <span>{a ? `input ${(a.f * 100).toFixed(0)}%` : ""}{a && b ? " · " : ""}{b ? `${n?.name} ${(b.f * 100).toFixed(0)}%` : ""}</span>
      </>
    );
  };
  const nearest = (mz: number) => {
    let best: P | null = null;
    for (const p of [...up, ...down]) if (visible(p) && (!best || Math.abs(p.mz - mz) < Math.abs(best.mz - mz))) best = p;
    return best && Math.abs(best.mz - mz) < (hi - lo) / 80 ? best : null;
  };
  const onMove = (e: React.PointerEvent) => {
    const { x: sx, px } = toSvg(e);
    const mz = inv(sx);
    if (drag) setDrag([drag[0], mz]);
    const p = nearest(mz);
    setHover(p ? { mz: p.mz, x: px, w: svg.current?.getBoundingClientRect().width ?? 600, text: describe(p.mz) } : null);
  };
  const end = () => {
    if (drag && Math.abs(drag[1] - drag[0]) > (hi - lo) / 40) setRange([Math.min(...drag), Math.max(...drag)].map((v) => Math.max(0, v)) as [number, number]);
    setDrag(null);
  };
  const allMz = useMemo(() => [...new Set([...up, ...down].map((p) => p.mz))].sort((a, b) => a - b), [up, down]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setHover(null);
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const cur = hover?.mz ?? (e.key === "ArrowRight" ? -1 : Infinity);
    const next = e.key === "ArrowRight" ? allMz.find((m) => m > cur && m >= lo && m <= hi) : [...allMz].reverse().find((m) => m < cur && m >= lo && m <= hi);
    if (next !== undefined) { const w = svg.current?.getBoundingClientRect().width ?? W; setHover({ mz: next, x: (x(next) / W) * w, w, text: describe(next) }); }
  };

  const peakG = (p: P, i: number, dir: 1 | -1) => {
    const base = dir === 1 ? YU : YD;
    const end = dir === 1 ? base - p.f * (YU - TOP) : base + p.f * (BOT - YD);
    return (
      <g key={`${dir}-${p.mz}-${i}`} className={`pk${dir === -1 ? " down" : ""}${hover && Math.abs(hover.mz - p.mz) < 1e-6 ? " is-on" : ""}`} style={{ ["--i" as string]: Math.min(i, 30), ["--pk" as string]: dir === -1 ? "var(--c)" : undefined }}>
        <line x1={x(p.mz)} x2={x(p.mz)} y1={base} y2={end} />
        <circle cx={x(p.mz)} cy={end} r={2} />
      </g>
    );
  };

  const rows = [...shared.map((p) => ({ p, shared: true })), ...strongest.filter((p) => !shared.includes(p)).slice(0, 12).map((p) => ({ p, shared: false }))];

  return (
    <section className="ms-frame" data-class={n?.class ?? undefined} aria-label="Mirror plot">
      <div className="ms-frame__head">
        <div>
          <div className="ms-label">Most similar library compound</div>
          <h3 className="ms-frame__title">Your input against {n ? <Link href={`/library/${n.inchikey}`} className="ms-link">{n.name}</Link> : "…"}</h3>
          <p className="ms-frame__sub">{finding}</p>
          {n && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
              <span className="ms-mono">similarity {n.similarity.toFixed(2)}</span>
              {n.family && <FamilyChip family={n.family} cls={n.class as ClassName} />}
              <HonestyTag tag={n.tag} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Segmented label="Fragmentation level" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
            <Segmented label="Neighbour" value={String(which)} onChange={(v) => { setWhich(Number(v)); setRange(null); }}
              options={result.neighbours.map((_, i) => ({ value: String(i), label: ["1ST", "2ND", "3RD"][i] }))} />
          </div>
          {range && <Button size="sm" onClick={() => setRange(null)}><ZoomOut className="ms-icon" aria-hidden />Reset zoom</Button>}
          <Button size="sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}><Table2 className="ms-icon" aria-hidden />{asTable ? "View as chart" : "View as table"}</Button>
        </div>
      </div>
      <div className="ms-frame__body ms-chart is-rise" key={`${level}-${which}`}>
        {asTable ? (
          <div style={{ maxHeight: 340, overflow: "auto" }}>
            <table className="ms-table">
              <thead><tr><th className="num">m/z</th><th className="num">Input %</th><th className="num">{n?.name ?? "Library"} %</th><th>Shared</th></tr></thead>
              <tbody>
                {rows.map(({ p, shared: s }) => {
                  const q = down.find((d) => Math.abs(d.mz - p.mz) <= SHARED_TOL);
                  return <tr key={p.mz}><td className="num">{p.mz.toFixed(2)}</td><td className="num">{(p.f * 100).toFixed(0)}</td><td className="num">{q ? (q.f * 100).toFixed(0) : "·"}</td><td>{s ? "yes" : ""}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : !nb ? (
          <div className="ms-skel" style={{ height: 340 }} />
        ) : (
          <div style={{ position: "relative", overflowX: "auto" }}>
            <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} aria-label={`Mirror plot. Your input above, ${n?.name} below. ${finding} Use the arrow keys to move between peaks.`}
              style={{ display: "block", width: "100%", minWidth: 720, height: "auto", touchAction: "pan-y" }}
              onPointerDown={(e) => { const mz = inv(toSvg(e).x); setDrag([mz, mz]); }} onPointerMove={onMove} onPointerUp={end}
              onPointerLeave={() => { setHover(null); setDrag(null); }} onKeyDown={onKey}>
              {[[90, "50"], [242, "50"], [22, "100"], [310, "100"]].map(([y, l]) => (
                <g key={`${y}`}><line className="grid" x1={X0} x2={X1} y1={y} y2={y} /><text className="lbl" x={X0 - 8} y={Number(y) + 4} textAnchor="end">{l}</text></g>
              ))}
              <text className="lbl lbl--sans" x={X0} y={12}>cleaned intensity (square root), % of strongest peak</text>
              <line className="axis" x1={X0} x2={X1} y1={YU} y2={YU} /><line className="axis" x1={X0} x2={X1} y1={YD} y2={YD} />
              {ts.filter((t) => t >= lo && t <= hi).map((t) => <text key={t} className="lbl" x={x(t)} y={326} textAnchor="middle">{t}</text>)}
              <text className="lbl lbl--sans" x={1126} y={326}>m/z</text>
              {up.filter(visible).map((p, i) => peakG(p, i, 1))}
              {up.filter((p) => visible(p) && labelled.has(p.mz)).map((p) => <text key={`l-${p.mz}`} className="lbl lbl--strong" x={x(p.mz)} y={YU - p.f * (YU - TOP) - 7} textAnchor="middle">{p.mz.toFixed(0)}</text>)}
              {down.filter(visible).map((p, i) => peakG(p, i, -1))}
              {marked.filter(visible).map((p) => <rect key={`s-${p.mz}`} className="shared" x={x(p.mz) - 3} y={163} width={6} height={6} transform={`rotate(45 ${x(p.mz)} 166)`} />)}
              {hover && <line className="cross" x1={x(hover.mz)} x2={x(hover.mz)} y1={TOP} y2={BOT} />}
              {drag && <rect x={x(Math.min(...drag))} width={Math.abs(x(drag[1]) - x(drag[0]))} y={TOP} height={BOT - TOP} fill="var(--text)" opacity={0.08} />}
              <text className="lbl lbl--sans" x={X1} y={TOP + 14} textAnchor="end" fill="var(--text)">Your input</text>
              <text className="lbl lbl--sans" x={X1} y={BOT - 8} textAnchor="end" fill="var(--text)">{n?.name}</text>
            </svg>
            {hover && <div className="ms-tip is-on" style={{ left: Math.min(hover.x, hover.w - 220), top: "50%" }} role="status">{hover.text}</div>}
          </div>
        )}
      </div>
      <div className="ms-frame__foot">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="3" y="3" width="6" height="6" transform="rotate(45 6 6)" fill="var(--background)" stroke="var(--text)" strokeWidth="1.25" /></svg>
          shared peak (within {SHARED_TOL} m/z){shared.length > MAX_MARKS ? `, the ${MAX_MARKS} strongest marked` : ""}
        </span>
        <span>{result.excluded_self ? `${inputName ?? "This compound"} is in the library, so its own entry is left out of the neighbours.` : "Similarity is the cosine of the cleaned spectra (the three levels together)."}</span>
        <span className="ms-muted">Source: <a className="ms-link" href={DATASET} target="_blank" rel="noreferrer">NIST DART-MS Forensics Database</a></span>
      </div>
    </section>
  );
}
