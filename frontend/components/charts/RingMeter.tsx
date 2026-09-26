"use client";

import { useEffect, useState } from "react";

/** Circular meter; `fraction` null draws an empty (not measured) ring. */
export default function RingMeter({
  fraction,
  color,
  value,
  unit,
  marks = [],
}: {
  fraction: number | null;
  color: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  marks?: number[];
}) {
  const [f, setF] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setF(Math.max(0, Math.min(1, fraction ?? 0))), 80);
    return () => clearTimeout(t);
  }, [fraction]);
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={fraction === null ? "Not measured" : `${Math.round((fraction ?? 0) * 100)} percent`}>
      <svg viewBox="0 0 108 108">
        <circle className="ring-track" cx="54" cy="54" r={r} strokeWidth="7" />
        {fraction !== null && (
          <circle className="ring-fill" cx="54" cy="54" r={r} strokeWidth="7" stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
        )}
        {marks.map((m) => {
          const a = m * 2 * Math.PI;
          return (
            <line
              key={m}
              x1={54 + (r - 6) * Math.cos(a)}
              y1={54 + (r - 6) * Math.sin(a)}
              x2={54 + (r + 6) * Math.cos(a)}
              y2={54 + (r + 6) * Math.sin(a)}
              stroke="var(--ink-2)"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
      <div className="ring-label">
        <div className="ring-value">{value}</div>
        {unit && <div className="ring-unit">{unit}</div>}
      </div>
    </div>
  );
}
