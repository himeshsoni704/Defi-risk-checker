"use client";

import { useEffect, useState } from "react";
import { RISK_THRESHOLD } from "@/lib/features";
import { useCountUp } from "@/components/ui/primitives";

const START = 135; // degrees, measured clockwise from 3 o'clock
const SWEEP = 270;
const TICKS = 100;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/**
 * Precision risk dial: 100 ticks across a 270° arc, one per risk point. Ticks
 * up to the score light up in sequence; ticks at or above the deny threshold
 * use the deny color. The center number counts up to the score.
 */
export default function RiskDial({ score, label }: { score: number; label?: React.ReactNode }) {
  const [lit, setLit] = useState(0);
  const shown = useCountUp(score, 1300);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setLit(score);
      return;
    }
    setLit(0);
    const t = setTimeout(() => setLit(score), 60);
    return () => clearTimeout(t);
  }, [score]);

  const cx = 150;
  const cy = 150;
  const denied = score >= RISK_THRESHOLD;
  const threshAngle = START + (RISK_THRESHOLD / 100) * SWEEP;
  const [tx1, ty1] = polar(cx, cy, 142, threshAngle);
  const [tx2, ty2] = polar(cx, cy, 100, threshAngle);
  const [lx, ly] = polar(cx, cy, 152, threshAngle);
  const scoreAngle = START + (Math.min(100, Math.max(0, shown)) / 100) * SWEEP;
  const [nx, ny] = polar(cx, cy, 128, scoreAngle);

  return (
    <div className="dial" role="img" aria-label={`Risk score ${score.toFixed(1)} out of 100; deny threshold ${RISK_THRESHOLD}`}>
      <svg viewBox="0 -16 300 274">
        {Array.from({ length: TICKS + 1 }).map((_, i) => {
          const deg = START + (i / TICKS) * SWEEP;
          const major = i % 10 === 0;
          const [x1, y1] = polar(cx, cy, major ? 104 : 110, deg);
          const [x2, y2] = polar(cx, cy, 126, deg);
          const on = i <= lit && lit > 0;
          const deny = i >= RISK_THRESHOLD;
          const color = on ? (deny ? "var(--bad)" : denied ? "var(--warn)" : "var(--good)") : "var(--line-3)";
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={major ? 2.2 : 1.6}
              strokeLinecap="round"
              style={{ transition: `stroke 0.25s ease ${on ? i * 11 : 0}ms`, opacity: on ? 1 : major ? 0.9 : 0.55 }}
            />
          );
        })}
        {[0, 25, 50, 75, 100].map((v) => {
          const [x, y] = polar(cx, cy, 86, START + (v / 100) * SWEEP);
          return (
            <text key={v} x={x} y={y + 3.5} textAnchor="middle" style={{ fill: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
              {v}
            </text>
          );
        })}
        <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="2 3" />
        <text x={lx + 6} y={ly - 2} style={{ fill: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
          deny ≥ {RISK_THRESHOLD}
        </text>
        <circle cx={nx} cy={ny} r={6} fill={denied ? "var(--bad)" : "var(--good)"} stroke="var(--s1)" strokeWidth={3} />
      </svg>
      <div className="dial-center">
        <div className="dial-value" style={{ color: denied ? "var(--bad)" : "var(--ink)" }}>
          {shown.toFixed(1)}
        </div>
        <div className="dial-unit">{label ?? "risk score / 100"}</div>
      </div>
    </div>
  );
}

/** 36px ring used in lists: arc length is the risk score. */
export function MiniDial({ score }: { score: number }) {
  const r = 14;
  const c = 2 * Math.PI * r * 0.75;
  const denied = score >= RISK_THRESHOLD;
  return (
    <svg className="mini-dial" viewBox="0 0 36 36" aria-hidden>
      <g transform="rotate(135 18 18)">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--s3)" strokeWidth="3.5" strokeDasharray={`${c} 999`} strokeLinecap="round" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={denied ? "var(--bad)" : "var(--good)"}
          strokeWidth="3.5"
          strokeDasharray={`${(score / 100) * c} 999`}
          strokeLinecap="round"
        />
      </g>
      <text x="18" y="21.5" textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 9.5, fontWeight: 600, fontFamily: "var(--font-body)" }}>
        {Math.round(score)}
      </text>
    </svg>
  );
}
