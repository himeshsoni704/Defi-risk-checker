"use client";

import { type ModelComparison } from "@/lib/api";

interface ComparisonTableProps {
  comparison: ModelComparison;
}

export default function ComparisonTable({ comparison }: ComparisonTableProps) {
  const models = [
    { name: "QSVC", data: comparison.QSVC, highlight: true },
    { name: "XGBoost", data: comparison.XGBoost, highlight: false },
    { name: "SVM", data: comparison.SVM, highlight: false },
  ];

  const metrics = [
    { key: "accuracy", label: "Accuracy", format: (v: number) => `${(v * 100).toFixed(2)}%` },
    { key: "f1", label: "F1 Score", format: (v: number) => `${(v * 100).toFixed(2)}%` },
    { key: "auc", label: "AUC", format: (v: number) => `${(v * 100).toFixed(2)}%` },
    { key: "inference_time_ms", label: "Inference Time", format: (v: number) => `${v.toFixed(1)}ms` },
  ];

  return (
    <div className="comparison-table">
      <h3 style={{ marginBottom: 20 }}>Model Comparison</h3>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              {metrics.map((metric) => (
                <th key={metric.key}>{metric.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.name} className={model.highlight ? "highlight-row" : ""}>
                <td className="model-name">
                  {model.name}
                  {model.highlight && <span className="badge">Quantum</span>}
                </td>
                {metrics.map((metric) => (
                  <td key={metric.key}>
                    {metric.format((model.data as any)[metric.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}