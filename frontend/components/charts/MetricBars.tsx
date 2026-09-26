"use client";

import { useState } from "react";
import { useWidth } from "./useWidth";
import { Tooltip, useTooltip } from "./ChartTooltip";

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
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState<string | null>(null);
  const compact = width < 520;
  const labelW = compact ? 70 : 96;
  const valueW = 52;
  const barH = 14;
  const gap = 4;
  const groupGap = 26;
  const top = 24;
  const groupH = series.length * (barH + gap) - gap;
  const height = top + metrics.length * (groupH + groupGap) - groupGap + 6;
  const chartL = labelW;
  const chartR = width - valueW;
  const sx = (v: number) => chartL + v * (chartR - chartL);

  return (
    <div ref={ref} className="chart-wrap" onPointerLeave={() => (hide(), setActive(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Model metrics comparison">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 6} y2={height} stroke="var(--line)" />
            <text x={sx(t)} y={top - 12} textAnchor="middle">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {metrics.map((m, gi) => {
          const gy = top + gi * (groupH + groupGap);
          return (
            <g key={m.key}>
              <text x={0} y={gy + groupH / 2 + 1} dominantBaseline="middle" className="t-body t-ink" style={{ fontWeight: 600 }}>
                {m.label}
              </text>
              {series.map((s, si) => {
                const v = s.values[m.key];
                const y = gy + si * (barH + gap);
                const id = `${m.key}:${s.name}`;
                if (v === undefined || Number.isNaN(v)) {
                  return (
                    <text key={s.name} x={chartL + 4} y={y + barH / 2 + 1} dominantBaseline="middle">
                      not reported
                    </text>
                  );
                }
                return (
                  <g
                    key={s.name}
                    data-active={active === id ? "true" : undefined}
                    data-dim={active !== null && !active.endsWith(`:${s.name}`) ? "true" : undefined}
                    onPointerEnter={() => {
                      setActive(id);
                      show(
                        sx(v),
                        y,
                        <div style={{ display: "grid", gap: 6 }}>
                          <div className="tooltip-value">{v.toFixed(4)}</div>
                          <div className="row" style={{ gap: 6 }}>
                            <span className="key-line" style={{ background: s.color }} />
                            {s.name} · {m.label}
                          </div>
                        </div>,
                      );
                    }}
                  >
                    <rect x={chartL} y={y - gap / 2} width={chartR - chartL} height={barH + gap} className="hit" />
                    <rect
                      className="hover-lift anim-bar-x"
                      style={{ "--i": gi * series.length + si } as React.CSSProperties}
                      x={chartL}
                      y={y}
                      width={Math.max(2, sx(v) - chartL)}
                      height={barH}
                      rx={4}
                      fill={s.color}
                    />
                    <text x={width} y={y + barH / 2 + 1} textAnchor="end" dominantBaseline="middle" className="t-ink">
                      {v.toFixed(3)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
