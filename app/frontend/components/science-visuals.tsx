"use client";
import { useEffect, useState } from "react";
import { useBackend } from "./backend";
import { SpectrumPlot } from "./spectrum";
import { Sankey } from "./longform";
import { Skeleton } from "./ui";
import { ClassName, Compound, LibraryItem, get } from "@/lib/api";

const FENTANYL = "PJMPHNIQZUBGLI-UHFFFAOYSA-N";

/** S0: fentanyl's HIGH spectrum from the library, drawing itself. */
export function HeroSpectrum() {
  const { state } = useBackend();
  const [c, setC] = useState<Compound | null>(null);
  useEffect(() => { if (state === "ready") get<Compound>(`/library/${FENTANYL}`).then(setC).catch(() => {}); }, [state]);
  return (
    <div className="ms-frame hero__frame">
      {c ? <SpectrumPlot peaks={c.spectra.HIGH.clean} precursor={c.precursor_mz} level="HIGH" cleaned name={c.name} /> : <div className="ms-frame__body"><Skeleton h={220} /></div>}
    </div>
  );
}

/** S7: labeled compounds per family flowing into the classes. */
export function FamiliesSankey() {
  const { state } = useBackend();
  const [fams, setFams] = useState<{ family: string; class: ClassName; count: number }[] | null>(null);
  useEffect(() => {
    if (state !== "ready") return;
    get<LibraryItem[]>("/library").then((lib) => {
      const m: Record<string, { family: string; class: ClassName; count: number }> = {};
      for (const c of lib) if (c.family && c.class) m[c.family] = { family: c.family, class: c.class, count: (m[c.family]?.count ?? 0) + 1 };
      setFams(Object.values(m));
    }).catch(() => {});
  }, [state]);
  return (
    <div className="ms-frame">
      <div className="ms-frame__head"><div>
        <div className="ms-label">S7 · families into classes</div>
        <p className="ms-frame__title">{fams ? `${fams.length} families → 7 classes` : "Families into classes"}</p>
        <p className="ms-frame__sub">Each band is drawn in its class colour; its width is the number of labeled compounds.</p>
      </div></div>
      <div className="ms-frame__body">{fams ? <Sankey families={fams} /> : <Skeleton h={500} />}</div>
      <div className="ms-frame__foot"><span>Source: data/labels/labels.csv · family_to_class.csv</span></div>
    </div>
  );
}
