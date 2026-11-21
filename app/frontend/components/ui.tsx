"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArrowUpRight, CircleAlert, Check, Table2, TriangleAlert, WifiOff } from "lucide-react";

type Variant = "primary" | "secondary" | "quiet";

export function Button({ variant = "secondary", size, icon, loading, className = "", children, ...props }: {
  variant?: Variant; size?: "sm"; icon?: boolean; loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} disabled={props.disabled || loading} aria-busy={loading || undefined}
      className={`ms-btn ms-btn--${variant}${size ? " ms-btn--sm" : ""}${icon ? " ms-btn--icon" : ""}${loading ? " is-loading" : ""} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({ variant = "secondary", size, className = "", href, children, external }: {
  variant?: Variant; size?: "sm"; className?: string; href: string; children: React.ReactNode; external?: boolean;
}) {
  const cls = `ms-btn ms-btn--${variant}${size ? " ms-btn--sm" : ""} ${className}`;
  return external ? (
    <a className={cls} href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight className="ms-icon" aria-hidden /></a>
  ) : (
    <Link className={cls} href={href}>{children}</Link>
  );
}

export function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="ms-link ms-link--ext" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight className="ms-icon" aria-hidden /></a>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ms-kbd">{children}</kbd>;
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: React.ReactNode; title?: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="ms-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} title={o.title} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}


/** Label, input with an optional unit, and a help line that is valid (check), error (warning) or neutral. Never colour alone. */
export function TextField({ id, label, unit, help, state, className = "", ...props }: {
  id: string; label: string; unit?: string; help?: string; state?: "valid" | "error";
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`ms-field ${className}`} style={{ width: "100%" }}>
      <label htmlFor={id}><span>{label}</span>{unit && <span className="ms-mono ms-muted">{unit}</span>}</label>
      <input id={id} className={`ms-input${state === "error" ? " is-error" : ""}`} aria-invalid={state === "error" || undefined} aria-describedby={help ? `${id}-help` : undefined} {...props} />
      {help && (
        <p id={`${id}-help`} className={`ms-help${state ? ` is-${state}` : ""}`} style={{ margin: 0 }}>
          {state === "valid" && <Check className="ms-icon" aria-hidden />}
          {state === "error" && <TriangleAlert className="ms-icon" aria-hidden />}
          <span>{help}</span>
        </p>
      )}
    </div>
  );
}

export function Skeleton({ w, h, className = "" }: { w?: number | string; h?: number | string; className?: string }) {
  return <div className={`ms-skel ${className}`} style={{ width: w, height: h }} aria-hidden />;
}

export function Wave({ large }: { large?: boolean }) {
  return <span className={`ms-wave${large ? " ms-wave--lg" : ""}`} aria-hidden><i /><i /><i /><i /><i /></span>;
}

export function EmptyState({ icon, title, text, action, className = "" }: {
  icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`ms-empty ${className}`} role="status">
      {icon}
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/** The shell every chart sits in: eyebrow, title, one-sentence finding, body, footer with table toggle and source. */
export function ChartFrame({ label = "Chart", title, finding, source, table, illustrative, children, className = "" }: {
  label?: string; title: string; finding: string; source: string; table: React.ReactNode; illustrative?: boolean;
  children: React.ReactNode; className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={`ms-frame ${className}`} style={{ margin: 0 }}>
      <div className="ms-frame__head">
        <div>
          <div className="ms-label">{label}</div>
          <h3 className="ms-frame__title">{title}</h3>
          <p className="ms-frame__sub">{finding}</p>
        </div>
        {illustrative && <span className="ms-badge ms-badge--dashed">illustrative</span>}
      </div>
      <div className="ms-frame__body">{asTable ? table : children}</div>
      <div className="ms-frame__foot">
        <button type="button" className="ms-btn ms-btn--quiet ms-btn--sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          <Table2 className="ms-icon" aria-hidden />{asTable ? "View as chart" : "View as table"}
        </button>
        <span>Source: {source}</span>
      </div>
    </figure>
  );
}

// ---- toasts --------------------------------------------------------------------------
type Toast = { id: number; message: string; kind: "ok" | "error" | "offline"; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = next.current++;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.kind === "ok" ? 2500 : 6000);
  }, []);

  useEffect(() => {
    const off = () => push({ message: "You are offline. Pages you opened still work.", kind: "offline" });
    window.addEventListener("offline", off);
    return () => window.removeEventListener("offline", off);
  }, [push]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="ms-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="ms-toast" role={t.kind === "ok" ? "status" : "alert"}>
            {t.kind === "ok" ? <Check className="ms-icon" aria-hidden /> : t.kind === "offline" ? <WifiOff className="ms-icon" aria-hidden /> : <CircleAlert className="ms-icon" aria-hidden />}
            <span>{t.message}</span>
            {t.action && <button className="ms-btn ms-btn--quiet ms-btn--sm" onClick={t.action.run}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
