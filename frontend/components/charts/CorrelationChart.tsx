"use client";

import { useWidth } from "./useWidth";
import { AUDIT_RULES } from "@/lib/features";

/**
 * Spearman rank correlation between the original SHAP ranking and each
 * micro-perturbed clone, against the auditor's HIGH / MEDIUM thresholds.
 */
export default function CorrelationChart({ clones, mean }: { clones: { seed: number; rank_correlation: number }[]; mean: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 190;
  const padL = 34;
  const padR = 64;
  const top = 12;
  const bottom = 46;
  const plotH = height - top - bottom;
  const lo = Math.min(0, ...clones.map((c) => c.rank_correlation));
  const hi = 1;
  const sy = (v: number) => top + (1 - (v - lo) / (hi - lo)) * plotH;
  const n = Math.max(clones.length, 1);
  const slot = (width - padL - padR) / n;
  const barW = Math.min(36, slot * 0.55);
  const ticks = [lo < 0 ? lo : 0, 0.25, 0.5, 0.75, 1].filter((t, i, a) => a.indexOf(t) === i);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg className="chart" width={width} height={height} role="img" aria-label={`Rank correlation per clone, mean ${mean.toFixed(3)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={padL - 6} y={sy(t) + 3} textAnchor="end">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={width - padR} y1={sy(AUDIT_RULES.stabilityHigh)} y2={sy(AUDIT_RULES.stabilityHigh)} stroke="var(--pos)" strokeDasharray="4 3" />
        <text x={width - padR + 6} y={sy(AUDIT_RULES.stabilityHigh) + 3} style={{ fill: "var(--pos)" }}>
          high {AUDIT_RULES.stabilityHigh}
        </text>
        <line x1={padL} x2={width - padR} y1={sy(AUDIT_RULES.stabilityMedium)} y2={sy(AUDIT_RULES.stabilityMedium)} stroke="var(--warn)" strokeDasharray="4 3" />
        <text x={width - padR + 6} y={sy(AUDIT_RULES.stabilityMedium) + 3} style={{ fill: "var(--warn)" }}>
          med {AUDIT_RULES.stabilityMedium}
        </text>
        {clones.map((c, i) => {
          const cx = padL + slot * i + slot / 2;
          const v = c.rank_correlation;
          const color = v >= AUDIT_RULES.stabilityHigh ? "var(--pos)" : v >= AUDIT_RULES.stabilityMedium ? "var(--warn)" : "var(--neg)";
          const y0 = sy(Math.max(0, lo));
          const y1 = sy(v);
          return (
            <g key={c.seed}>
              <rect x={cx - barW / 2} y={Math.min(y0, y1)} width={barW} height={Math.max(1.5, Math.abs(y0 - y1))} rx={2} fill={color} opacity={0.85} />
              <text x={cx} y={Math.min(y0, y1) - 5} textAnchor="middle" className="t-2">
                {v.toFixed(2)}
              </text>
              <text x={cx} y={top + plotH + 16} textAnchor="middle">
                clone {i + 1}
              </text>
            </g>
          );
        })}
        <line x1={padL} x2={width - padR} y1={sy(mean)} y2={sy(mean)} stroke="var(--accent)" strokeWidth={1.5} />
        <line x1={padL} x2={padL + 18} y1={height - 8} y2={height - 8} stroke="var(--accent)" strokeWidth={1.5} />
        <text x={padL + 24} y={height - 5} style={{ fill: "var(--accent)" }}>
          mean ρ {mean.toFixed(3)}
        </text>
      </svg>
    </div>
  );
}
