"use client";

import { useState } from "react";
import { useWidth } from "./useWidth";
import { Tooltip, TipValue, useTooltip } from "./ChartTooltip";
import { featureLabel, RISK_THRESHOLD } from "@/lib/features";
import { fmtNumber, fmtSigned } from "@/lib/format";

export interface RiskShift {
  feature: string;
  from: number;
  to: number;
  pass: boolean;
  detail?: string;
}

/**
 * Dumbbell chart of the audit's perturbation experiments: for each feature, the
 * model's risk before (hollow) and after (filled) the feature was changed.
 */
export default function RiskShiftChart({ rows }: { rows: RiskShift[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState<number | null>(null);
  const compact = width < 520;
  const labelW = compact ? 112 : 170;
  const valueW = 56;
  const rowH = 36;
  const top = 24;
  const vals = rows.flatMap((r) => [r.from, r.to]).concat(RISK_THRESHOLD);
  let lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
  let hi = Math.min(100, Math.ceil((Math.max(...vals) + 5) / 10) * 10);
  if (hi - lo < 20) {
    lo = Math.max(0, lo - 10);
    hi = Math.min(100, hi + 10);
  }
  const chartL = labelW + 12;
  const chartR = width - valueW;
  const sx = (v: number) => chartL + ((v - lo) / (hi - lo)) * (chartR - chartL);
  const height = top + rows.length * rowH + 2;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 10) ticks.push(t);

  return (
    <div ref={ref} className="chart-wrap" onPointerLeave={() => (hide(), setActive(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Model risk before and after each perturbation">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 6} y2={height - 2} stroke="var(--line)" />
            <text x={sx(t)} y={top - 12} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <line x1={sx(RISK_THRESHOLD)} x2={sx(RISK_THRESHOLD)} y1={top - 6} y2={height - 2} stroke="var(--ink-2)" strokeDasharray="1 3" strokeLinecap="round" />
        {rows.map((r, i) => {
          const y = top + i * rowH + rowH / 2;
          const d = r.to - r.from;
          const color = r.pass ? "var(--good)" : "var(--warn)";
          const len = Math.abs(sx(r.to) - sx(r.from));
          return (
            <g
              key={`${r.feature}-${i}`}
              data-active={active === i ? "true" : undefined}
              data-dim={active !== null && active !== i ? "true" : undefined}
              onPointerEnter={() => {
                setActive(i);
                show(
                  sx(r.to),
                  y - 8,
                  <TipValue
                    value={`${fmtNumber(r.from)} → ${fmtNumber(r.to)}`}
                    label={`${featureLabel(r.feature)} · ${fmtSigned(d)} pts`}
                    sub={r.detail ?? (r.pass ? "Passed" : "Did not pass")}
                  />,
                );
              }}
            >
              <rect x={0} y={y - rowH / 2} width={width} height={rowH} className="hit" />
              <text x={0} y={y + 1} dominantBaseline="middle" className="t-body t-ink">
                {featureLabel(r.feature)}
              </text>
              <line
                className="hover-lift anim-draw"
                style={{ "--i": i, "--len": Math.max(1, len) } as React.CSSProperties}
                x1={sx(r.from)}
                x2={sx(r.to)}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle cx={sx(r.from)} cy={y} r={5} fill="var(--s1)" stroke="var(--ink-2)" strokeWidth={2} />
              <circle className="anim-pop hover-lift" style={{ "--i": i * 20 + 40 } as React.CSSProperties} cx={sx(r.to)} cy={y} r={5.5} fill={color} stroke="var(--s1)" strokeWidth={2} />
              <text x={width} y={y + 1} textAnchor="end" dominantBaseline="middle" className="t-ink" style={{ fontSize: 12 }}>
                {fmtSigned(d)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
