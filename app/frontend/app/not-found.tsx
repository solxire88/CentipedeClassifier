import Link from "next/link";

// An illustrative spectrum with a dashed ghost where a peak at m/z 404 should be (design 05, frame 4).
const PEAKS: [number, number][] = [[58, 0.12], [84, 0.3], [105, 0.62], [134, 0.22], [188, 1], [210, 0.16], [337, 0.44], [361, 0.08]];
const X = (mz: number) => 40 + (mz / 450) * 476, Y = (f: number) => 120 - f * 98;

export default function NotFound() {
  return (
    <div className="wrap page">
      <div className="ms-404">
        <div className="ms-chart" style={{ width: 560 }}>
          <svg viewBox="0 0 560 150" height={150} role="img" aria-label="A spectrum with a gap where the peak at m/z 404 should be" style={{ display: "block", width: "100%" }}>
            <line className="grid" x1={40} x2={516} y1={71} y2={71} /><text className="lbl" x={32} y={75} textAnchor="end">50</text>
            <line className="grid" x1={40} x2={516} y1={22} y2={22} /><text className="lbl" x={32} y={26} textAnchor="end">100</text>
            <line className="axis" x1={40} x2={516} y1={120} y2={120} />
            {[0, 50, 100, 150, 200, 250, 300, 350, 400, 450].map((t) => <g key={t}><line className="axis" x1={X(t)} x2={X(t)} y1={120} y2={124} /><text className="lbl" x={X(t)} y={136} textAnchor="middle">{t}</text></g>)}
            <text className="lbl lbl--sans" x={534} y={136}>m/z</text>
            {PEAKS.map(([mz, f], i) => <g key={mz} className="pk" style={{ ["--i" as string]: i }}><line x1={X(mz)} x2={X(mz)} y1={120} y2={Y(f)} /><circle cx={X(mz)} cy={Y(f)} r={2} /></g>)}
            <line x1={X(404)} x2={X(404)} y1={120} y2={Y(0.86)} stroke="var(--text-muted)" strokeWidth={1.25} strokeDasharray="3 4" />
            <circle cx={X(404)} cy={Y(0.86)} r={3} fill="none" stroke="var(--text-muted)" strokeDasharray="2 2" />
            <text className="lbl lbl--strong" x={X(404)} y={Y(0.86) - 8} textAnchor="middle">404</text>
          </svg>
        </div>
        <div className="ms-label">404 · no peak at this address</div>
        <h1>This page is a missing peak.</h1>
        <p>The address does not match any page or compound in the library.</p>
        <div className="ms-row"><Link className="ms-btn ms-btn--primary" href="/classify">Back to Classify</Link><Link className="ms-btn ms-btn--secondary" href="/library">Browse the library</Link></div>
      </div>
    </div>
  );
}
