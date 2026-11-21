"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search } from "lucide-react";
import { WarmUp, useBackend } from "@/components/backend";
import { ClassChip, ClassGlyph, FamilyChip, HonestyTag } from "@/components/marks";
import { Spark } from "@/components/spectrum";
import { Button, EmptyState, Segmented, Skeleton } from "@/components/ui";
import { CLASSES, LibraryItem, Tag, get } from "@/lib/api";

const ROW = 46, PROW = 72, VIEW = 640;
const TAGS: [Tag, string][] = [["held_out", "Held out"], ["training", "Used in training"], ["unlabeled", "Unlabeled"]];
const fmt = (n: number) => n.toLocaleString("en-US");

function TagMark({ tag }: { tag: Tag }) {
  return tag === "held_out"
    ? <svg className="ms-mark" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="6.25" fill="currentColor" /><path d="M4 7.2 6.1 9.3 10 5.2" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : tag === "training" ? <svg className="ms-mark" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="3.25" fill="currentColor" /></svg>
    : <svg className="ms-mark" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" /></svg>;
}

export default function Library() {
  const { state } = useBackend();
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [q, setQ] = useState("");
  const [classes, setClasses] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<"name" | "mz">("name");
  const [scroll, setScroll] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { if (state === "ready") get<LibraryItem[]>("/library").then(setItems).catch(() => {}); }, [state]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {}, t: Record<string, number> = {};
    for (const i of items ?? []) { c[i.class ?? "unlabeled"] = (c[i.class ?? "unlabeled"] ?? 0) + 1; t[i.tag] = (t[i.tag] ?? 0) + 1; }
    return { c, t };
  }, [items]);

  const rows = useMemo(() => {
    if (!items) return [];
    const query = q.trim().toLowerCase();
    const out = items.filter((c) => (!query || c.name.toLowerCase().includes(query) || c.formula.toLowerCase().includes(query)) && (classes.size === 0 || classes.has(c.class ?? "unlabeled")) && (tags.size === 0 || tags.has(c.tag)));
    return out.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.precursor_mz - b.precursor_mz));
  }, [items, q, classes, tags, sort]);

  // A change of filter or sort puts the list back at the top (the state is reset while rendering, the scroll box in an effect).
  const view = `${q}|${sort}|${[...classes].join()}|${[...tags].join()}`;
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) { setLastView(view); setScroll(0); }
  useEffect(() => { box.current?.scrollTo(0, 0); }, [view]);
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); setter(n); };
  const clear = () => { setQ(""); setClasses(new Set()); setTags(new Set()); };

  const first = Math.max(0, Math.floor(scroll / ROW) - 6);
  const last = Math.min(rows.length, first + Math.ceil(VIEW / ROW) + 12);
  const pfirst = Math.max(0, Math.floor(scroll / PROW) - 6);
  const plast = Math.min(rows.length, pfirst + Math.ceil(VIEW / PROW) + 12);
  const active = [...classes, ...[...tags].map((t) => TAGS.find(([k]) => k === t)![1])];

  return (
    <div className="wrap page">
      <div className="pagehead"><h1>Library</h1><p>Browse and search all {items ? fmt(items.length) : "1,570"} compounds, then pick one to test.</p></div>

      <div className="toolbar">
        <div className="toolbar__row">
          <label className="ms-field toolbar__search">
            <span className="ms-sr">Search compounds</span>
            <div style={{ position: "relative" }}>
              <Search className="ms-icon" aria-hidden style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
              <input className="ms-input" style={{ paddingLeft: 36, fontFamily: "var(--font-sans)" }} placeholder="Search by name or formula…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </label>
          <div className="ms-row" style={{ gap: 8 }}>
            <span className="ms-label" style={{ margin: 0 }}>Sort</span>
            <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: "name", label: "Name" }, { value: "mz", label: "m/z" }]} />
          </div>
        </div>
        <div className="toolbar__row">
          <div className="filterbar">
            <span className="ms-label" style={{ margin: "0 4px 0 0" }}>Class</span>
            {[...CLASSES, "unlabeled" as const].map((c) => (
              <button key={c} className="ms-chip ms-chip--filter" aria-pressed={classes.has(c)} data-class={c} onClick={() => toggle(classes, setClasses, c)}>
                {c === "unlabeled" ? <svg className="ms-glyph" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.8" /></svg> : <ClassGlyph name={c} />}
                {c}<span className="ms-num">{fmt(counts.c[c] ?? 0)}</span>
              </button>
            ))}
            <span className="sep" />
            <span className="ms-label" style={{ margin: "0 4px 0 0" }}>Tag</span>
            {TAGS.map(([t, label]) => (
              <button key={t} className="ms-chip ms-chip--filter" aria-pressed={tags.has(t)} onClick={() => toggle(tags, setTags, t)}><TagMark tag={t} />{label}</button>
            ))}
          </div>
        </div>
      </div>

      {state !== "ready" ? <WarmUp /> : !items ? <Skeleton h={VIEW} className="ms-card" /> : rows.length === 0 ? (
        <EmptyState icon={<Filter className="ms-icon ms-icon--lg" aria-hidden />} title="No compounds match"
          text={`Nothing fits ${q ? `“${q}”` : "that search"}${active.length ? ` with the ${active.join(" and ")} filter${active.length > 1 ? "s" : ""} on` : ""}.`}
          action={<Button size="sm" onClick={clear}>Clear filters</Button>} />
      ) : (
        <>
          <div className="ms-card ms-card--flush">
            <div className="ms-row" style={{ padding: "16px 24px", justifyContent: "space-between", gap: "4px 16px", borderBottom: "1px solid var(--border)" }}>
              <span className="counterline"><b>{fmt(items.length)}</b> compounds · <b>{fmt(counts.t.held_out ?? 0)}</b> held out · <b>{fmt(counts.t.training ?? 0)}</b> used in training · <b>{fmt(counts.t.unlabeled ?? 0)}</b> unlabeled</span>
              <span className="ms-muted" style={{ fontSize: 12 }}>showing {fmt(rows.length)}</span>
            </div>
            <div ref={box} className="only-desktop" style={{ maxHeight: VIEW, overflow: "auto" }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
              <table className="ms-table ms-table--rows ms-table--virtual">
                <thead>
                  <tr>
                    <th aria-sort={sort === "name" ? "ascending" : "none"} onClick={() => setSort("name")}>Name{sort === "name" ? " ↑" : ""}</th>
                    <th>Formula</th><th className="num" aria-sort={sort === "mz" ? "ascending" : "none"} onClick={() => setSort("mz")}>Precursor m/z{sort === "mz" ? " ↑" : ""}</th>
                    <th>Family</th><th>Class</th><th>Tag</th><th>HIGH spectrum</th><th><span className="ms-sr">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {first > 0 && <tr className="spacer" aria-hidden><td colSpan={8} style={{ height: first * ROW }} /></tr>}
                  {rows.slice(first, last).map((c) => (
                    <tr key={c.inchikey} tabIndex={0} data-class={c.class ?? "unlabeled"} onClick={() => router.push(`/library/${c.inchikey}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/library/${c.inchikey}`); }}>
                      <td className="name">{c.name}</td>
                      <td className="ms-mono">{c.formula}</td>
                      <td className="num">{c.precursor_mz.toFixed(4)}</td>
                      <td>{c.family && c.class ? <FamilyChip family={c.family} cls={c.class} /> : <span className="ms-muted">—</span>}</td>
                      <td>{c.class ? <ClassChip name={c.class} /> : <span className="ms-muted">—</span>}</td>
                      <td><HonestyTag tag={c.tag} /></td>
                      <td><Spark spark={c.spark} precursor={c.precursor_mz} /></td>
                      <td style={{ textAlign: "right" }}><Link className="ms-btn ms-btn--secondary ms-btn--sm rowact" href={`/classify?load=${c.inchikey}`} onClick={(e) => e.stopPropagation()}>Classify</Link></td>
                    </tr>
                  ))}
                  {last < rows.length && <tr className="spacer" aria-hidden><td colSpan={8} style={{ height: (rows.length - last) * ROW }} /></tr>}
                </tbody>
              </table>
            </div>
            <div className="only-phone" style={{ maxHeight: VIEW, overflow: "auto", padding: "0 16px" }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
              <div className="plist" style={{ paddingTop: pfirst * PROW, paddingBottom: (rows.length - plast) * PROW }}>
                {rows.slice(pfirst, plast).map((c) => (
                  <Link key={c.inchikey} href={`/library/${c.inchikey}`} className="prow">
                    <span className="prow__main"><span className="prow__name">{c.name}</span><span className="prow__meta"><span>{c.formula}</span><span>{c.precursor_mz.toFixed(2)}</span></span></span>
                    <span className="prow__right"><ClassChip name={c.class} /><HonestyTag tag={c.tag} /></span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
