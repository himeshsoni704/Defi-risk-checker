"use client";

import { useWidth } from "./useWidth";
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
export default function ContributionBars({ items, highlight }: { items: ContributionItem[]; highlight?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const rows = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const compact = width < 520;
  const labelW = compact ? 118 : 190;
  const valueW = 52;
  const rowH = compact ? 38 : 34;
  const top = 22;
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
  const height = top + rows.length * rowH + 8;

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg className="chart" width={width} height={height} role="img" aria-label="SHAP feature contributions in risk points">
        {ticks.map((t, i) =>
          (i - (ticks.length - 1) / 2) % tickEvery === 0 ? (
            <g key={t}>
              <line x1={mid + sx(t)} x2={mid + sx(t)} y1={top - 4} y2={height - 6} stroke={t === 0 ? "var(--line-3)" : "var(--line)"} />
              <text x={mid + sx(t)} y={top - 9} textAnchor="middle">
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ) : null,
        )}
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const w = Math.abs(sx(r.value));
          const up = r.value > 0;
          const color = r.value === 0 ? "var(--line-3)" : up ? "var(--risk-up)" : "var(--risk-down)";
          const meta = featureMeta(r.key);
          const isHi = highlight === r.key;
          return (
            <g key={r.key}>
              {isHi && <rect x={0} y={y + 1} width={width} height={rowH - 2} fill="var(--surface-2)" rx={3} />}
              <text x={0} y={y + (compact ? 15 : rowH / 2 + 1)} dominantBaseline={compact ? undefined : "middle"} className="t-strong" style={{ fontFamily: "var(--font-body)", fontSize: 12.5 }}>
                {featureLabel(r.key)}
              </text>
              {r.input !== undefined && (
                <text
                  x={compact ? 0 : labelW}
                  y={compact ? y + 29 : y + rowH / 2 + 1}
                  textAnchor={compact ? "start" : "end"}
                  dominantBaseline={compact ? undefined : "middle"}
                >
                  {formatFeatureValue(meta, r.input)}
                </text>
              )}
              <rect
                x={up ? mid : mid - w}
                y={y + rowH / 2 - 7}
                width={Math.max(w, r.value === 0 ? 0 : 1.5)}
                height={14}
                rx={2}
                fill={color}
                opacity={0.9}
              />
              <text
                x={width}
                y={y + rowH / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fill: r.value === 0 ? "var(--text-3)" : color, fontSize: 12 }}
              >
                {fmtSigned(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
