"use client";

import { useWidth } from "./useWidth";
import { RISK_THRESHOLD } from "@/lib/features";

/**
 * Linear 0–100 risk ruler. The approve zone (< 50) and deny zone (≥ 50) come
 * from the model's decision rule; the marker is the actual risk score.
 */
export default function RiskScale({
  score,
  baseValue,
  height = 74,
}: {
  score: number;
  /** Optional SHAP expected value, drawn as a hollow tick. */
  baseValue?: number;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const padX = 12;
  const inner = width - padX * 2;
  const x = (v: number) => padX + (Math.max(0, Math.min(100, v)) / 100) * inner;
  const trackY = 30;
  const trackH = 10;
  const denied = score >= RISK_THRESHOLD;
  const markerColor = denied ? "var(--neg)" : "var(--pos)";
  const labelX = Math.max(padX + 40, Math.min(width - padX - 40, x(score)));

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg className="chart" width={width} height={height} role="img" aria-label={`Risk score ${score.toFixed(1)} of 100. Decision threshold ${RISK_THRESHOLD}.`}>
        <rect x={x(0)} y={trackY} width={x(RISK_THRESHOLD) - x(0)} height={trackH} rx={2} fill="var(--pos-soft)" stroke="var(--pos-line)" />
        <rect x={x(RISK_THRESHOLD)} y={trackY} width={x(100) - x(RISK_THRESHOLD)} height={trackH} rx={2} fill="var(--neg-soft)" stroke="var(--neg-line)" />
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={trackY + trackH + 3} y2={trackY + trackH + 7} stroke="var(--line-3)" />
            <text x={x(t)} y={trackY + trackH + 19} textAnchor={t === 0 ? "start" : t === 100 ? "end" : "middle"}>
              {t}
            </text>
          </g>
        ))}
        <line x1={x(RISK_THRESHOLD)} x2={x(RISK_THRESHOLD)} y1={trackY - 8} y2={trackY + trackH + 2} stroke="var(--text-2)" strokeDasharray="2 2" />
        <text x={x(RISK_THRESHOLD) + 5} y={trackY - 2} className="t-2">
          deny ≥ {RISK_THRESHOLD}
        </text>
        <text x={x(2)} y={trackY - 2} style={{ fill: "var(--pos)" }}>
          approve
        </text>

        {baseValue !== undefined && (
          <g>
            <line x1={x(baseValue)} x2={x(baseValue)} y1={trackY - 2} y2={trackY + trackH + 2} stroke="var(--text-2)" strokeWidth={1.5} />
            <circle cx={x(baseValue)} cy={trackY + trackH / 2} r={3.5} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={1.5} />
          </g>
        )}

        <line x1={x(score)} x2={x(score)} y1={trackY - 4} y2={trackY + trackH + 4} stroke={markerColor} strokeWidth={2.5} />
        <circle cx={x(score)} cy={trackY + trackH / 2} r={6} fill={markerColor} stroke="var(--surface)" strokeWidth={2} />
        <text x={labelX} y={12} textAnchor="middle" className="t-strong" style={{ fontSize: 11.5 }}>
          {score.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}
