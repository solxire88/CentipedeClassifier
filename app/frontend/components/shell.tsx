"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, ChartColumn, CircleHelp, FlaskConical, Library, Map as MapIcon, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useBackend } from "./backend";
import { useTour } from "./tour";
import { Wave, useToast } from "./ui";
import { GithubMark } from "./github";
import { LibraryItem, get } from "@/lib/api";
import { GITHUB } from "@/lib/links";
import { useIsApple, useTheme } from "@/lib/browser";

const TABS = [
  { href: "/classify", name: "Classify", icon: AudioWaveform },
  { href: "/library", name: "Library", icon: Library },
  { href: "/map", name: "Map", icon: MapIcon },
  { href: "/results", name: "Results", icon: ChartColumn },
  { href: "/science", name: "Science", icon: FlaskConical },
  { href: "/about", name: "About", icon: null },
] as const;

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const theme = useTheme();
  const set = (t: string) => {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch {}
  };
  return (
    <span className="ms-toggle" role="group" aria-label="Theme" style={style}>
      <button aria-pressed={theme === "dark"} aria-label="Dark" onClick={() => set("dark")}><Moon className="ms-icon" aria-hidden /></button>
      <button aria-pressed={theme === "light"} aria-label="Light" onClick={() => set("light")}><Sun className="ms-icon" aria-hidden /></button>
    </span>
  );
}

function Status() {
  const { state } = useBackend();
  const label = { ready: "Model ready", waking: "Waking up the model…", unreachable: "Model unreachable" }[state];
  return (
    <span className="ms-status" data-state={state} role="status" title={label}>
      {state === "waking" ? <Wave /> : <span className="ms-status__dot" />}
      <span className="ms-sr">{label}</span>
    </span>
  );
}

type Recent = { inchikey: string; name: string; formula: string };
const loadRecents = (): Recent[] => { try { return JSON.parse(localStorage.getItem("recent-compounds") ?? "[]"); } catch { return []; } };
const saveRecent = (r: Recent) => { try { localStorage.setItem("recent-compounds", JSON.stringify([r, ...loadRecents().filter((x) => x.inchikey !== r.inchikey)].slice(0, 5))); } catch {} };

