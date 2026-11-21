"use client";
import { ClassName, Tag } from "@/lib/api";
import { useFamilies } from "@/lib/families";

const GLYPHS: Record<ClassName, React.ReactNode> = {
  stimulant: <path d="M5 0.8 9.6 9H0.4z" />,
  depressant: <path d="M5 9.2 0.4 1h9.2z" />,
  opioid: <circle cx="5" cy="5" r="4.2" />,
  cannabinoid: <rect x="1" y="1" width="8" height="8" rx="1" />,
  psychedelic: <path d="M5 0.2 9.8 5 5 9.8 0.2 5z" />,
  dissociative: <path d="M3.6 0.6h2.8v3h3v2.8h-3v3H3.6v-3h-3V3.6h3z" />,
  other: <rect x="0.4" y="3.4" width="9.2" height="3.2" rx="1.6" />,
};

/** Class shape from the design: colour never carries the class alone. */
export function ClassGlyph({ name }: { name: ClassName }) {
  return <svg className="ms-glyph" data-class={name} viewBox="0 0 10 10" fill="currentColor" aria-hidden>{GLYPHS[name]}</svg>;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ClassChip({ name }: { name: ClassName | null }) {
  if (!name) return <span className="ms-chip" style={{ borderStyle: "dashed", color: "var(--text-muted)" }}>unlabeled</span>;
  return <span className="ms-chip ms-chip--class" data-class={name}><ClassGlyph name={name} /><span>{cap(name)}</span></span>;
}

/** Family chip: the class colour in one of four fills (solid, tinted, hatched, dotted). */
export function FamilyChip({ family, cls }: { family: string; cls?: ClassName }) {
  const info = useFamilies()[family];
  const c = cls ?? info?.class;
  return (
    <span className="ms-chip ms-chip--family" data-class={c}>
      <i className="ms-fam" data-variant={info?.variant ?? 1} /><span>{family}</span>
    </span>
  );
}

export function FamilySwatch({ family }: { family: string }) {
  const info = useFamilies()[family];
  return <i className="ms-fam" data-class={info?.class} data-variant={info?.variant ?? 1} />;
}

export const TAG_NOTE: Record<Tag, string> = {
  held_out: "This compound was held out: not used to train or choose the model, so this is a fair test.",
  training: "The model saw this compound in training, so this is not a fair test.",
  unlabeled: "This compound is unlabeled: it was used without its label, so there is no true answer.",
};
const TAG_LABEL: Record<Tag, string> = { held_out: "Held out", training: "Used in training", unlabeled: "Unlabeled" };

/** Shape, not hue: check badge = held out, dot = used in training, dashed ring = unlabeled. */
export function HonestyTag({ tag, label, long }: { tag: Tag; label?: string; long?: boolean }) {
  const mark =
    tag === "held_out" ? (
      <svg className="ms-mark" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="6.25" fill="currentColor" /><path d="M4 7.2 6.1 9.3 10 5.2" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) : tag === "training" ? (
      <svg className="ms-mark" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="3.25" fill="currentColor" /></svg>
    ) : (
      <svg className="ms-mark" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="2.4 2" /></svg>
    );
  return <span className="ms-chip ms-chip--tag" title={TAG_NOTE[tag]}>{mark}<span>{long ? TAG_NOTE[tag] : label ?? TAG_LABEL[tag]}</span></span>;
}
