"use client";
import { useEffect, useState } from "react";
import { ClassName, get } from "./api";

export type FamilyInfo = { family: string; class: ClassName; variant: 1 | 2 | 3 | 4 };
let cache: Record<string, FamilyInfo> | null = null;
let pending: Promise<void> | null = null;

/** family -> class and fill number (1 solid, 2 tinted, 3 hatched, 4 dotted). Loaded once, then cached. */
export function useFamilies(): Record<string, FamilyInfo> {
  const [map, setMap] = useState<Record<string, FamilyInfo>>(cache ?? {});
  useEffect(() => {
    if (cache) return;
    pending ??= get<FamilyInfo[]>("/families").then((rows) => { cache = Object.fromEntries(rows.map((r) => [r.family, r])); }).catch(() => { pending = null; });
    pending.then(() => { if (cache) setMap(cache); });
  }, []);
  return map;
}
