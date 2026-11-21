"use client";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap page">
      <div className="ms-empty" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
        <TriangleAlert className="ms-icon ms-icon--lg" aria-hidden />
        <h4>Something went wrong</h4>
        <p>This page hit an error. Reloading usually fixes it.</p>
        <button className="ms-btn ms-btn--secondary ms-btn--sm" onClick={() => { reset(); location.reload(); }}><RefreshCw className="ms-icon" aria-hidden />Reload</button>
      </div>
    </div>
  );
}
