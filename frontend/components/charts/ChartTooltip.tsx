"use client";

import { useCallback, useState } from "react";

export interface TipState {
  x: number;
  y: number;
  content: React.ReactNode;
}

/**
 * One tooltip per chart. `show` takes coordinates relative to the chart's
 * wrapper; the tooltip sits above the point and is clamped to the wrapper.
 */
export function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((x: number, y: number, content: React.ReactNode) => setTip({ x, y, content }), []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

export function Tooltip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null;
  const x = Math.max(80, Math.min(width - 80, tip.x));
  return (
    <div className="tooltip" style={{ left: x, top: tip.y }} role="status">
      {tip.content}
    </div>
  );
}

export function TipValue({ value, label, sub }: { value: React.ReactNode; label: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div className="tooltip-value">{value}</div>
      <div>{label}</div>
      {sub && <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{sub}</div>}
    </div>
  );
}
