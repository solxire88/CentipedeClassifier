"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import { Button, EmptyState, Wave } from "./ui";
import { API } from "@/lib/api";
import { useHydrated, useOnline } from "@/lib/browser";

type State = "waking" | "ready" | "unreachable";
const Ctx = createContext<{ state: State; retry: () => void }>({ state: "waking", retry: () => {} });
// A consumer reports "waking" on its first render, so it matches the server HTML even when
// the provider already knows the real state (a component inside Suspense hydrates later).
export function useBackend() {
  const ctx = useContext(Ctx);
  const mounted = useHydrated();
  return mounted ? ctx : { ...ctx, state: "waking" as State };
}

// The server's state lives outside React: it is asked until it answers (the free host can need a minute to wake),
// and components read it through useSyncExternalStore.
let serverState: State = "waking";
let asking = false;
const listeners = new Set<() => void>();
const setServerState = (next: State) => { serverState = next; listeners.forEach((l) => l()); };

async function ask() {
  asking = true;
  const started = Date.now();
  do {
    try {
      const r = await fetch(API + "/health");
      if (r.ok) { asking = false; return setServerState("ready"); }
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  } while (Date.now() - started < 90_000);
  asking = false;
  setServerState("unreachable");
}
const subscribe = (listener: () => void) => { listeners.add(listener); if (!asking && serverState === "waking") ask(); return () => { listeners.delete(listener); }; };
const retry = () => { setServerState("waking"); if (!asking) ask(); };

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, () => serverState, () => "waking" as State);
  return <Ctx.Provider value={{ state, retry }}>{children}</Ctx.Provider>;
}

export function WarmUp({ children }: { children?: React.ReactNode }) {
  const { state, retry } = useBackend();
  const offline = !useOnline();
  if (state === "ready") return <>{children}</>;
  if (offline)
    return <EmptyState icon={<WifiOff className="ms-icon ms-icon--lg" aria-hidden />} title="You are offline" text="Pages you already opened still work. Classifying needs a connection." />;
  if (state === "waking")
    return (
      <div className="ms-warm" role="status">
        <Wave large />
        <p>Waking up the model…<span>Usually under a minute. Your input stays in the form, and the rest of the site works.</span></p>
      </div>
    );
  return (
    <EmptyState icon={<TriangleAlert className="ms-icon ms-icon--lg" aria-hidden />} title="The model is unreachable"
      text="The server did not answer. Library, Map, Results and Science still work."
      action={<Button size="sm" onClick={retry}><RefreshCw className="ms-icon" aria-hidden />Try again</Button>} />
  );
}
