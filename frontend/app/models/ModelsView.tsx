"use client";

import { useComparison, useHealth } from "@/lib/queries";
import MetricBars, { type MetricSeries } from "@/components/charts/MetricBars";
import { Chip, EmptyState, ErrorState, Notice, Panel, SkeletonBlock } from "@/components/ui/primitives";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import type { ModelComparison, ModelMetrics } from "@/lib/types";

const METRICS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "f1", label: "F1" },
  { key: "auc", label: "ROC AUC" },
];

const SERIES_COLORS = ["var(--accent)", "#b9a3e8", "#6fc7c1", "#e0b56c", "#9aa6b2"];

function isQuantum(name: string) {
  return /qsvc|quantum/i.test(name);
}

/** Normalises /compare, which returns either a model map or a fallback with a note. */
function parse(data: ModelComparison) {
  const note = typeof data.note === "string" ? data.note : null;
  const models = Object.entries(data)
    .filter(([k, v]) => k !== "note" && v && typeof v === "object")
    .map(([name, raw]) => {
      const m = raw as ModelMetrics;
      // The fallback shape carries raw QSVC metadata (test_accuracy, …).
      const accuracy = num(m.accuracy ?? m.test_accuracy);
      const f1 = num(m.f1 ?? m.test_f1);
      const auc = num(m.auc ?? m.test_auc);
      return { name, m, accuracy, f1, auc, quantum: isQuantum(name) || m.model_type === "QSVC" };
    })
    .sort((a, b) => Number(b.quantum) - Number(a.quantum));
  return { note, models };
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export default function ModelsView() {
  const q = useComparison();
  const health = useHealth();

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head-text">
          <span className="eyebrow">Reference</span>
          <h1 className="page-title">Model comparison</h1>
          <p className="page-lede">
            Held-out test metrics for the quantum classifier that makes the decisions and the classical baselines trained on the same synthetic dataset. Values come
            from GET /compare as stored by the training scripts.
          </p>
        </div>
      </div>

      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} what="the model comparison" />
      ) : !q.data ? (
        <div className="stack">
          <Panel tour="model-table">
            <SkeletonBlock lines={5} />
          </Panel>
        </div>
      ) : (
        <ModelsBody data={q.data} trainedAt={health.data?.quantum_model.trained_at} />
      )}
    </main>
  );
}

function ModelsBody({ data, trainedAt }: { data: ModelComparison; trainedAt?: number | string | null }) {
  const { note, models } = parse(data);
  if (models.length === 0) {
    return (
      <Panel>
        <EmptyState title="No models reported">{note ?? "The API returned an empty comparison."}</EmptyState>
      </Panel>
    );
  }

  const series: MetricSeries[] = models.map((m, i) => ({
    name: m.name,
    color: m.quantum ? "var(--accent)" : SERIES_COLORS[(i % (SERIES_COLORS.length - 1)) + 1],
    values: { accuracy: m.accuracy, f1: m.f1, auc: m.auc },
  }));
  const quantum = models.find((m) => m.quantum);
  const classical = models.filter((m) => !m.quantum && m.accuracy !== undefined);
  const bestClassical = classical.sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0];

  return (
    <>
      {note && (
        <Notice tone="warn" title="Baselines not trained.">
          {note}
        </Notice>
      )}

      <Panel title="Test-set metrics" sub="One row per model returned by the API" tight tour="model-table">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="r">Accuracy</th>
                <th className="r">F1</th>
                <th className="r">ROC AUC</th>
                <th className="r">Inference / sample</th>
                <th className="r">Features</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.name}>
                  <td>
                    <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <span className="legend-swatch" style={{ background: series.find((s) => s.name === m.name)?.color }} />
                      <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{m.name}</span>
                      {m.quantum && <Chip tone="accent">in production</Chip>}
                    </span>
                  </td>
                  <td className="r">{fmtNumber(m.accuracy, 4)}</td>
                  <td className="r">{fmtNumber(m.f1, 4)}</td>
                  <td className="r">{fmtNumber(m.auc, 4)}</td>
                  <td className="r">
                    {typeof m.m.inference_ms_per_sample === "number" ? `${m.m.inference_ms_per_sample} ms` : (m.m.inference_ms_per_sample ?? "—")}
                  </td>
                  <td className="r">{typeof m.m.n_features === "number" ? m.m.n_features : "—"}</td>
                  <td className="muted" style={{ minWidth: 200 }}>
                    {typeof m.m.notes === "string" ? m.m.notes : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-main-side">
        <Panel title="Side by side" sub="Axis fixed at 0–1">
          <div className="stack" style={{ gap: 14 }}>
            <MetricBars metrics={METRICS} series={series} />
            <div className="legend">
              {series.map((s) => (
                <span className="legend-item" key={s.name}>
                  <span className="legend-swatch" style={{ background: s.color }} /> {s.name}
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Reading the comparison">
          <div className="prose" style={{ fontSize: 13 }}>
            {quantum && bestClassical && quantum.accuracy !== undefined && bestClassical.accuracy !== undefined && (
              <p>
                On this dataset the best classical baseline ({bestClassical.name}) reaches {fmtNumber(bestClassical.accuracy, 4)} accuracy against{" "}
                {fmtNumber(quantum.accuracy, 4)} for the QSVC.
                {typeof quantum.m.n_features === "number" && typeof bestClassical.m.n_features === "number" && (
                  <>
                    {" "}
                    The baselines use {bestClassical.m.n_features} features; the QSVC uses {quantum.m.n_features}, one per qubit.
                  </>
                )}
              </p>
            )}
            <p>
              The QSVC runs on a statevector simulator, which is why the API reports no per-sample inference time for it. Its kernel is computed exactly rather
              than estimated from shots.
            </p>
            <p>
              Decisions, explanations, audits and proofs in this app all come from the QSVC. The baselines are reference points only and are not called at scoring
              time.
            </p>
            {trainedAt !== undefined && trainedAt !== null && <p className="faint">QSVC trained {fmtDateTime(trainedAt)}.</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
