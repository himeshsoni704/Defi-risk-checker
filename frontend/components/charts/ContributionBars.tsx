"use client";

import { useState } from "react";
import { useWidth } from "./useWidth";
import { Tooltip, TipValue, useTooltip } from "./ChartTooltip";
import { featureLabel, featureMeta, formatFeatureValue } from "@/lib/features";
import { fmtSigned } from "@/lib/format";

export interface ContributionItem {
  key: string;
  value: number;
  input?: number;
}

/**
 * Diverging bar chart of SHAP attributions in risk points. Bars right of zero
 * raise the risk score, bars left of zero lower it.
 */
export default function ContributionBars({ items }: { items: ContributionItem[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState<number | null>(null);
  const rows = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const compact = width < 520;
  const labelW = compact ? 118 : 200;
  const valueW = 52;
  const rowH = compact ? 42 : 38;
  const barH = 16;
  const top = 24;
  const chartL = labelW + 8;
  const chartR = width - valueW;
  const mid = (chartL + chartR) / 2;
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const step = maxAbs <= 5 ? 1 : maxAbs <= 10 ? 2 : maxAbs <= 25 ? 5 : 10;
  const domain = Math.ceil(maxAbs / step) * step;
  const half = (chartR - chartL) / 2;
  const sx = (v: number) => (v / domain) * half;
  const ticks: number[] = [];
  for (let t = -domain; t <= domain + 1e-9; t += step) ticks.push(Number(t.toFixed(6)));
  const tickPx = (half * step) / domain;
  const tickEvery = tickPx >= 30 ? 1 : tickPx >= 15 ? 2 : 4;
  const height = top + rows.length * rowH + 4;

  return (
    <div ref={ref} className="chart-wrap" onPointerLeave={() => (hide(), setActive(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label="SHAP feature contributions in risk points">
        {ticks.map((t, i) =>
          (i - (ticks.length - 1) / 2) % tickEvery === 0 ? (
            <g key={t}>
              <line x1={mid + sx(t)} x2={mid + sx(t)} y1={top - 6} y2={height - 2} stroke={t === 0 ? "var(--line-3)" : "var(--line)"} />
              <text x={mid + sx(t)} y={top - 12} textAnchor="middle">
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ) : null,
        )}
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const w = Math.abs(sx(r.value));
          const up = r.value > 0;
          const color = r.value === 0 ? "var(--line-3)" : up ? "var(--up)" : "var(--down)";
          const meta = featureMeta(r.key);
          return (
            <g
              key={r.key}
              data-active={active === i ? "true" : undefined}
              data-dim={active !== null && active !== i ? "true" : undefined}
              onPointerEnter={() => {
                setActive(i);
                show(
                  up ? mid + w : mid - w,
                  y + (rowH - barH) / 2,
                  <TipValue
                    value={`${fmtSigned(r.value)} pts`}
                    label={featureLabel(r.key)}
                    sub={`${up ? "Raises" : "Lowers"} risk · input ${formatFeatureValue(meta, r.input)}`}
                  />,
                );
              }}
            >
              <rect x={0} y={y} width={width} height={rowH} className="hit" />
              <text x={0} y={y + (compact ? 16 : rowH / 2 + 1)} dominantBaseline={compact ? undefined : "middle"} className="t-body t-ink">
                {featureLabel(r.key)}
              </text>
              {r.input !== undefined && (
                <text x={compact ? 0 : labelW} y={compact ? y + 31 : y + rowH / 2 + 1} textAnchor={compact ? "start" : "end"} dominantBaseline={compact ? undefined : "middle"}>
                  {formatFeatureValue(meta, r.input)}
                </text>
              )}
              <rect
                className={`hover-lift anim-bar-x${up ? "" : " from-right"}`}
                style={{ "--i": i } as React.CSSProperties}
                x={up ? mid : mid - w}
                y={y + (rowH - barH) / 2}
                width={Math.max(w, 2)}
                height={barH}
                rx={4}
                fill={color}
              />
              <text x={width} y={y + rowH / 2 + 1} textAnchor="end" dominantBaseline="middle" className="t-ink" style={{ fontSize: 12 }}>
                {fmtSigned(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
