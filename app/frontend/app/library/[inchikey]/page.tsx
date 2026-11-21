"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AudioWaveform, Check, Copy, Info, Link2, X } from "lucide-react";
import { WarmUp, useBackend } from "@/components/backend";
import { ConfidenceGauge } from "@/components/classify-charts";
import { LibraryMap, MapPoint } from "@/components/library-map";
import { ClassChip, FamilyChip, HonestyTag } from "@/components/marks";
import { Spark, SpectrumPlot } from "@/components/spectrum";
import { Structure } from "@/components/structure";
import { Button, LinkButton, Segmented, Skeleton, useToast } from "@/components/ui";
import { modelName } from "@/components/classify/model-cards";
import { Compound, LEVELS, Level, ModelCard, Neighbour, Tag, get } from "@/lib/api";

const NOTE: Record<Tag, string> = {
  held_out: "This compound was held out: not used to train or choose the model, so its predictions here are a fair test.",
  training: "The model saw this compound in training, so its predictions here are not a fair test.",
  unlabeled: "This compound is unlabeled: it was used without its label, so there is no true answer to compare with.",
};

function Formula({ text }: { text: string }) {
  return <span>{text.split(/(\d+)/).map((p, i) => (i % 2 ? <sub key={i}>{p}</sub> : p))}</span>;
}

function SimCards({ items }: { items: Neighbour[] }) {
  return (
    <div className="simgrid">
      {items.map((n) => (
        <Link key={n.inchikey} href={`/library/${n.inchikey}`} className="simcard" data-class={n.class ?? undefined}>
          <div className="simcard__top"><span className="simcard__name">{n.name}</span><span className="simcard__score">{n.similarity.toFixed(2)}</span></div>
          <div className="ms-row">{n.family && n.class && <FamilyChip family={n.family} cls={n.class} />}<HonestyTag tag={n.tag} /></div>
          <Spark spark={n.spark} precursor={n.precursor_mz} w={180} h={26} />
        </Link>
      ))}
    </div>
  );
}

