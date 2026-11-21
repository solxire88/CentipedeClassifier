"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { WarmUp, useBackend } from "@/components/backend";
import { EmptyState, Skeleton, useToast } from "@/components/ui";
import { ModelCards, modelName } from "@/components/classify/model-cards";
import { InputCard, Parsed, parsePeaks, precursorState } from "@/components/classify/input-card";
import { Honesty, ProbabilityCards, ResultSkeleton, Verdict } from "@/components/classify/result";
import { MirrorCard } from "@/components/mirror";
import { CLASSES, Compound, LEVELS, Level, ModelCard, Prediction, get, peaksToText, post } from "@/lib/api";

const EMPTY: Record<Level, string> = { LOW: "", MID: "", HIGH: "" };

function Classify() {
  const { state } = useBackend();
  const params = useSearchParams();
  const toast = useToast();
  const [models, setModels] = useState<ModelCard[]>([]);
  const [model, setModel] = useState(params.get("model") ?? "");
  const [precursor, setPrecursor] = useState("");
  const [texts, setTexts] = useState<Record<Level, string>>(EMPTY);
  const [level, setLevel] = useState<Level>("HIGH");
  const [loaded, setLoaded] = useState<{ key: string; name: string } | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verdict = useRef<HTMLElement>(null);
  const autorun = useRef<string | null>(null);
  const ready = state === "ready";

  useEffect(() => {
    if (!ready) return;
    get<ModelCard[]>("/models").then((m) => {
      setModels([...m].sort((a, b) => Number(b.recommended) - Number(a.recommended) || (b.cv_drug_f1 ?? 0) - (a.cv_drug_f1 ?? 0)));
      setModel((cur) => (m.some((x) => x.id === cur) ? cur : m.find((x) => x.recommended)?.id ?? m[0]?.id ?? ""));
    }).catch(() => {});
  }, [ready]);

  const parsed = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l, parsePeaks(texts[l])])) as Record<Level, Parsed>, [texts]);
  const p = precursorState(precursor);
  const canRun = ready && !!model && p.state === "valid" && LEVELS.every((l) => parsed[l].peaks.length > 0 && !parsed[l].error);

  const load = useCallback(async (key: string) => {
    const c = await get<Compound>(`/library/${key}`);
    setPrecursor(String(c.precursor_mz));
    setTexts({ LOW: peaksToText(c.spectra.LOW.raw), MID: peaksToText(c.spectra.MID.raw), HIGH: peaksToText(c.spectra.HIGH.raw) });
    setLoaded({ key, name: c.name });
    setResult(null); setError(null); setLevel("HIGH");
    return c;
  }, []);

  const run = useCallback(async (override?: { precursor: string; texts: Record<Level, string>; key?: string; model?: string }) => {
    const o = override ?? { precursor, texts, key: loaded?.key, model };
    setBusy(true); setError(null);
    try {
      const r = await post<Prediction>("/predict", { model: o.model ?? model, precursor_mz: Number(o.precursor), low: o.texts.LOW, mid: o.texts.MID, high: o.texts.HIGH, inchikey: o.key });
      setResult(r);
      try { sessionStorage.setItem("sample", JSON.stringify({ x: r.map[0], y: r.map[1], class: r.class })); } catch {}
    } catch (e) { setError((e as Error).message); setResult(null); }
    setBusy(false);
  }, [precursor, texts, loaded, model]);

  // A shared link (?load=KEY&model=ID) opens the compound and classifies it once.
  const wanted = params.get("load");
  useEffect(() => {
    if (!wanted || !ready || !model || autorun.current === wanted) return;
    autorun.current = wanted;
    load(wanted).then((c) => run({ precursor: String(c.precursor_mz), texts: { LOW: peaksToText(c.spectra.LOW.raw), MID: peaksToText(c.spectra.MID.raw), HIGH: peaksToText(c.spectra.HIGH.raw) }, key: wanted, model }))
      .catch(() => setError("Could not load that compound."));
  }, [wanted, ready, model, load, run]);

  const edit = (l: Level, t: string) => { setTexts((x) => ({ ...x, [l]: t })); setLoaded(null); };
  const clear = () => { setPrecursor(""); setTexts(EMPTY); setLoaded(null); setResult(null); setError(null); };

  const share = async () => {
    try {
      if (loaded) {
        await navigator.clipboard.writeText(`${location.origin}/classify?load=${loaded.key}&model=${model}`);
        toast({ message: "Link copied", kind: "ok" });
      } else {
        await navigator.clipboard.writeText(`Precursor m/z ${precursor}\n${LEVELS.map((l) => `${l}\n${texts[l].trim()}`).join("\n")}`);
        toast({ message: "Input copied", kind: "ok" });
      }
    } catch { toast({ message: "Could not copy to the clipboard.", kind: "error" }); }
  };
  const download = async () => {
    if (!verdict.current || !result) return;
    try {
      const { toPng } = await import("html-to-image"); // loaded only when someone downloads
      const url = await toPng(verdict.current, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor });
      const a = document.createElement("a");
      a.href = url; a.download = `verdict-${result.uncertain ? "uncertain" : result.class}.png`; a.click();
    } catch { toast({ message: "Could not make the image.", kind: "error" }); }
  };

  const current = models.find((m) => m.id === model);

  return (
    <div className="wrap" style={{ paddingBlock: "40px 64px", display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 className="ms-serif" style={{ margin: 0, fontSize: 40, lineHeight: "44px", letterSpacing: "-0.005em" }}>Paste a mass spectrum, get a suggested drug class.</h1>
        <p className="ms-muted" style={{ margin: 0, maxWidth: "68ch" }}>
          The model suggests one of {CLASSES.length} classes and the family within it, says how sure it is, and says &quot;uncertain&quot; when it is not.
        </p>
      </header>

      <ModelCards models={models} value={model} onChange={(id) => { setModel(id); setResult(null); }} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "5 1 400px", minWidth: 0 }}>
          <InputCard precursor={precursor} onPrecursor={(v) => { setPrecursor(v); setLoaded(null); }} texts={texts} onText={edit} level={level} onLevel={setLevel}
            parsed={parsed} canRun={canRun} busy={busy} onRun={() => run()} loaded={loaded?.key} backendReady={ready}
            onPick={() => window.dispatchEvent(new CustomEvent("palette:open", { detail: { compoundsOnly: true, onPick: (k: string) => load(k).catch(() => setError("Could not load that compound.")) } }))}
            onClear={clear} onExample={(k) => load(k).catch(() => setError("Could not load that compound."))} />
        </div>
        <div style={{ flex: "7 1 520px", minWidth: 0 }} data-tour="result">
          {!ready ? <WarmUp /> : busy ? <ResultSkeleton /> : error ? (
            <section className="ms-verdict is-error" role="alert">
              <TriangleAlert className="ms-icon ms-icon--lg" aria-hidden />
              <div>
                <span className="ms-label">Could not read the input</span>
                <div style={{ font: "500 16px/24px var(--font-sans)", margin: "4px 0" }}>{error}</div>
                <div className="ms-muted" style={{ fontSize: 14, lineHeight: "22px" }}>Fix the input and classify again.</div>
              </div>
            </section>
          ) : result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <Verdict ref={verdict} result={result} modelLabel={current ? modelName(current) : result.model} custom={!loaded} onShare={share} onDownload={download} />
              <Honesty result={result} />
              <ProbabilityCards result={result} />
            </div>
          ) : (
            <EmptyState
              icon={<svg className="art" viewBox="0 0 120 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden style={{ width: 120, height: 48 }}><path d="M4 44h112" /><path d="M16 44V30M28 44V18M40 44V34M52 44V10M64 44V28M76 44V22M88 44V36M100 44V26" strokeOpacity=".7" /><circle cx="52" cy="10" r="2" fill="currentColor" stroke="none" /></svg>}
              title="No result yet" text="Load an example or paste a spectrum, then press Classify." />
          )}
        </div>
      </div>

      {ready && busy && <Skeleton h={420} className="ms-frame" />}
      {ready && !busy && !error && result && <MirrorCard result={result} inputName={loaded?.name} />}
    </div>
  );
}

export default function Page() {
  return <Suspense><Classify /></Suspense>;
}
