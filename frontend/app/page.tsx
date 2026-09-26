"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WalletPicker from "@/components/wallet/WalletPicker";
import { Chip, EmptyState, ErrorState, Panel, Skeleton, SkeletonBlock, WalletGlyph } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { useAnalysis, walletKey } from "@/lib/analysis-store";
import { useHealth, useSampleWallets } from "@/lib/queries";
import { useTour } from "@/components/tour/TourProvider";
import { QUANTUM_FEATURES, RISK_THRESHOLD, formatFeatureValue, FEATURE_BY_KEY } from "@/lib/features";
import { fmtDateTime, fmtNumber, fmtPercent, fmtRelative, shortAddress } from "@/lib/format";
import { decisionTone, overallTone, titleCase } from "@/lib/verdicts";
import { withWallet } from "@/components/shell/nav";

export default function DashboardPage() {
  const router = useRouter();
  const tour = useTour();
  const { running } = useAnalysis();

  const open = (wallet: string, hasRecord: boolean) =>
    router.push(`/assess?wallet=${encodeURIComponent(wallet)}${hasRecord ? "" : "&run=1"}`);

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head-text">
          <span className="eyebrow">Overview</span>
          <h1 className="page-title">DeFi wallet risk, with the reasoning attached</h1>
          <p className="page-lede">
            Score a wallet with the quantum classifier, see which features drove the score, test whether that explanation holds up, and anchor the whole
            decision on-chain.
          </p>
        </div>
        <button className="btn" onClick={tour.start}>
          <Icon name="compass" /> Take the guided tour
        </button>
      </div>

      <div className="grid grid-main-side">
        <Panel title="Analyze a wallet" sub="Runs POST /score: QSVC → SHAP → audit → decision hash" tour="quick-analysis">
          <QuickAnalysis onOpen={open} busy={Boolean(running)} />
        </Panel>
        <SystemStatus />
      </div>

      <PipelineStrip />

      <SampleWallets onOpen={open} />

      <div className="grid grid-main-side">
        <RecentAnalyses />
        <RiskDrivers />
      </div>
    </main>
  );
}

function QuickAnalysis({ onOpen, busy }: { onOpen: (w: string, hasRecord: boolean) => void; busy: boolean }) {
  const { getRecord } = useAnalysis();
  return <WalletPicker busy={busy} onSubmit={(w) => onOpen(w, Boolean(getRecord(w)))} />;
}

function SystemStatus() {
  const health = useHealth();
  const h = health.data;
  return (
    <Panel
      title={
        <>
          <span className={`dot ${h && !health.error ? "dot-pos" : health.error ? "dot-neg" : "dot-warn dot-pulse"}`} />
          System status
        </>
      }
      sub={health.updatedAt ? `GET /health · checked ${fmtRelative(health.updatedAt)}` : "GET /health"}
      actions={
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => health.refetch()} aria-label="Refresh status" disabled={health.fetching}>
          {health.fetching ? <span className="spinner" /> : <Icon name="refresh" />}
        </button>
      }
      tour="system-status"
    >
      {health.error && !h ? (
        <ErrorState error={health.error} onRetry={() => health.refetch()} what="the system status" />
      ) : !h ? (
        <SkeletonBlock lines={7} />
      ) : (
        <dl className="kv">
          <dt>API</dt>
          <dd>
            <span className="row" style={{ gap: 8 }}>
              <Chip tone={h.status === "healthy" ? "pos" : "warn"}>{h.status}</Chip>
              <span className="mono num faint">{h.latencyMs} ms</span>
            </span>
          </dd>
          <dt>Model</dt>
          <dd className="mono">
            {h.quantum_model.model_id} v{h.quantum_model.model_version}
          </dd>
          <dt>Circuit</dt>
          <dd>{h.quantum_model.feature_map ?? `${h.quantum_model.n_qubits} qubits`}</dd>
          <dt>Test metrics</dt>
          <dd className="mono num">
            acc {fmtNumber(h.quantum_model.test_accuracy, 2)} · auc {fmtNumber(h.quantum_model.test_auc, 2)} · f1 {fmtNumber(h.quantum_model.test_f1, 2)}
          </dd>
          <dt>Trained</dt>
          <dd>{fmtDateTime(h.quantum_model.trained_at)}</dd>
          <dt>Proof network</dt>
          <dd>
            <span className="row" style={{ gap: 8 }}>
              {h.web3.network}
              <Chip tone={h.web3.is_live_sepolia ? "pos" : "warn"}>{h.web3.is_live_sepolia ? "live" : "simulated"}</Chip>
            </span>
          </dd>
          <dt>Dataset</dt>
          <dd className="mono num">{h.dataset_rows.toLocaleString("en-US")} wallets</dd>
          <dt>Server cache</dt>
          <dd className="mono num">
            {h.cached_decisions} decisions · {h.cached_explanations} explanations
          </dd>
        </dl>
      )}
    </Panel>
  );
}

