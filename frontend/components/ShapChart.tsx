"use client";

import { useState, useEffect } from "react";

interface ShapChartProps {
  contributions: Record<string, number>;
}

export default function ShapChart({ contributions }: ShapChartProps) {
  const [animatedValues, setAnimatedValues] = useState<Record<string, number>>({});

  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const newAnimated: Record<string, number> = {};
      Object.entries(contributions).forEach(([key, value]) => {
        newAnimated[key] = value * easeOut;
      });

      setAnimatedValues(newAnimated);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [contributions]);

  const sortedContributions = Object.entries(contributions)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const maxMagnitude = Math.max(
    ...Object.values(contributions).map(Math.abs),
    1
  );

  return (
    <div className="shap-chart">
      <h3 style={{ marginBottom: 20 }}>Feature Contributions (SHAP)</h3>
      <div className="contributions-list">
        {sortedContributions.map(({ name, value }, index) => {
          const animatedValue = animatedValues[name] || 0;
          const isPositive = value >= 0;
          const magnitude = Math.abs(animatedValue);
          const percentage = (magnitude / maxMagnitude) * 100;

          return (
            <div
              key={name}
              className="bar-row"
              style={{
                opacity: 0,
                animation: `fadeIn 0.5s ease-out ${index * 0.1}s forwards`,
              }}
            >
              <div className="feature-name">{name}</div>
              <div className="bar-track">
                <div
                  className={`bar-fill ${isPositive ? "bar-pos" : "bar-neg"}`}
                  style={{
                    width: `${percentage}%`,
                    [isPositive ? "left" : "right"]: "50%",
                  }}
                />
                <div className="bar-mid" />
              </div>
              <div className="bar-val">
                {isPositive ? "+" : ""}{value.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}