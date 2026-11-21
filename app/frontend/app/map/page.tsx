"use client";
import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WarmUp, useBackend } from "@/components/backend";
import { LibraryMap, MapPoint, Sample } from "@/components/library-map";
import { Skeleton } from "@/components/ui";
import { get } from "@/lib/api";
import { useSessionText } from "@/lib/browser";

function MapView() {
  const { state } = useBackend();
  const router = useRouter();
  const focus = useSearchParams().get("focus");
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const sampleText = useSessionText("sample");
  const sample = useMemo<Sample | null>(() => { try { return JSON.parse(sampleText ?? "null"); } catch { return null; } }, [sampleText]);

  useEffect(() => { if (state === "ready") get<MapPoint[]>("/map").then(setPoints).catch(() => {}); }, [state]);

  const labeled = points?.filter((p) => p.class).length;
  return (
    <div className="wrap page">
      <div className="pagehead">
        <h1>Map</h1>
        <p>Every compound in the library, placed so similar spectra sit close together.{points ? ` ${labeled!.toLocaleString("en-US")} are coloured by class; ${(points.length - labeled!).toLocaleString("en-US")} are unlabeled and grey.` : ""}</p>
      </div>
      {state !== "ready" ? <WarmUp /> : !points ? <Skeleton h={560} className="ms-map" /> : (
        <LibraryMap tall points={points} focusKey={focus} sample={sample}
          onFind={() => window.dispatchEvent(new CustomEvent("palette:open", { detail: { compoundsOnly: true, onPick: (k: string) => router.replace(`/map?focus=${k}`) } }))}
          caption="Each dot is a compound; click one to open it. Drag to move, scroll or use the buttons to zoom." />
      )}
    </div>
  );
}

export default function Page() { return <Suspense><MapView /></Suspense>; }
