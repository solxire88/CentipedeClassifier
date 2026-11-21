"use client";
import { useEffect, useState } from "react";

/** A 2 px reading line under the nav on long pages. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="ms-progress ms-progress--fixed" style={{ ["--p" as string]: p }} role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}><i /></div>;
}

/** Sticky table of contents; the section in view carries aria-current. Hidden on phones. */
export function TableOfContents({ items }: { items: { id: string; num: string; label: string }[] }) {
  const [current, setCurrent] = useState(items[0]?.id);
  useEffect(() => {
    // The section whose top has passed the reading line (30% down the window) is the current one.
    // The sections are looked up on every update: on the Results page they only exist once the data has loaded.
    const update = () => {
      const line = window.innerHeight * 0.3;
      let active = items[0]?.id;
      for (const i of items) {
        const el = document.getElementById(i.id);
        if (el && el.getBoundingClientRect().top <= line) active = i.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = items[items.length - 1]?.id;
      setCurrent(active);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const resize = new ResizeObserver(update);
    resize.observe(document.body);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); resize.disconnect(); };
  }, [items]);
  return (
    <nav aria-label="On this page" className="toc-wrap">
      <ul className="ms-toc">
        {items.map((i) => (
          <li key={i.id}><a href={`#${i.id}`} aria-current={current === i.id ? "true" : undefined}><span className="ms-num">{i.num}</span>{i.label}</a></li>
        ))}
      </ul>
    </nav>
  );
}
