"use client";
import { useEffect, useRef, useState } from "react";
import { Segmented } from "./ui";

/** Structure inside the design's viewer frame: 3D (3Dmol.js, STICK / SPHERE) or the 2D drawing, chosen with a 3D / 2D switch. */
export function Structure({ molblock, svg }: { molblock: string | null; svg: string | null }) {
  const [dim, setDim] = useState<"3d" | "2d">(molblock ? "3d" : "2d");
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<{ setStyle: (a: object, b: object) => void; render: () => void } | null>(null);
  const [style, setStyle] = useState<"stick" | "sphere">("stick");
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!molblock || !box.current) { setState("failed"); return; }
    let cancelled = false;
    let v: { clear: () => void } | null = null;
    setState("loading");
    import("3dmol").then((mod) => {
      if (cancelled || !box.current) return;
      const $3Dmol = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const created = $3Dmol.createViewer(box.current, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "white" });
      created.addModel(molblock, "mol");
      created.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.22 } });
      created.zoomTo(); created.render();
      viewer.current = created; v = created; setState("ready");
    }).catch(() => setState("failed"));
    return () => { cancelled = true; v?.clear(); viewer.current = null; };
  }, [molblock]);

  useEffect(() => {
    const c = viewer.current;
    if (!c) return;
    c.setStyle({}, style === "stick" ? { stick: { radius: 0.15 }, sphere: { scale: 0.22 } } : { sphere: { scale: 0.32 } });
    c.render();
  }, [style, state]);

  return (
    <div className="ms-viewer" style={{ width: "auto", maxWidth: "none", aspectRatio: "4 / 3" }}>
      <div ref={box} style={{ position: "absolute", inset: 0, visibility: dim === "3d" ? "visible" : "hidden" }} role="img" aria-label="3D structure. Drag to rotate, scroll to zoom." />
      {dim === "3d" && state === "loading" && <span className="ms-mono ms-muted" style={{ position: "relative" }}>Loading 3D structure…</span>}
      {dim === "3d" && state === "failed" && <span className="ms-muted" style={{ position: "relative", fontSize: 13 }}>No 3D structure available.</span>}
      {dim === "2d" && (svg
        ? <div role="img" aria-label="2D structure" className="ms-structure2d" dangerouslySetInnerHTML={{ __html: svg }}
            style={{ position: "absolute", inset: 0, padding: "48px 24px 32px", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center" }} />
        : <span className="ms-muted" style={{ position: "relative", fontSize: 13 }}>No 2D structure available.</span>)}
      <div className="ms-viewer__bar" style={{ zIndex: 2 }}>
        <Segmented label="Dimension" value={dim} onChange={setDim} options={[{ value: "3d", label: "3D" }, { value: "2d", label: "2D" }]} />
        {dim === "3d" && <Segmented label="Style" value={style} onChange={setStyle} options={[{ value: "stick", label: "STICK" }, { value: "sphere", label: "SPHERE" }]} />}
      </div>
      {dim === "3d" && <span className="ms-viewer__hint" style={{ zIndex: 2 }}>Drag · scroll</span>}
    </div>
  );
}
