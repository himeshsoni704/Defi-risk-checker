"use client";

import { useState } from "react";
import { useWidth } from "./useWidth";
import { Tooltip, TipValue, useTooltip } from "./ChartTooltip";
import { AUDIT_RULES } from "@/lib/features";

/**
 * Spearman rank correlation between the original SHAP ranking and each
 * micro-perturbed clone, against the auditor's HIGH / MEDIUM thresholds.
 */
export default function CorrelationChart({ clones, mean }: { clones: { seed: number; rank_correlation: number }[]; mean: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState<number | null>(null);
  const height = 210;
  const padL = 34;
  const padR = 60;
  const top = 18;
  const bottom = 30;
  const plotH = height - top - bottom;
  const lo = Math.min(0, ...clones.map((c) => c.rank_correlation));
  const hi = 1;
  const sy = (v: number) => top + (1 - (v - lo) / (hi - lo)) * plotH;
  const n = Math.max(clones.length, 1);
  const slot = (width - padL - padR) / n;
  const barW = Math.min(24, slot * 0.5);
  const ticks = [lo < 0 ? lo : 0, 0.25, 0.5, 0.75, 1].filter((t, i, a) => a.indexOf(t) === i);

  return (
    <div ref={ref} className="chart-wrap" onPointerLeave={() => (hide(), setActive(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label={`Rank correlation per clone, mean ${mean.toFixed(3)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={padL - 8} y={sy(t) + 3.5} textAnchor="end">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {[
          { v: AUDIT_RULES.stabilityHigh, label: "high", color: "var(--good)" },
          { v: AUDIT_RULES.stabilityMedium, label: "medium", color: "var(--warn)" },
        ].map((m) => (
          <g key={m.label}>
            <line x1={padL} x2={width - padR} y1={sy(m.v)} y2={sy(m.v)} stroke={m.color} strokeOpacity={0.6} />
            <text x={width - padR + 8} y={sy(m.v) + 3.5} className="t-2">
              {m.label} {m.v}
            </text>
          </g>
        ))}
        {clones.map((c, i) => {
          const cx = padL + slot * i + slot / 2;
          const v = c.rank_correlation;
          const color = v >= AUDIT_RULES.stabilityHigh ? "var(--good)" : v >= AUDIT_RULES.stabilityMedium ? "var(--warn)" : "var(--bad)";
          const y0 = sy(Math.max(0, lo));
          const y1 = sy(v);
          return (
            <g
              key={c.seed}
              data-active={active === i ? "true" : undefined}
              data-dim={active !== null && active !== i ? "true" : undefined}
              onPointerEnter={() => {
                setActive(i);
                show(cx, Math.min(y0, y1), <TipValue value={`ρ ${v.toFixed(3)}`} label={`Clone ${i + 1}`} sub={`Seed ${c.seed}`} />);
              }}
            >
              <rect x={cx - slot / 2} y={top} width={slot} height={plotH} className="hit" />
              <rect
                className="hover-lift anim-bar-y"
                style={{ "--i": i } as React.CSSProperties}
                x={cx - barW / 2}
                y={Math.min(y0, y1)}
                width={barW}
                height={Math.max(2, Math.abs(y0 - y1))}
                rx={4}
                fill={color}
              />
              <text x={cx} y={height - 10} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          );
        })}
        <line x1={padL} x2={width - padR} y1={sy(mean)} y2={sy(mean)} stroke="var(--iris)" strokeWidth={2} />
        <text x={padL} y={top - 6} style={{ fill: "var(--iris-2)" }}>
          — mean ρ {mean.toFixed(3)}
        </text>
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