function PipelineStrip() {
  const steps = [
    { k: "Input", name: "12 wallet features", desc: "From the dataset or a scenario you define." },
    { k: "Model", name: "QSVC risk score", desc: "6 features encoded on 6 qubits. Denied at ≥ 50." },
    { k: "Explain", name: "SHAP attribution", desc: "Risk points each feature adds or removes." },
    { k: "Audit", name: "Explanation audit", desc: "Faithfulness, stability and sensitivity tests." },
    { k: "Proof", name: "Keccak256 on-chain", desc: "Hash of the full decision record, anchored and verifiable." },
  ];
  return (
    <section className="panel" aria-label="How a decision is produced">
      <div className="panel-body" style={{ paddingBlock: 6 }}>
        <div className="pipeline">
          {steps.map((s) => (
            <div className="pipe-step" key={s.k}>
              <span className="pipe-k">{s.k}</span>
              <span className="pipe-name">{s.name}</span>
              <span className="pipe-desc">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SampleWallets({ onOpen }: { onOpen: (w: string, hasRecord: boolean) => void }) {
  const samples = useSampleWallets(12);
  const { getRecord, running } = useAnalysis();
  const cols = ["repayment_ratio", "liquidation_count", "high_risk_tx_count", "wallet_age_days", "balance_stability", "historical_default"] as const;

  return (
    <Panel
      title="Sample wallets"
      sub="GET /wallets · rows from the synthetic dataset, alternating the two labels"
      tight
      tour="sample-wallets"
      actions={samples.error ? <button className="btn btn-sm" onClick={() => samples.refetch()}>Retry</button> : undefined}
    >
      {samples.error && !samples.data ? (
        <div className="panel-body">
          <ErrorState error={samples.error} onRetry={() => samples.refetch()} what="sample wallets" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Dataset label</th>
                {cols.map((c) => (
                  <th key={c} className="r">
                    {FEATURE_BY_KEY[c].label}
                  </th>
                ))}
                <th className="r">Model result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {samples.loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={cols.length + 4}>
                      <Skeleton h={16} />
                    </td>
                  </tr>
                ))}
              {samples.data?.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 4}>
                    <span className="muted">The backend dataset is empty. Generate it with quantum-ml/dataset.py.</span>
                  </td>
                </tr>
              )}
              {samples.data?.map((w) => {
                const rec = getRecord(w.wallet_address);
                const isRunning = running?.wallet.toLowerCase() === w.wallet_address.toLowerCase();
                return (
                  <tr key={w.wallet_address} className="clickable" onClick={() => onOpen(w.wallet_address, Boolean(rec))}>
                    <td>
                      <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                        <WalletGlyph address={w.wallet_address} size={20} />
                        <span className="mono">{shortAddress(w.wallet_address, 8, 6)}</span>
                      </span>
                    </td>
                    <td>
                      <Chip tone={w.label === 1 ? "neg" : "pos"}>{w.label === 1 ? "risky" : "safe"}</Chip>
                    </td>
                    {cols.map((c) => (
                      <td key={c} className="r">
                        {formatFeatureValue(FEATURE_BY_KEY[c], w[c])}
                      </td>
                    ))}
                    <td className="r">
                      {isRunning ? (
                        <span className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                          <span className="spinner" /> scoring
                        </span>
                      ) : rec ? (
                        <span className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "nowrap" }}>
                          <span className="mono num">{fmtNumber(rec.score.risk_score)}</span>
                          <Chip tone={decisionTone(rec.score.decision)}>{rec.score.decision}</Chip>
                        </span>
                      ) : (
                        <span className="faint">not scored</span>
                      )}
                    </td>
                    <td className="r">
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(w.wallet_address, Boolean(rec));
                        }}
                        disabled={Boolean(running)}
                      >
                        {rec ? "Open" : "Analyze"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function RecentAnalyses() {
  const { history, clearHistory, hydrated } = useAnalysis();
  const [confirming, setConfirming] = useState(false);
  return (
    <Panel
      title="Recent analyses"
      sub="Scores produced from this browser, newest first"
      tight
      tour="recent-analyses"
      actions={
        history.length > 0 ? (
          confirming ? (
            <span className="row">
              <span className="faint" style={{ fontSize: 12.5 }}>
                Remove {history.length} from this browser?
              </span>
              <button className="btn btn-sm btn-danger" onClick={() => (clearHistory(), setConfirming(false))}>
                Clear
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>
              <Icon name="trash" /> Clear
            </button>
          )
        ) : undefined
      }
    >
      {!hydrated ? (
        <div className="panel-body">
          <SkeletonBlock lines={3} />
        </div>
      ) : history.length === 0 ? (
        <div className="panel-body">
          <EmptyState title="No analyses yet">
            Analyze a wallet above and it will be listed here with its score, decision, audit verdict and on-chain status. The list is stored in this
            browser only.
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th className="r">Risk</th>
                <th>Decision</th>
                <th>Audit</th>
                <th>Proof</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((r) => {
                const w = r.score.wallet_address;
                const anchored = r.anchor && r.anchor.decision_hash.toLowerCase() === r.score.decision_hash.toLowerCase();
                return (
                  <tr key={walletKey(w)}>
                    <td>
                      <Link href={withWallet("/assess", w)} className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                        <WalletGlyph address={w} size={20} />
                        <span className="mono">{shortAddress(w, 8, 6)}</span>
                        {r.customFeatures && <Chip tone="accent">scenario</Chip>}
                      </Link>
                    </td>
                    <td className="r">{fmtNumber(r.score.risk_score)}</td>
                    <td>
                      <Chip tone={decisionTone(r.score.decision)}>{r.score.decision}</Chip>
                    </td>
                    <td>
                      <Link href={withWallet("/audit", w)}>
                        <Chip tone={overallTone(r.score.audit.overall_verdict)}>{titleCase(r.score.audit.overall_verdict)}</Chip>
                      </Link>
                    </td>
                    <td>
                      <Link href={withWallet("/verify", w)}>
                        {anchored ? <Chip tone="pos">anchored</Chip> : <Chip>not anchored</Chip>}
                      </Link>
                    </td>
                    <td className="faint" style={{ whiteSpace: "nowrap" }}>
                      {fmtRelative(r.scoredAt)}
                    </td>
                    <td className="r">
                      <Link href={withWallet("/explain", w)} className="btn btn-ghost btn-sm">
                        Why? <Icon name="arrowRight" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function RiskDrivers() {
  const health = useHealth();
  const acc = health.data?.quantum_model.test_accuracy;
  return (
    <Panel title="What the model looks at" sub="The six features encoded in the quantum circuit">
      <div className="stack" style={{ gap: 14 }}>
        <ul className="bullets">
          {QUANTUM_FEATURES.map((f) => (
            <li key={f.key}>
              <strong style={{ color: "var(--text)", fontWeight: 600 }}>{f.label}</strong> — {f.description.replace(/\.$/, "")}
            </li>
          ))}
        </ul>
        <hr className="divider" />
        <div className="prose" style={{ fontSize: 13 }}>
          <p>
            The risk score is the classifier&apos;s probability of default × 100. Wallets scoring <strong>{RISK_THRESHOLD} or higher are denied</strong>.
            The other six recorded features are hashed into the decision but are not inputs to this model.
          </p>
          {acc !== undefined && acc !== null && (
            <p>
              On its held-out test set the QSVC is right {fmtPercent(acc, 0)} of the time.{" "}
              <Link href="/models" className="link">
                Compare with the classical baselines
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