function Detail() {
  const { inchikey } = useParams<{ inchikey: string }>();
  const { state } = useBackend();
  const toast = useToast();
  const [loaded, setLoaded] = useState<{ key: string; compound: Compound } | null>(null);
  const c = loaded?.key === inchikey ? loaded.compound : null;   // the compound of the address, never a stale one
  const [models, setModels] = useState<ModelCard[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [level, setLevel] = useState<Level>("HIGH");
  const [cleaned, setCleaned] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (state !== "ready") return;
    get<Compound>(`/library/${inchikey}`).then((compound) => setLoaded({ key: inchikey, compound })).catch(() => setMissing(true));
    get<ModelCard[]>("/models").then(setModels).catch(() => {});
    get<MapPoint[]>("/map").then(setPoints).catch(() => {});
  }, [state, inchikey]);

  const copy = (text: string, message: string) => navigator.clipboard?.writeText(text).then(() => toast({ message, kind: "ok" })).catch(() => toast({ message: "Could not copy to the clipboard.", kind: "error" }));

  if (missing) return <div className="wrap page"><div className="pagehead"><h1>Compound not found</h1><p><Link className="ms-link" href="/library">Back to the library</Link></p></div></div>;
  if (state !== "ready") return <div className="wrap page"><WarmUp /></div>;
  if (!c) return <div className="wrap page"><Skeleton h={44} className="" /><div style={{ height: 24 }} /><Skeleton h={420} /></div>;

  const labeled = c.tag !== "unlabeled" && c.class;
  return (
    <div className="wrap page">
      <Link className="crumb" href="/library">‹ Library</Link>
      <header className="ms-dhead" data-class={c.class ?? undefined}>
        <div>
          <div className="ms-row"><HonestyTag tag={c.tag} /><ClassChip name={c.class} />{c.family && c.class && <FamilyChip family={c.family} cls={c.class} />}</div>
          <h1>{c.name}</h1>
          <div className="ms-dhead__meta"><Formula text={c.formula} /><span>precursor m/z <b>{c.precursor_mz.toFixed(4)}</b></span><span>exact mass <b>{c.exact_mass.toFixed(4)}</b></span></div>
        </div>
        <div className="ms-row">
          <LinkButton variant="primary" href={`/classify?load=${c.inchikey}`}><AudioWaveform className="ms-icon" aria-hidden />Classify this</LinkButton>
          <Button onClick={() => copy(location.href, "Link copied")}><Link2 className="ms-icon" aria-hidden />Copy link</Button>
          <LinkButton external href={`https://pubchem.ncbi.nlm.nih.gov/#query=${c.inchikey}`}>PubChem</LinkButton>
        </div>
      </header>
      <div className="detail-note"><Info className="ms-icon" aria-hidden /><span>{NOTE[c.tag]}</span></div>

      <div className="detail-top">
        <div className="ms-frame">
          <div className="ms-frame__head">
            <div>
              <div className="ms-label">Mass spectrum</div>
              <p className="ms-frame__title">Fragmentation fingerprint</p>
              <p className="ms-frame__sub">Intensity as a percent of the strongest peak. Positive-mode DART-MS [M+H]⁺.</p>
            </div>
            <div className="ms-row" style={{ gap: 8 }}>
              <Segmented label="Fragmentation level" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
              <Segmented label="Processing" value={cleaned ? "clean" : "raw"} onChange={(v) => setCleaned(v === "clean")} options={[{ value: "raw", label: "RAW" }, { value: "clean", label: "CLEANED" }]} />
            </div>
          </div>
          <SpectrumPlot peaks={c.spectra[level][cleaned ? "clean" : "raw"]} precursor={c.precursor_mz} level={level} cleaned={cleaned} name={c.name} />
        </div>
        <div className="stack">
          <div className="ms-frame">
            <div className="ms-frame__head"><div><div className="ms-label">Structure</div></div></div>
            <div className="ms-frame__body"><Structure key={c.inchikey} molblock={c.molblock} svg={c.svg2d} /></div>
          </div>
          <div className="ms-card">
            <div className="ms-label" style={{ marginBottom: 12 }}>Facts</div>
            <dl className="ms-facts">
              <dt>Formula</dt><dd>{c.formula}</dd>
              <dt>Exact mass</dt><dd>{c.exact_mass.toFixed(4)}</dd>
              <dt>Precursor m/z</dt><dd>{c.precursor_mz.toFixed(4)} <span className="ms-muted" style={{ fontFamily: "var(--font-sans)" }}>[M+H]⁺</span></dd>
              <dt>InChIKey</dt><dd>{c.inchikey}<Button variant="quiet" size="sm" icon aria-label="Copy InChIKey" onClick={() => copy(c.inchikey, "InChIKey copied")}><Copy className="ms-icon" aria-hidden /></Button></dd>
              <dt>SMILES</dt><dd>{c.smiles}</dd>
              {c.synonyms.length > 0 && <><dt>Synonyms</dt><dd style={{ fontFamily: "var(--font-sans)" }}>{c.synonyms.slice(0, 6).join(", ")}</dd></>}
            </dl>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section__head"><h2>Model predictions</h2><span className="ms-muted">{labeled ? "true label known" : "no true label"} · confidence against each model&apos;s threshold ({(models.find((m) => m.recommended) ?? models[0])?.threshold.toFixed(2) ?? "0.40"} for the recommended one)</span></div>
        <div className="ms-card">
          <div className="predrows">
            {models.map((m) => {
              const p = c.predictions[m.id];
              if (!p) return null;
              const right = labeled && p.class === c.class;
              return (
                <div key={m.id} className="predrow" data-class={p.class}>
                  <div className="predrow__model"><b>{modelName(m)}</b><small>{m.recommended ? "recommended · " : ""}{m.target === "sum" ? "family → class" : "top family"}</small></div>
                  <div className="predrow__pred">
                    {p.uncertain ? <span className="ms-chip ms-chip--uncertain"><span>Uncertain</span></span> : <ClassChip name={p.class} />}
                    <FamilyChip family={p.family} />
                  </div>
                  <ConfidenceGauge small value={p.confidence} threshold={m.threshold} uncertain={p.uncertain} cls={p.class} />
                  {labeled
                    ? p.uncertain ? <span className="ms-verify">no answer given</span>
                      : right ? <span className="ms-verify is-right"><Check className="ms-icon" aria-hidden />matches true label</span>
                      : <span className="ms-verify"><X className="ms-icon" aria-hidden />wrong</span>
                    : <span className="ms-muted" style={{ fontSize: 13 }}>no true label</span>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Similar compounds</h2><span className="ms-muted">cosine similarity of spectra · Tanimoto similarity of structures</span></div>
        <div className="simcols">
          <div className="simcol"><h3>By spectrum</h3><p>Nearest neighbours by fragmentation pattern.</p><SimCards items={c.neighbours} /></div>
          <div className="simcol"><h3>By structure</h3><p>Nearest neighbours by molecular shape.</p><SimCards items={c.structure_neighbours} /></div>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Place on the map</h2><LinkButton size="sm" external={false} href={`/map?focus=${c.inchikey}`}>Open the map</LinkButton></div>
        {points.length === 0 ? <Skeleton h={300} /> : (
          <LibraryMap mini points={points} focusKey={c.inchikey}
            caption={<>{c.name} {c.class ? <>sits among the {c.class} compounds when similar spectra are placed close together.</> : "is unlabeled, so it is drawn grey."}</>} />
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><Detail /></Suspense>;
}
