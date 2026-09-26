"use client";

import { useState } from "react";
import Icon from "./Icon";
import { ApiError } from "@/lib/api";
import type { Tone } from "@/lib/verdicts";

export function Panel({
  title,
  sub,
  actions,
  children,
  footer,
  tight,
  className,
  tour,
  id,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  tight?: boolean;
  className?: string;
  tour?: string;
  id?: string;
}) {
  return (
    <section className={`panel ${className ?? ""}`} data-tour={tour} id={id}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {sub && <div className="panel-sub">{sub}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={`panel-body${tight ? " tight" : ""}`}>{children}</div>
      {footer && <footer className="panel-foot">{footer}</footer>}
    </section>
  );
}

export function Chip({ tone = "neutral", children, large, title }: { tone?: Tone; children: React.ReactNode; large?: boolean; title?: string }) {
  const cls = tone === "neutral" ? "" : ` chip-${tone}`;
  return (
    <span className={`chip${cls}${large ? " chip-lg" : ""}`} title={title}>
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
  const glyph = icon ?? (tone === "neg" ? "alert" : tone === "warn" ? "alert" : tone === "pos" ? "check" : "info");
  const cls = tone === "neutral" ? "" : ` notice-${tone}`;
  return (
    <div className={`notice${cls}`} role={tone === "neg" ? "alert" : undefined}>
      <Icon name={glyph} />
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
      {actions && <div className="notice-actions">{actions}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  what = "this data",
}: {
  error: unknown;
  onRetry?: () => void;
  what?: string;
}) {
  const e = error instanceof ApiError ? error : null;
  const title =
    e?.kind === "network"
      ? "API unreachable."
      : e?.kind === "timeout"
        ? "Request timed out."
        : e?.status
          ? `The API returned ${e.status}.`
          : "Something went wrong.";
  return (
    <Notice
      tone="neg"
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

export function EmptyState({
  title,
  children,
  actions,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
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
    <div className="stack" style={{ gap: 10 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={`${92 - ((i * 17) % 40)}%`} />
      ))}
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1600);
  }
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-icon"
      onClick={copy}
      aria-label={state === "copied" ? "Copied" : label}
      title={state === "copied" ? "Copied" : state === "failed" ? "Copy failed — select the text instead" : label}
    >
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

export function Stat({ label, value, note, tone }: { label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone && tone !== "neutral" ? { color: `var(--${tone})` } : undefined}>
        {value}
      </div>
      {note && <div className="stat-note">{note}</div>}
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

/**
 * Deterministic 5×5 mirrored identicon derived from the address characters, so
 * the same wallet is recognisable across pages.
 */
export function WalletGlyph({ address, size = 28 }: { address: string; size?: number }) {
  const hex = address.replace(/^0x/i, "").toLowerCase().padEnd(40, "0");
  const hue = parseInt(hex.slice(0, 3), 16) % 360;
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) cells.push(parseInt(hex[i + 3] || "0", 16) % 2 === 0);
  const fg = `hsl(${hue} 55% 68%)`;
  const bg = `hsl(${hue} 30% 14%)`;
  return (
    <svg className="wallet-glyph" width={size} height={size} viewBox="0 0 5 5" aria-hidden shapeRendering="crispEdges">
      <rect width="5" height="5" fill={bg} />
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