/** Jump to a page or a compound. In compounds-only mode (opened from Classify) a pick calls onPick instead of navigating. */
export function CommandPalette({ open, onClose, compoundsOnly, onPick }: { open: boolean; onClose: () => void; compoundsOnly?: boolean; onPick?: (key: string) => void }) {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const { state } = useBackend();

  // Opening the palette starts it fresh: the state is reset while rendering, the focus and the library request in an effect.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) { setWasOpen(open); if (open) { setRecents(loadRecents()); setQ(""); setActive(0); } }
  useEffect(() => {
    if (open && state === "ready" && items.length === 0) get<LibraryItem[]>("/library").then(setItems).catch(() => {});
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open, state, items.length]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pages = compoundsOnly ? [] : TABS.filter((t) => t.name.toLowerCase().includes(query)).map((t) => ({ href: t.href, label: t.name, hint: "page", group: "Pages", key: "" }));
    const recent = !query ? recents.map((r) => ({ href: `/library/${r.inchikey}`, label: r.name, hint: r.formula, group: "Recent", key: r.inchikey })) : [];
    const compounds = query ? items.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 8).map((c) => ({ href: `/library/${c.inchikey}`, label: c.name, hint: c.formula, group: "Compounds", key: c.inchikey })) : [];
    return [...recent, ...pages, ...compounds];
  }, [q, items, recents, compoundsOnly]);

  if (!open) return null;
  const go = (r: (typeof results)[number]) => {
    onClose();
    if (r.key) saveRecent({ inchikey: r.key, name: r.label, formula: r.hint });
    if (r.key && onPick) onPick(r.key); else router.push(r.href);
  };
  let lastGroup = "";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh", paddingInline: 16, background: "var(--scrim)" }} onClick={onClose}>
      <div className="ms-palette" role="dialog" aria-label={compoundsOnly ? "Load a compound" : "Search"} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && results[active]) go(results[active]);
        }}>
        <div className="ms-palette__in">
          <Search className="ms-icon" aria-hidden />
          <input ref={input} role="combobox" aria-expanded aria-autocomplete="list" aria-controls="palette-list" aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined} aria-label={compoundsOnly ? "Search compounds" : "Search pages and compounds"} value={q}
            placeholder={compoundsOnly ? "Type a compound name…" : "Jump to a page or a compound…"} onChange={(e) => { setQ(e.target.value); setActive(0); }} />
          <kbd className="ms-kbd">Esc</kbd>
        </div>
        <div className="ms-palette__group" id="palette-list" role="listbox" style={{ maxHeight: 360, overflow: "auto" }}>
          {results.length === 0 && <p className="ms-muted" style={{ padding: "12px 8px", margin: 0, fontSize: 14 }}>{compoundsOnly && !q ? "Type to search 1,570 compounds." : "No match."}</p>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? <span key={`g-${r.group}`} className="ms-label">{r.group}</span> : null;
            lastGroup = r.group;
            return (
              <div key={`${r.group}-${r.href}`}>
                {head}
                <div id={`palette-opt-${i}`} role="option" aria-selected={i === active} ref={i === active ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined} className="ms-palette__item" onMouseEnter={() => setActive(i)} onClick={() => go(r)} style={{ cursor: "pointer" }}>
                  <span>{r.label}</span><span className="end ms-num">{r.hint}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="ms-palette__foot"><span><kbd className="ms-kbd">↑</kbd><kbd className="ms-kbd">↓</kbd> move</span><span><kbd className="ms-kbd">↵</kbd> open</span><span><kbd className="ms-kbd">Esc</kbd> close</span></div>
      </div>
    </div>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { start } = useTour();
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 65, background: "var(--scrim)" }} onClick={onClose}>
      <div role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--elevated)", borderTop: "1px solid var(--border-strong)", borderRadius: "12px 12px 0 0", padding: 16, boxShadow: "var(--shadow-pop)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span className="ms-label">More</span>
          <button className="ms-btn ms-btn--quiet ms-btn--icon ms-btn--sm" aria-label="Close" onClick={onClose}><X className="ms-icon" aria-hidden /></button>
        </div>
        <Link href="/about" onClick={onClose} className="ms-palette__item" style={{ height: 44, textDecoration: "none" }}>About</Link>
        <button className="ms-palette__item" style={{ height: 44, width: "100%", background: "none", border: 0, font: "inherit", fontSize: 14, lineHeight: "20px", color: "var(--text)", cursor: "pointer", textAlign: "left" }} onClick={() => { onClose(); start(); }}>Replay the tour</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 8px 4px" }}>
          <span style={{ fontSize: 14 }}>Theme</span><ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export function NavBar() {
  const path = usePathname();
  const { start } = useTour();
  const toast = useToast();
  const { state, retry } = useBackend();
  const [palette, setPalette] = useState<{ compoundsOnly?: boolean; onPick?: (key: string) => void } | null>(null);
  const [more, setMore] = useState(false);
  const mac = useIsApple();
  const tabs = useRef<HTMLUListElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => (o ? null : {})); }
    };
    const onOpen = (e: Event) => setPalette((e as CustomEvent).detail ?? {});
    window.addEventListener("keydown", onKey);
    window.addEventListener("palette:open", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("palette:open", onOpen); };
  }, []);

  useEffect(() => {
    if (state === "unreachable") toast({ message: "The model is unreachable.", kind: "error", action: { label: "Try again", run: retry } });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const place = () => {
      const a = tabs.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      setInd(a ? { left: a.offsetLeft + 12, width: a.offsetWidth - 24 } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [path]);

  if (path === "/") {
    return (
      <nav className="ms-nav ms-nav--app lp-nav" aria-label="Main">
        <div className="ms-nav__right lp-left">
          <a className="ms-btn ms-btn--quiet ms-btn--icon ms-btn--sm" href={GITHUB} target="_blank" rel="noreferrer" aria-label="The code on GitHub" title="The code on GitHub"><GithubMark /></a>
          <ThemeToggle style={undefined} />
        </div>
        <div className="lp-links">
          <a href="#how">How it works</a><a href="#numbers">Results</a><a href="#limits">Limits</a><a href="#explore">Explore</a>
        </div>
        <div className="ms-nav__right lp-cta-btn">
          <Link className="ms-btn ms-btn--primary ms-btn--sm" href="/classify">Classify a spectrum</Link>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="ms-nav ms-nav--app" aria-label="Main">
        <Link href="/" className="ms-wordmark" aria-label="CentipedeClassifier">
          {/* The segments logo (sharp): black on the light theme, white on the dark one; the mark alone below 1024 px. */}
          {(["icon", "horizontal"] as const).flatMap((kind) => (["white", "black"] as const).map((colour) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={kind + colour} className={`brand-${kind === "icon" ? "icon" : "full"} ${colour === "white" ? "on-dark" : "on-light"}`}
              src={`/brand/centipede-C-segments-sharp-${colour}-${kind}.svg`} alt="" />
          )))}
        </Link>
        <ul className="ms-tabs ms-tabs--app" ref={tabs}>
          {TABS.map((t) => (
            <li key={t.href}><Link href={t.href} aria-current={isActive(path, t.href) ? "page" : undefined}>{t.name}</Link></li>
          ))}
          <span className="ms-tabs__ind" aria-hidden style={{ left: ind?.left ?? 0, width: ind?.width ?? 0, opacity: ind ? 1 : 0 }} />
        </ul>
        <div className="ms-nav__right">
          <button className="ms-searchbtn" onClick={() => setPalette({})} aria-label="Search">
            <Search className="ms-icon" aria-hidden /><span className="sb-label">Search</span><span className="ms-kbd sb-kbd">{mac ? "⌘K" : "Ctrl K"}</span>
          </button>
          <button className="ms-btn ms-btn--quiet ms-btn--icon ms-btn--sm help-btn" aria-label="Replay the tour" onClick={start}><CircleHelp className="ms-icon" aria-hidden /></button>
          <ThemeToggle style={undefined} />
          <Status />
          <button className="ms-btn ms-btn--quiet ms-btn--icon ms-btn--sm more-btn" aria-label="More" onClick={() => setMore(true)}><Menu className="ms-icon" aria-hidden /></button>
        </div>
      </nav>
      <nav className="ms-tabbar ms-tabbar--app" aria-label="Pages">
        {TABS.slice(0, 5).map((t) => {
          const Icon = t.icon!;
          return <Link key={t.href} href={t.href} aria-current={isActive(path, t.href) ? "page" : undefined}><Icon className="ms-icon" aria-hidden />{t.name}</Link>;
        })}
      </nav>
      <CommandPalette open={!!palette} compoundsOnly={palette?.compoundsOnly} onPick={palette?.onPick} onClose={() => setPalette(null)} />
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </>
  );
}

export function Footer() {
  return (
    <footer className="ms-footer ms-footer--app">
      <span>Made by <a href="https://solxire.dev"><b>solxire</b></a></span>
      <span>ESI-SBA · Machine Learning</span>
      <Link href="/about#data-credit">Data credit: NIST DART-MS Forensics library</Link>
      <a href={GITHUB} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><GithubMark size={14} />GitHub</a>
      <ThemeToggle style={{ marginLeft: "auto" }} />
    </footer>
  );
}
