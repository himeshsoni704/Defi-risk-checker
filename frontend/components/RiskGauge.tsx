"use client";

import { useState, useEffect } from "react";

interface RiskGaugeProps {
  score: number;
  decision: string;
}

export default function RiskGauge({ score, decision }: RiskGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const start = 0;
    const end = score;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(start + (end - start) * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  const getRiskTier = (score: number) => {
    if (score < 30) return { color: "var(--green)", label: "LOW" };
    if (score < 50) return { color: "var(--amber)", label: "MEDIUM" };
    return { color: "var(--red)", label: "HIGH" };
  };

  const tier = getRiskTier(score);
  const isApproved = decision === "APPROVED";

  return (
    <div className="risk-gauge">
      <div className="score-dial">
        <div
          className="score-number"
          style={{ color: tier.color }}
        >
          {displayScore.toFixed(1)}
        </div>
        <div className="score-scale">risk score / 100</div>
        <span
          className={`pill ${isApproved ? "pill-approve" : "pill-deny"}`}
          style={{ marginTop: 16 }}
        >
          {decision}
        </span>
        <div
          className="risk-tier"
          style={{ color: tier.color, marginTop: 12, fontSize: 13, fontWeight: 600 }}
        >
          {tier.label} RISK
        </div>
      </div>
    </div>
  );
}