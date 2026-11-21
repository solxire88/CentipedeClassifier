import fs from "node:fs";
import path from "node:path";
import { parseScience } from "@/lib/prose";
import { FigureSlot, type FigureImage } from "@/components/longform";
import "katex/dist/katex.min.css";
import { FeatureStory, S6Visual } from "@/components/feature-visuals";
import { FamiliesSankey, HeroSpectrum } from "@/components/science-visuals";
import { ScrollProgress, TableOfContents } from "@/components/toc";

/** The images supplied for each figure slot of content/science.md. */
const FIGURES: Record<string, FigureImage[]> = {
  "IMG-S1": [{ src: "/science/mass-spectrometer.webp", alt: "Diagram of a mass spectrometer: the sample is vaporized and ionized by an electron beam, the ions are accelerated, bent by a magnetic field and counted at the detector." }],
  "IMG-S2": [{ src: "/science/dart-source.png", alt: "A DART ion source: a photo of the source in front of the instrument inlet, a diagram of its gas stream, heater and sample gap, and a mass spectrum with the [M+H]+ peak at 320." }],
  "IMG-S3": [
    { src: "/science/nmr-spectrum.png", alt: "A proton NMR spectrum of a short alcohol, with its structure drawn above the peaks." },
    { src: "/science/ir-spectrum.png", alt: "An infrared spectrum: transmittance against wavenumber." },
  ],
};

export const metadata = { title: "Science · CentipedeClassifier" };

export default function Science() {
  const md = fs.readFileSync(path.join(process.cwd(), "content", "science.md"), "utf8");
  const { hero, sections } = parseScience(md);
  const toc = [{ id: "s0", num: "S0", label: "Start" }, ...sections.map((s) => ({ id: s.id, num: s.num, label: s.heading.replace(/:.*$/, "") }))];
  return (
    <>
      <ScrollProgress />
      <div className="wrap page">
        <header className="hero" id="s0">
          <div className="ms-label">Science · S0</div>
          <h1 className="hero__title">{hero.title}</h1>
          <p className="hero__sub" dangerouslySetInnerHTML={{ __html: hero.sub }} />
          <HeroSpectrum />
        </header>
        <div className="results">
          <aside className="results__toc"><TableOfContents items={toc} /></aside>
          <div className="science__body">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="ssection">
                <div className="ms-label">{s.num}</div>
                <h2>{s.heading}</h2>
                {s.num === "S6" ? (
                  <FeatureStory>
                    {s.parts.map((p, i) => {
                      if ("html" in p) return <div key={i} className="prose measure" dangerouslySetInnerHTML={{ __html: p.html }} />;
                      return <S6Visual key={i} name={p.visual} />;
                    })}
                  </FeatureStory>
                ) : (
                  <div className="prose measure" dangerouslySetInnerHTML={{ __html: s.html }} />
                )}
                {s.image && <FigureSlot id={s.image.id} caption={s.image.caption} credit={s.image.credit} images={FIGURES[s.image.id]} />}
                {s.num === "S7" && <FamiliesSankey />}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
