import katex from "katex";
import { marked } from "marked";
import { GLOSSARY } from "./glossary";

const ARROW = '<svg class="ms-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function termHtml(text: string, g: (typeof GLOSSARY)[number]) {
  const link = g.link ? `<a class="ms-link ms-link--ext" href="${attr(g.link)}" target="_blank" rel="noreferrer">Read more${ARROW}</a>` : "";
  return `<span class="ms-term" tabindex="0">${text}<span class="ms-pop" role="tooltip"><dfn>${attr(g.term)}</dfn><span class="pop-d">${attr(g.definition)}</span>${link}</span></span>`;
}

/** Wraps the first use of each glossary term (once per page, outside links and headings) in the hover definition. */
function wrapTerms(html: string, used: Set<string>) {
  const terms = GLOSSARY.flatMap((g) => g.term.split(" / ").map((t) => ({ t: t.replace(/ \(.*\)$/, ""), g }))).filter(({ t }) => t.length > 3).sort((a, b) => b.t.length - a.t.length);
  const parts = html.split(/(<[^>]+>)/);
  let skip = 0;
  return parts.map((part) => {
    if (part.startsWith("<")) {
      if (/^<(a|h[1-6]|code)[\s>]/i.test(part)) skip++;
      else if (/^<\/(a|h[1-6]|code)>/i.test(part)) skip--;
      return part;
    }
    if (skip > 0 || !part.trim()) return part;
    // Find each term's first match in the original text, keep non-overlapping ones, then build the output once.
    const picks: { start: number; end: number; g: (typeof GLOSSARY)[number] }[] = [];
    for (const { t, g } of terms) {
      if (used.has(g.term)) continue;
      const m = part.match(new RegExp(`(?<![\\w-])(${esc(t)})(?![\\w-])`, "i"));
      if (!m || m.index === undefined) continue;
      const start = m.index, end = start + m[1].length;
      if (picks.some((p) => start < p.end && end > p.start)) continue;
      used.add(g.term);
      picks.push({ start, end, g });
    }
    picks.sort((x, y) => x.start - y.start);
    let out = "", at = 0;
    for (const p of picks) { out += part.slice(at, p.start) + termHtml(part.slice(p.start, p.end), p.g); at = p.end; }
    out += part.slice(at);
    return out;
  }).join("");
}

/** LaTeX between $...$ (inline) or $$...$$ (own line) is set aside before the markdown and the glossary see it, then drawn with KaTeX. */
function takeMath(md: string) {
  const math: string[] = [];
  const keep = (tex: string, display: boolean) => {
    math.push(katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false }));
    return `@@MATH${math.length - 1}@@`;
  };
  const text = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t, true)).replace(/\$([^$\n]+?)\$/g, (_, t) => keep(t, false));
  return { text, math };
}

/** Markdown to HTML in the design's style: external links get the arrow and open in a new tab, glossary terms get a definition. */
export function renderProse(md: string, used: Set<string>) {
  const { text, math } = takeMath(md);
  let html = marked.parse(text, { async: false }) as string;
  html = html.replace(/<a href="(https?:[^"]+)">([\s\S]*?)<\/a>/g, (_, href, text) => `<a class="ms-link ms-link--ext" href="${href}" target="_blank" rel="noreferrer">${text}${ARROW}</a>`);
  html = html.replace(/<a href="(\/[^"]*)">/g, '<a class="ms-link" href="$1">');
  html = wrapTerms(html, used);
  return html.replace(/@@MATH(\d+)@@/g, (_, i) => math[Number(i)]);
}

export type SectionPart = { html: string } | { visual: string };
export type ScienceSection = { id: string; num: string; heading: string; html: string; parts: SectionPart[]; image?: { id: string; caption: string; credit?: string }; visual: string };

/** Reads the Science text: each "## Sx." section, its COPY block and its image placeholder. */
export function parseScience(md: string) {
  const used = new Set<string>();
  const sections: ScienceSection[] = [];
  let hero = { title: "", sub: "" };
  const re = /^## (S\d+)\. (.+?)\n([\s\S]*?)(?=^## S\d+\.|^## Wikipedia|^## Images|(?![\s\S]))/gm;
  for (const m of md.matchAll(re)) {
    const [, num, , body] = m;
    const copy = body.match(/COPY START\n([\s\S]*?)\nCOPY END/)?.[1]?.trim() ?? "";
    if (num === "S0") {
      const t = copy.match(/^# (.+)$/m)?.[1] ?? "";
      hero = { title: t, sub: renderProse(copy.replace(/^# .+$/m, "").trim(), used).replace(/^<p>|<\/p>\s*$/g, "") };
      continue;
    }
    const heading = copy.match(/^## (.+)$/m)?.[1] ?? m[2];
    const text = copy.replace(/^## .+$/m, "").trim();
    const img = body.match(/\[IMAGE PLACEHOLDER (IMG-[\w\d]+)\]\s*(.+)/);
    let image: ScienceSection["image"];
    if (img && !/no image needed/i.test(img[2])) {
      const alt = img[2].match(/Alt text: "([^"]+)"/)?.[1] ?? img[2].split(".")[0];
      image = { id: img[1], caption: alt, credit: /Wikimedia|credit/i.test(img[2]) ? "Credit and licence to add with the image." : undefined };
    }
    // A line "[VISUAL name]" in the text puts that figure at that place; the text around it is rendered in order.
    const parts: SectionPart[] = text.split(/^\[VISUAL ([\w-]+)\]\s*$/m).map((chunk, i) => (i % 2 ? { visual: chunk } : { html: renderProse(chunk.trim(), used) }));
    sections.push({ id: num.toLowerCase(), num, heading, html: parts.map((p) => ("html" in p ? p.html : "")).join(""), parts, image, visual: num });
  }
  return { hero, sections };
}
