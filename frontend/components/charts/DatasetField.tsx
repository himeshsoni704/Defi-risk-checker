"use client";

import { useMemo, useState } from "react";
import { useWidth } from "./useWidth";
import { Tooltip, useTooltip } from "./ChartTooltip";
import { shortAddress } from "@/lib/format";
import type { SampleWallet } from "@/lib/types";

export interface FieldMark {
  score: number;
  decision: string;
}

/**
 * Scatter of dataset wallets: wallet age (x) against repayment ratio (y),
 * colored by the dataset's ground-truth label. Wallets analyzed in this
 * browser get a ring. Nearest-point hover; click to analyze.
 */
export default function DatasetField({
  wallets,
  marks,
  onPick,
  height = 300,
}: {
  wallets: SampleWallet[];
  marks: Record<string, FieldMark>;
  onPick: (address: string) => void;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState<number | null>(null);
  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const xMax = 1500;
  const sx = (v: number) => padL + (Math.min(v, xMax) / xMax) * (width - padL - padR);
  const sy = (v: number) => padT + (1 - v) * (height - padT - padB);

  const pts = useMemo(
    () => wallets.map((w, i) => ({ w, i, x: sx(w.wallet_age_days), y: sy(w.repayment_ratio) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallets, width, height],
  );

  function nearest(px: number, py: number) {
    let best = -1;
    let bd = 24 * 24;
    for (const p of pts) {
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bd) {
        bd = d;
        best = p.i;
      }
    }
    return best;
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const idx = nearest(e.clientX - r.left, e.clientY - r.top);
    setActive(idx >= 0 ? idx : null);
    if (idx < 0) return hide();
    const p = pts[idx];
    const m = marks[p.w.wallet_address.toLowerCase()];
    show(
      p.x,
      p.y,
      <div style={{ display: "grid", gap: 6 }}>
        <div className="tooltip-row">
          <span className="mono" style={{ color: "var(--ink)" }}>
            {shortAddress(p.w.wallet_address, 8, 6)}
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="key-line" style={{ background: p.w.label === 1 ? "var(--up)" : "var(--down)" }} />
            {p.w.label === 1 ? "risky" : "safe"}
          </span>
        </div>
        <div className="tooltip-row">
          <span>Repayment</span>
          <span className="mono" style={{ color: "var(--ink)" }}>
            {(p.w.repayment_ratio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="tooltip-row">
          <span>Wallet age</span>
          <span className="mono" style={{ color: "var(--ink)" }}>
            {Math.round(p.w.wallet_age_days)} d
          </span>
        </div>
        <div className="tooltip-row">
          <span>Liquidations · high-risk tx</span>
          <span className="mono" style={{ color: "var(--ink)" }}>
            {p.w.liquidation_count} · {p.w.high_risk_tx_count}
          </span>
        </div>
        <div style={{ color: m ? "var(--ink)" : "var(--iris-2)", fontSize: 12, borderTop: "1px solid var(--line-2)", paddingTop: 6 }}>
          {m ? `Scored ${m.score.toFixed(1)} · ${m.decision} — click to open` : "Click to analyze"}
        </div>
      </div>,
    );
  }

  return (
    <div ref={ref} className="chart-wrap">
      <svg
        className="chart"
        width={width}
        height={height}
        role="img"
        aria-label={`${wallets.length} dataset wallets plotted by wallet age and repayment ratio`}
        onPointerMove={onMove}
        onPointerLeave={() => {
          hide();
          setActive(null);
        }}
        onClick={() => active !== null && onPick(pts[active].w.wallet_address)}
        style={{ cursor: active !== null ? "pointer" : "default", touchAction: "manipulation" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={`y${t}`}>
            <line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={padL - 8} y={sy(t) + 3.5} textAnchor="end">
              {t === 0 ? "0" : `${t * 100}%`}
            </text>
          </g>
        ))}
        {[0, 500, 1000, 1500].map((t) => (
          <text key={`x${t}`} x={sx(t)} y={height - 10} textAnchor={t === 0 ? "start" : t === 1500 ? "end" : "middle"}>
            {t === 1500 ? "1,500 d" : t.toLocaleString("en-US")}
          </text>
        ))}
        {pts.map((p) => (
          <circle
            key={p.w.wallet_address}
            className="anim-pop"
            style={{ "--i": p.i } as React.CSSProperties}
            cx={p.x}
            cy={p.y}
            r={active === p.i ? 6.5 : 4.2}
            fill={p.w.label === 1 ? "var(--up)" : "var(--down)"}
            fillOpacity={active === null || active === p.i ? 0.9 : 0.45}
            stroke="var(--s1)"
            strokeWidth={1.5}
          />
        ))}
        {pts
          .filter((p) => marks[p.w.wallet_address.toLowerCase()])
          .map((p) => (
            <g key={`m${p.w.wallet_address}`} pointerEvents="none">
              <circle cx={p.x} cy={p.y} r={10} fill="none" stroke="var(--iris)" strokeWidth={1.8} className="anim-pop" />
              <text x={p.x + 14} y={p.y + 4} className="t-ink" style={{ fontWeight: 600 }}>
                {marks[p.w.wallet_address.toLowerCase()].score.toFixed(1)}
              </text>
            </g>
          ))}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
