"use client";

import { useState } from "react";
import { useWidth } from "./useWidth";
import { Tooltip, TipValue, useTooltip } from "./ChartTooltip";
import { featureLabel, featureMeta, formatFeatureValue, RISK_THRESHOLD } from "@/lib/features";
import { fmtNumber, fmtSigned } from "@/lib/format";

/**
 * Horizontal SHAP waterfall: starts at the explainer's expected value, applies
 * each non-zero attribution in order of magnitude, and ends at the model's
 * actual score. Any gap between the running total and the score (Kernel SHAP
 * sampling + rounding) is drawn as an explicit residual step.
 */
export default function Waterfall({
  base,
  contributions,
  inputs,
  score,
}: {
  base: number;
  contributions: Record<string, number>;
  inputs?: Record<string, number>;
  score: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState<number | null>(null);
  const steps = Object.entries(contributions)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  type Row = { key?: string; label: string; from: number; to: number; kind: "base" | "step" | "residual" | "final" };
  const rows: Row[] = [{ label: "Base value", from: 0, to: base, kind: "base" }];
  let running = base;
  for (const [k, v] of steps) {
    rows.push({ key: k, label: featureLabel(k), from: running, to: running + v, kind: "step" });
    running += v;
  }
  const residual = Number((score - running).toFixed(2));
  if (Math.abs(residual) >= 0.05) rows.push({ label: "Residual", from: running, to: score, kind: "residual" });
  rows.push({ label: "Risk score", from: 0, to: score, kind: "final" });

  const values = rows.flatMap((r) => (r.kind === "base" || r.kind === "final" ? [r.to] : [r.from, r.to]));
  values.push(RISK_THRESHOLD);
  let lo = Math.max(0, Math.floor((Math.min(...values) - 4) / 5) * 5);
  let hi = Math.min(100, Math.ceil((Math.max(...values) + 4) / 5) * 5);
  if (hi - lo < 10) hi = Math.min(100, lo + 10);

  const compact = width < 520;
  const labelW = compact ? 104 : 150;
  const valueW = 56;
  const rowH = 34;
  const barH = 16;
  const top = 26;
  const chartL = labelW + 12;
  const chartR = width - valueW;
  const sx = (v: number) => chartL + ((v - lo) / (hi - lo)) * (chartR - chartL);
  const height = top + rows.length * rowH + 4;
  const pxPer5 = ((chartR - chartL) / (hi - lo)) * 5;
  const tickStep = pxPer5 >= 30 ? 5 : pxPer5 >= 15 ? 10 : 20;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / tickStep) * tickStep; t <= hi; t += tickStep) ticks.push(t);

  return (
    <div ref={ref} className="chart-wrap" onPointerLeave={() => (hide(), setActive(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label={`Waterfall from base value ${base} to risk score ${score}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 6} y2={height - 2} stroke="var(--line)" />
            <text x={sx(t)} y={top - 12} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <line x1={sx(RISK_THRESHOLD)} x2={sx(RISK_THRESHOLD)} y1={top - 6} y2={height - 2} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1 3" strokeLinecap="round" />
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const isTotal = r.kind === "base" || r.kind === "final";
          const x0 = isTotal ? sx(lo) : sx(Math.min(r.from, r.to));
          const x1 = isTotal ? sx(r.to) : sx(Math.max(r.from, r.to));
          const delta = r.to - r.from;
          const fill =
            r.kind === "final"
              ? r.to >= RISK_THRESHOLD
                ? "var(--bad)"
                : "var(--good)"
              : r.kind === "base"
                ? "var(--line-3)"
                : r.kind === "residual"
                  ? "var(--ink-4)"
                  : delta > 0
                    ? "var(--up)"
                    : "var(--down)";
          const next = rows[i + 1];
          const neg = !isTotal && delta < 0;
          return (
            <g
              key={`${r.label}-${i}`}
              data-active={active === i ? "true" : undefined}
              data-dim={active !== null && active !== i ? "true" : undefined}
              onPointerEnter={() => {
                setActive(i);
                show(
                  (x0 + x1) / 2,
                  y + 4,
                  <TipValue
                    value={isTotal ? fmtNumber(r.to) : `${fmtSigned(delta)} pts`}
                    label={r.label}
                    sub={
                      r.kind === "step" && r.key
                        ? `Input ${formatFeatureValue(featureMeta(r.key), inputs?.[r.key])} · running total ${fmtNumber(r.to)}`
                        : r.kind === "residual"
                          ? "Kernel SHAP sampling and rounding gap"
                          : r.kind === "base"
                            ? "Model output for the SHAP background"
                            : r.to >= RISK_THRESHOLD
                              ? "At or above the deny threshold"
                              : "Below the deny threshold"
                    }
                  />,
                );
              }}
            >
              <rect x={0} y={y} width={width} height={rowH} className="hit" />
              <text x={0} y={y + rowH / 2 + 1} dominantBaseline="middle" className={`t-body ${isTotal ? "t-ink" : "t-2"}`} style={{ fontWeight: isTotal ? 600 : 400 }}>
                {r.label}
              </text>
              <rect
                className={`hover-lift anim-bar-x${neg ? " from-right" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
                x={x0}
                y={y + (rowH - barH) / 2}
                width={Math.max(2, x1 - x0)}
                height={barH}
                rx={4}
                fill={fill}
              />
              {next && next.kind !== "final" && (
                <line x1={sx(r.to)} x2={sx(r.to)} y1={y + (rowH + barH) / 2} y2={y + rowH + (rowH - barH) / 2} stroke="var(--ink-4)" />
              )}
              <text x={width} y={y + rowH / 2 + 1} textAnchor="end" dominantBaseline="middle" className={isTotal ? "t-ink" : "t-2"} style={{ fontSize: 12, fontWeight: isTotal ? 600 : 400 }}>
                {isTotal ? fmtNumber(r.to) : fmtSigned(delta)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
