"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { ApiError } from "@/lib/api";
import { toneIcon, type Tone } from "@/lib/verdicts";
import { useToast } from "./Toast";

export function Card({
  title,
  sub,
  actions,
  children,
  footer,
  flush,
  className,
  tour,
  glow,
  style,
  i,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Body without side padding (tables, ledgers). */
  flush?: boolean;
  className?: string;
  tour?: string;
  glow?: boolean;
  style?: React.CSSProperties;
  /** Stagger index for the entrance animation. */
  i?: number;
}) {
  return (
    <section
      className={`card rise${glow ? " card-glow" : ""} ${className ?? ""}`}
      data-tour={tour}
      style={{ ...(i !== undefined ? ({ "--i": i } as React.CSSProperties) : {}), ...style }}
    >
      {(title || actions) && (
        <header className="card-head">
          <div style={{ minWidth: 0 }}>
            {title && <h2 className="card-title">{title}</h2>}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={`card-body${flush ? " flush" : ""}`}>{children}</div>
      {footer && <footer className="card-foot">{footer}</footer>}
    </section>
  );
}

export function Tag({
  tone = "neutral",
  children,
  large,
  title,
  icon,
}: {
  tone?: Tone;
  children: React.ReactNode;
  large?: boolean;
  title?: string;
  /** Show the status icon (status colors never travel without one). */
  icon?: boolean;
}) {
  const cls = tone === "neutral" ? "" : ` tag-${tone}`;
  return (
    <span className={`tag${cls}${large ? " tag-lg" : ""}`} title={title}>
      {icon && tone !== "neutral" && <Icon name={toneIcon(tone)} />}
      {children}
    </span>
  );
}

export function Notice({
  tone = "neutral",
  title,
  children,
  actions,
  icon,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: string;
}) {
  const glyph = icon ?? (tone === "bad" || tone === "warn" ? "alert" : tone === "good" ? "check" : "info");
  const cls = tone === "neutral" ? "" : ` notice-${tone}`;
  return (
    <div className={`notice fade${cls}`} role={tone === "bad" ? "alert" : undefined}>
      <Icon name={glyph} />
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
      {actions && <div className="notice-actions">{actions}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, what = "this data" }: { error: unknown; onRetry?: () => void; what?: string }) {
  const e = error instanceof ApiError ? error : null;
  const title =
    e?.kind === "network" ? "API unreachable." : e?.kind === "timeout" ? "Request timed out." : e?.status ? `The API returned ${e.status}.` : "Something went wrong.";
  return (
    <Notice
      tone="bad"
      title={title}
      actions={
        onRetry ? (
          <button className="btn btn-sm" onClick={onRetry}>
            <Icon name="refresh" /> Retry
          </button>
        ) : undefined
      }
    >
      <span>
        Could not load {what}. {error instanceof Error ? error.message : String(error)}
      </span>
    </Notice>
  );
}

export function EmptyState({ title, children, actions }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <p>{children}</p>}
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Skeleton({ w = "100%", h = 14, style }: { w?: number | string; h?: number | string; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ width: w, height: h, ...style }} aria-hidden />;
}

export function SkeletonBlock({ lines = 4 }: { lines?: number }) {
  return (
    <div className="stack" style={{ gap: 12 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={`${94 - ((i * 17) % 42)}%`} />
      ))}
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle");
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      toast({ tone: "iris", title: "Copied to clipboard", body: value.length > 48 ? `${value.slice(0, 22)}…${value.slice(-12)}` : value });
    } catch {
      toast({ tone: "warn", title: "Copy blocked", body: "Select the text and copy it manually." });
    }
    setTimeout(() => setState("idle"), 1600);
  }
  return (
    <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={copy} aria-label={state === "copied" ? "Copied" : label} title={label}>
      <Icon name={state === "copied" ? "check" : "copy"} />
    </button>
  );
}

export function HashValue({ value, boxed, short }: { value: string; boxed?: boolean; short?: boolean }) {
  const shown = short && value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-10)}` : value;
  return (
    <div className={`hash${boxed ? " hash-box" : ""}`}>
      <span className="hash-text" title={value}>
        {shown}
      </span>
      <CopyButton value={value} label="Copy to clipboard" />
    </div>
  );
}

export function Bool({ value, yes = "Yes", no = "No" }: { value: boolean; yes?: string; no?: string }) {
  return (
    <span className={`bool ${value ? "bool-yes" : "bool-no"}`}>
      <Icon name={value ? "check" : "x"} />
      {value ? yes : no}
    </span>
  );
}

/** Animates a number from 0 (or its previous value) to `value`. */
export function useCountUp(value: number, duration = 1100) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 4);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

export function CountUp({ value, digits = 1, duration }: { value: number; digits?: number; duration?: number }) {
  const v = useCountUp(value, duration);
  return <>{v.toFixed(digits)}</>;
}

/**
 * Deterministic 5×5 mirrored identicon derived from the address, so the same
 * wallet is recognisable across pages.
 */
export function WalletGlyph({ address, size = 28 }: { address: string; size?: number }) {
  const hex = address.replace(/^0x/i, "").toLowerCase().padEnd(40, "0");
  const hue = parseInt(hex.slice(0, 3), 16) % 360;
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) cells.push(parseInt(hex[i + 3] || "0", 16) % 2 === 0);
  const fg = `hsl(${hue} 62% 70%)`;
  const bg = `hsl(${hue} 28% 13%)`;
  return (
    <svg className="wallet-glyph" width={size} height={size} viewBox="-0.5 -0.5 6 6" aria-hidden shapeRendering="crispEdges">
      <rect x="-0.5" y="-0.5" width="6" height="6" fill={bg} />
      {cells.map((on, i) => {
        if (!on) return null;
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <g key={i} fill={fg}>
            <rect x={col} y={row} width="1" height="1" />
            {col < 2 && <rect x={4 - col} y={row} width="1" height="1" />}
          </g>
        );
      })}
    </svg>
  );
}
