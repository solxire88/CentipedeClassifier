import katex from "katex";

/** A formula in LaTeX, drawn with KaTeX. `block` puts it on its own line. */
export function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = katex.renderToString(tex, { displayMode: block, throwOnError: false });
  return <span className={block ? "ms-tex ms-tex--block" : "ms-tex"} dangerouslySetInnerHTML={{ __html: html }} />;
}
