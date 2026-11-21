import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const none = () => () => {};

/** False on the server and while the page hydrates, true afterwards: lets a component show browser-only values without a mismatch. */
export const useHydrated = () => useSyncExternalStore(none, () => true, () => false);

function useMedia(query: string, server = false) {
  return useSyncExternalStore(
    (notify) => { const m = window.matchMedia(query); m.addEventListener("change", notify); return () => m.removeEventListener("change", notify); },
    () => window.matchMedia(query).matches,
    () => server,
  );
}

export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");

export const useOnline = () =>
  useSyncExternalStore(
    (notify) => { window.addEventListener("online", notify); window.addEventListener("offline", notify); return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); }; },
    () => navigator.onLine,
    () => true,
  );

/** The theme set on <html> (dark until the page script has run). */
export const useTheme = () =>
  useSyncExternalStore(
    (notify) => { const o = new MutationObserver(notify); o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); return () => o.disconnect(); },
    () => document.documentElement.getAttribute("data-theme") ?? "dark",
    () => "dark",
  );

/** A value kept in sessionStorage, as text (null on the server and when absent). */
export const useSessionText = (key: string) =>
  useSyncExternalStore(none, () => { try { return sessionStorage.getItem(key); } catch { return null; } }, () => null);

export const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform);
export const useIsApple = () => useSyncExternalStore(none, isApple, () => true);

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends HTMLElement | SVGElement>(margin = "0px 0px -6% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); obs.disconnect(); } }, { rootMargin: margin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [margin]);
  return [ref, seen] as const;
}
