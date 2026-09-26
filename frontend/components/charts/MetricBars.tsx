"use client";

import { useWidth } from "./useWidth";

export interface MetricSeries {
  name: string;
  color: string;
  values: Record<string, number | undefined>;
}

/**
 * Grouped horizontal bars on a fixed 0–1 axis, one group per metric. The axis
 * never starts above zero so differences between models are not exaggerated.
 */
export default function MetricBars({ metrics, series }: { metrics: { key: string; label: string }[]; series: MetricSeries[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const compact = width < 520;
  const labelW = compact ? 70 : 92;
  const valueW = 50;
  const barH = 12;
  const gap = 4;
  const groupGap = 18;
  const top = 20;
  const groupH = series.length * (barH + gap) - gap;
  const height = top + metrics.length * (groupH + groupGap);
  const chartL = labelW;
  const chartR = width - valueW;
  const sx = (v: number) => chartL + v * (chartR - chartL);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Model metrics comparison">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 4} y2={height - groupGap + 4} stroke="var(--line)" />
            <text x={sx(t)} y={top - 9} textAnchor="middle">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {metrics.map((m, gi) => {
          const gy = top + gi * (groupH + groupGap);
          return (
            <g key={m.key}>
              <text x={0} y={gy + groupH / 2 + 1} dominantBaseline="middle" className="t-strong" style={{ fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600 }}>
                {m.label}
              </text>
              {series.map((s, si) => {
                const v = s.values[m.key];
                const y = gy + si * (barH + gap);
                if (v === undefined || Number.isNaN(v)) {
                  return (
                    <text key={s.name} x={chartL + 4} y={y + barH / 2 + 1} dominantBaseline="middle">
                      not reported
                    </text>
                  );
                }
                return (
                  <g key={s.name}>
                    <rect x={chartL} y={y} width={Math.max(1.5, sx(v) - chartL)} height={barH} rx={2} fill={s.color} />
                    <text x={width} y={y + barH / 2 + 1} textAnchor="end" dominantBaseline="middle" className="t-strong">
                      {v.toFixed(3)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
