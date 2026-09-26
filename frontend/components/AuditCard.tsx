"use client";

import { useState, useEffect } from "react";
import { type XAIAuditReport } from "@/lib/api";

interface AuditCardProps {
  audit: XAIAuditReport;
}

export default function AuditCard({ audit }: AuditCardProps) {
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(new Set());

  useEffect(() => {
    const metrics = ["faithfulness", "stability", "sensitivity"];
    metrics.forEach((metric, index) => {
      setTimeout(() => {
        setVisibleMetrics((prev) => new Set([...prev, metric]));
      }, index * 300);
    });
  }, []);

  const getVerdictIcon = (verdict: string) => {
    if (verdict === "HIGH") return "✓";
    if (verdict === "MEDIUM") return "⚠";
    return "✗";
  };

  const getVerdictClass = (verdict: string) => {
    if (verdict === "HIGH") return "v-high";
    if (verdict === "MEDIUM") return "v-med";
    return "v-low";
  };

  const getOverallClass = (verdict: string) => {
    if (verdict === "SUPPORTED") return "v-high";
    if (verdict === "SUPPORTED WITH CAUTION") return "v-med";
    return "v-low";
  };

  const metrics = [
    { key: "faithfulness", label: "Faithfulness", data: audit.faithfulness },
    { key: "stability", label: "Stability", data: audit.stability },
    { key: "sensitivity", label: "Sensitivity", data: audit.sensitivity },
  ];

  return (
    <div className="audit-card">
      <h3 style={{ marginBottom: 20 }}>XAI Audit</h3>
      <div className="audit-metrics">
        {metrics.map(({ key, label, data }) => (
          <div
            key={key}
            className={`audit-metric ${visibleMetrics.has(key) ? "visible" : ""}`}
          >
            <div className="metric-header">
              <span className="metric-label">{label}</span>
              <span className={`verdict ${getVerdictClass(data.verdict)}`}>
                {getVerdictIcon(data.verdict)} {data.display_level || data.verdict}
              </span>
            </div>
            <div className="metric-score">
              {(data.score * 100).toFixed(0)}%
            </div>
            {data.description && (
              <div className="metric-description">{data.description}</div>
            )}
          </div>
        ))}
      </div>

      <div className="overall-verdict">
        <div className="overall-label">Overall Verdict</div>
        <span className={`verdict ${getOverallClass(audit.overall_verdict)}`}>
          {audit.overall_verdict}
        </span>
        {audit.overall_description && (
          <div className="overall-description">
            {audit.overall_description}
          </div>
        )}
        {audit.summary_lines && audit.summary_lines.length > 0 && (
          <div className="summary-lines">
            {audit.summary_lines.map((line, index) => (
              <div key={index} className="summary-line">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .audit-metric {
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.4s ease-out;
        }
        .audit-metric.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}