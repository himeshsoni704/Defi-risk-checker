"use client";

import { useWidth } from "./useWidth";
import { RISK_THRESHOLD } from "@/lib/features";
import { featureLabel } from "@/lib/features";
import { fmtSigned } from "@/lib/format";

export interface RiskShift {
  feature: string;
  from: number;
  to: number;
  pass: boolean;
}

/**
 * Dumbbell chart of the audit's perturbation experiments: for each feature, the
 * model's risk before (hollow) and after (filled) the feature was changed.
 */
export default function RiskShiftChart({ rows }: { rows: RiskShift[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const compact = width < 520;
  const labelW = compact ? 112 : 160;
  const valueW = 56;
  const rowH = 30;
  const top = 22;
  const vals = rows.flatMap((r) => [r.from, r.to]).concat(RISK_THRESHOLD);
  let lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
  let hi = Math.min(100, Math.ceil((Math.max(...vals) + 5) / 10) * 10);
  if (hi - lo < 20) {
    lo = Math.max(0, lo - 10);
    hi = Math.min(100, hi + 10);
  }
  const chartL = labelW + 10;
  const chartR = width - valueW;
  const sx = (v: number) => chartL + ((v - lo) / (hi - lo)) * (chartR - chartL);
  const height = top + rows.length * rowH + 4;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 10) ticks.push(t);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Model risk before and after each perturbation">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 4} y2={height - 2} stroke="var(--line)" />
            <text x={sx(t)} y={top - 9} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <line x1={sx(RISK_THRESHOLD)} x2={sx(RISK_THRESHOLD)} y1={top - 4} y2={height - 2} stroke="var(--text-2)" strokeDasharray="3 3" />
        {rows.map((r, i) => {
          const y = top + i * rowH + rowH / 2;
          const d = r.to - r.from;
          const color = r.pass ? "var(--pos)" : "var(--warn)";
          return (
            <g key={`${r.feature}-${i}`}>
              <text x={0} y={y + 1} dominantBaseline="middle" className="t-strong" style={{ fontFamily: "var(--font-body)", fontSize: 12.5 }}>
                {featureLabel(r.feature)}
              </text>
              <line x1={sx(r.from)} x2={sx(r.to)} y1={y} y2={y} stroke={color} strokeWidth={2} opacity={0.7} />
              <circle cx={sx(r.from)} cy={y} r={4.5} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.5} />
              <circle cx={sx(r.to)} cy={y} r={4.5} fill={color} />
              <text x={width} y={y + 1} textAnchor="end" dominantBaseline="middle" style={{ fill: color, fontSize: 12 }}>
                {fmtSigned(d)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
