"use client";

import { useWidth } from "./useWidth";
import { featureLabel } from "@/lib/features";
import { fmtNumber, fmtSigned } from "@/lib/format";
import { RISK_THRESHOLD } from "@/lib/features";

/**
 * Horizontal SHAP waterfall: starts at the explainer's expected value, applies
 * each non-zero attribution in order of magnitude, and ends at the model's
 * actual risk score. Any gap between the running total and the score (Kernel
 * SHAP sampling + rounding) is drawn as an explicit residual step.
 */
export default function Waterfall({
  base,
  contributions,
  score,
}: {
  base: number;
  contributions: Record<string, number>;
  score: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const steps = Object.entries(contributions)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  type Row = { label: string; from: number; to: number; kind: "base" | "step" | "residual" | "final" };
  const rows: Row[] = [{ label: "Base value", from: 0, to: base, kind: "base" }];
  let running = base;
  for (const [k, v] of steps) {
    rows.push({ label: featureLabel(k), from: running, to: running + v, kind: "step" });
    running += v;
  }
  const residual = Number((score - running).toFixed(2));
  if (Math.abs(residual) >= 0.05) {
    rows.push({ label: "Residual", from: running, to: score, kind: "residual" });
  }
  rows.push({ label: "Risk score", from: 0, to: score, kind: "final" });

  const values = rows.flatMap((r) => (r.kind === "base" || r.kind === "final" ? [r.to] : [r.from, r.to]));
  values.push(RISK_THRESHOLD);
  let lo = Math.floor((Math.min(...values) - 4) / 5) * 5;
  let hi = Math.ceil((Math.max(...values) + 4) / 5) * 5;
  lo = Math.max(0, lo);
  hi = Math.min(100, hi);
  if (hi - lo < 10) hi = Math.min(100, lo + 10);

  const compact = width < 520;
  const labelW = compact ? 104 : 150;
  const valueW = 56;
  const rowH = 30;
  const top = 24;
  const chartL = labelW + 10;
  const chartR = width - valueW;
  const sx = (v: number) => chartL + ((v - lo) / (hi - lo)) * (chartR - chartL);
  const height = top + rows.length * rowH + 6;
  const pxPer5 = ((chartR - chartL) / (hi - lo)) * 5;
  const tickStep = pxPer5 >= 30 ? 5 : pxPer5 >= 15 ? 10 : 20;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / tickStep) * tickStep; t <= hi; t += tickStep) ticks.push(t);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg className="chart" width={width} height={height} role="img" aria-label={`Waterfall from expected value ${base} to risk score ${score}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 4} y2={height - 4} stroke="var(--line)" />
            <text x={sx(t)} y={top - 10} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <line x1={sx(RISK_THRESHOLD)} x2={sx(RISK_THRESHOLD)} y1={top - 4} y2={height - 4} stroke="var(--text-2)" strokeDasharray="3 3" />
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const isTotal = r.kind === "base" || r.kind === "final";
          const x0 = isTotal ? sx(lo) : sx(Math.min(r.from, r.to));
          const x1 = isTotal ? sx(r.to) : sx(Math.max(r.from, r.to));
          const delta = r.to - r.from;
          const fill =
            r.kind === "final"
              ? r.to >= RISK_THRESHOLD
                ? "var(--neg)"
                : "var(--pos)"
              : r.kind === "base"
                ? "var(--line-3)"
                : r.kind === "residual"
                  ? "var(--text-4)"
                  : delta > 0
                    ? "var(--risk-up)"
                    : "var(--risk-down)";
          const next = rows[i + 1];
          return (
            <g key={`${r.label}-${i}`}>
              <text
                x={0}
                y={y + rowH / 2 + 1}
                dominantBaseline="middle"
                className={isTotal ? "t-strong" : "t-2"}
                style={{ fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: isTotal ? 600 : 400 }}
              >
                {r.label}
              </text>
              <rect x={x0} y={y + 7} width={Math.max(1.5, x1 - x0)} height={rowH - 14} rx={2} fill={fill} opacity={isTotal ? 0.85 : 0.95} />
              {next && next.kind !== "final" && (
                <line x1={sx(r.to)} x2={sx(r.to)} y1={y + rowH - 7} y2={y + rowH + 7} stroke="var(--text-3)" strokeDasharray="2 2" />
              )}
              <text
                x={width}
                y={y + rowH / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fill: isTotal ? "var(--text)" : fill, fontSize: 12 }}
              >
                {isTotal ? fmtNumber(r.to) : fmtSigned(delta)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
