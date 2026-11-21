"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { ClassGlyph, cap } from "./marks";
import { ClassName } from "@/lib/api";
import { useInView } from "@/lib/browser";
import { REFERENCES } from "@/lib/references";

type Filter = ClassName | "general" | "all";

/** The reference documents as a table, one block per class with its families. A class filter redraws the rows with a short staggered entrance. */
export function ReferenceDocuments() {
  const [filter, setFilter] = useState<Filter>("all");
  const [ref, seen] = useInView<HTMLDivElement>("0px 0px -8% 0px");
  const groups = REFERENCES.filter((g) => filter === "all" || g.key === filter);
  const total = REFERENCES.reduce((n, g) => n + g.documents.length, 0);
  let row = 0;
  return (
    <div ref={ref} className={`ms-frame refs${seen ? " is-in" : ""}`}>
      <div className="ms-frame__head">
        <div>
          <div className="ms-label">S7 · reference documents</div>
          <p className="ms-frame__title">{total} documents, mapped to the 7 classes</p>
          <p className="ms-frame__sub">Pick a class to see the documents that describe it and the chemical families it covers.</p>
        </div>
      </div>
      <div className="ms-frame__body">
        <ul className="ms-legend refs__filter" aria-label="Show the documents of a class">
          <li><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span className="ms-mono ms-muted">{total}</span></button></li>
          {REFERENCES.map((g) => (
            <li key={g.key}>
              <button type="button" aria-pressed={filter === g.key} data-class={g.key === "general" ? undefined : g.key} onClick={() => setFilter(filter === g.key ? "all" : g.key)}>
                {g.key === "general" ? <span className="refs__dash" aria-hidden /> : <ClassGlyph name={g.key} />}
                {g.key === "general" ? "All classes" : cap(g.key)} <span className="ms-mono ms-muted">{g.documents.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <div role="table" aria-label="Reference documents by class" className="refs__table" key={filter}>
          <div role="row" className="refs__row refs__row--head">
            <span role="columnheader">Class</span><span role="columnheader">Document</span><span role="columnheader">Publisher</span><span role="columnheader">Type</span><span role="columnheader">Year</span>
          </div>
          {groups.map((g) => (
            <div role="rowgroup" key={g.key} className="refs__group" data-class={g.key === "general" ? undefined : g.key}>
              {g.documents.map((d, i) => (
                <div role="row" key={d.url} className="refs__row" style={{ ["--i" as string]: row++ }}>
                  <span role="rowheader" className="refs__class">
                    {i === 0 && <>
                      <span className="refs__name">{g.key === "general" ? <span className="refs__dash" aria-hidden /> : <ClassGlyph name={g.key} />}{g.key === "general" ? "All classes" : cap(g.key)}</span>
                      <span className="refs__families">{g.families}</span>
                    </>}
                  </span>
                  <span role="cell" className="refs__doc"><a className="ms-link" href={d.url} target="_blank" rel="noreferrer">{d.title}<ArrowUpRight className="ms-icon" aria-hidden /></a></span>
                  <span role="cell" className="refs__pub">{d.publisher}</span>
                  <span role="cell" className="refs__kind">{d.kind}</span>
                  <span role="cell" className="refs__year ms-mono">{d.year}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="ms-frame__foot"><span>UNODC: United Nations Office on Drugs and Crime · WHO: World Health Organization · SWGDRUG: Scientific Working Group for the Analysis of Seized Drugs · WADA: World Anti-Doping Agency · EMCDDA and EUDA: the EU drugs agency</span></div>
    </div>
  );
}
