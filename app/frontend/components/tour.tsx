"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui";

const STEPS = [
  { target: '[data-tour="model"]', title: "Pick a model", text: "Each card shows its cross-validated score. The one marked best in CV is selected first." },
  { target: '[data-tour="examples"]', title: "Load an example", text: "Start from a library compound: a clear win, a confident mistake or an uncertain one." },
  { target: '[data-tour="result"]', title: "Read the result", text: "The verdict, the confidence against the threshold, and whether the compound was a fair test." },
];

const Ctx = createContext<{ start: () => void }>({ start: () => {} });
export const useTour = () => useContext(Ctx);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const next = useRef<HTMLButtonElement>(null);

  const finish = useCallback(() => {
    setStep(null);
    try { localStorage.setItem("tour-done", "1"); } catch {}
  }, []);

  const start = useCallback(() => {
    if (location.pathname !== "/classify") { router.push("/classify"); setTimeout(() => setStep(0), 700); } else setStep(0);
  }, [router]);

  // First visit: show the tour once on the Classify page.
  useEffect(() => {
    if (path !== "/classify") return;
    let done = false;
    try { done = localStorage.getItem("tour-done") === "1"; } catch {}
    if (done) return;
    const t = setTimeout(() => setStep((s) => (s === null ? 0 : s)), 1500);
    return () => clearTimeout(t);
  }, [path]);

  const measure = useCallback(() => {
    if (step === null) return;
    const el = document.querySelector(STEPS[step].target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    if (step === null) return;
    const el = document.querySelector(STEPS[step].target);
    el?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    const first = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => { cancelAnimationFrame(first); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure); };
  }, [step, measure]);

  useEffect(() => {
    if (step === null) return;
    next.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, finish]);

  const s = step === null ? null : STEPS[step];
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const below = rect ? rect.bottom + 12 + 190 < vh : true;
  const card = rect
    ? { left: Math.min(Math.max(rect.left, 16), vw - 316), top: below ? rect.bottom + 12 : Math.max(16, rect.top - 12 - 170) }
    : { left: Math.max(16, vw / 2 - 150), top: 96 };

  return (
    <Ctx.Provider value={{ start }}>
      {children}
      {s && (
        <div role="dialog" aria-modal="false" aria-label={`Tour, step ${step! + 1} of ${STEPS.length}`} style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}>
          {rect && <div style={{ position: "fixed", left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 14, boxShadow: "0 0 0 2px var(--signal), 0 0 0 9999px var(--scrim)", transition: "all var(--dur-ui) var(--ease-standard)" }} />}
          {!rect && <div style={{ position: "fixed", inset: 0, background: "var(--scrim)" }} />}
          <div className="ms-tour" style={{ position: "fixed", left: card.left, top: card.top, pointerEvents: "auto" }}>
            <div className="ms-label">Step {step! + 1} of {STEPS.length}</div>
            <h4>{s.title}</h4>
            <p>{s.text}</p>
            <div className="ms-tour__foot">
              <span className="ms-steps" aria-hidden>{STEPS.map((_, i) => <i key={i} className={i === step ? "is-on" : ""} />)}</span>
              <span style={{ display: "flex", gap: 8 }}>
                <Button variant="quiet" size="sm" onClick={finish}>Skip</Button>
                <button ref={next} className="ms-btn ms-btn--primary ms-btn--sm" onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step! + 1))}>{step === STEPS.length - 1 ? "Done" : "Next"}</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
