import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DATASET, DATASET_LICENSE, GITHUB } from "@/lib/links";

export const metadata = { title: "About · CentipedeClassifier" };

export default function About() {
  return (
    <div className="wrap page">
      <div className="about">
        <header className="pagehead"><div className="ms-label">About</div><h1>About this project</h1></header>
        <div className="prose measure">
          <p>This is a web app that reads a mass spectrum and suggests which <b>family</b> and <b>class</b> of drug it most resembles, and how sure it is. When it is not sure, it says <b>uncertain</b>.</p>
          <p>It is a university machine-learning mini project, built and presented by one author. The model was trained on the <a className="ms-link ms-link--ext" href={DATASET} target="_blank" rel="noreferrer">NIST DART-MS Forensics Database</a> (the &ldquo;Locust&rdquo; library) and measured with a grouped test that keeps close relatives apart. It is a <b>first hint, not a laboratory identification</b>: the <Link className="ms-link" href="/results">Results</Link> page shows how well it works, including where it fails.</p>
        </div>
        <div className="about__grid">
          <div className="ms-card">
            <div className="ms-label" style={{ marginBottom: 10 }}>Project</div>
            <div className="ms-row" style={{ gap: 12 }}>
              <a className="ms-btn ms-btn--secondary" href={GITHUB} target="_blank" rel="noreferrer">GitHub<ArrowUpRight className="ms-icon" aria-hidden /></a>
            </div>
          </div>
          <div className="ms-card">
            <div className="ms-label" style={{ marginBottom: 10 }}>Course &amp; author</div>
            <dl className="ms-facts">
              <dt>Course</dt><dd style={{ fontFamily: "var(--font-sans)" }}>ESI-SBA · Machine Learning</dd>
              <dt>Author</dt><dd style={{ fontFamily: "var(--font-sans)" }}>solxire · <a className="ms-link ms-link--ext" href="https://solxire.dev" target="_blank" rel="noreferrer">solxire.dev<ArrowUpRight className="ms-icon" aria-hidden /></a></dd>
            </dl>
          </div>
        </div>
        <div className="ms-card about__credit" id="data-credit" style={{ scrollMarginTop: 80 }}>
          <div className="ms-label" style={{ marginBottom: 8 }}>Data credit</div>
          <p style={{ margin: 0, maxWidth: "60ch" }}>Spectra and structures: the NIST DART-MS Forensics Database (in-source collision-induced dissociation, the &ldquo;Locust&rdquo; library), published by the National Institute of Standards and Technology. NIST is not affiliated with this project.</p>
          <div className="ms-row" style={{ gap: 12, marginTop: 14 }}>
            <a className="ms-btn ms-btn--secondary" href={DATASET} target="_blank" rel="noreferrer">Get the dataset on data.gov<ArrowUpRight className="ms-icon" aria-hidden /></a>
            <a className="ms-btn ms-btn--quiet" href={DATASET_LICENSE} target="_blank" rel="noreferrer">NIST open licence<ArrowUpRight className="ms-icon" aria-hidden /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
