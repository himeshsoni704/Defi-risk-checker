"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WalletPicker from "@/components/wallet/WalletPicker";
import DatasetField, { type FieldMark } from "@/components/charts/DatasetField";
import { MiniDial } from "@/components/charts/RiskDial";
import { Card, EmptyState, ErrorState, Skeleton, SkeletonBlock, Tag, WalletGlyph } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { useAnalysis, walletKey } from "@/lib/analysis-store";
import { useHealth, useSampleWallets } from "@/lib/queries";
import { useTour } from "@/components/tour/TourProvider";
import { QUANTUM_FEATURES, RISK_THRESHOLD, formatFeatureValue, FEATURE_BY_KEY } from "@/lib/features";
import { fmtNumber, fmtPercent, fmtRelative, shortAddress } from "@/lib/format";
import { decisionTone, overallTone, sentenceCase } from "@/lib/verdicts";
import { withWallet } from "@/components/shell/nav";

export default function DashboardPage() {
  const router = useRouter();
  const tour = useTour();
  const { running, getRecord, history } = useAnalysis();
  const field = useSampleWallets(200);

  const open = (wallet: string) => router.push(`/assess?wallet=${encodeURIComponent(wallet)}${getRecord(wallet) ? "" : "&run=1"}`);

  const marks = useMemo(() => {
    const m: Record<string, FieldMark> = {};
    for (const r of history) m[walletKey(r.score.wallet_address)] = { score: r.score.risk_score, decision: r.score.decision };
    return m;
  }, [history]);

  const safeN = field.data?.filter((w) => w.label === 0).length ?? 0;
  const riskyN = field.data?.filter((w) => w.label === 1).length ?? 0;

  return (
    <main className="page">
      <section className="hero rise">
        <div className="hero-grid">
          <div className="hero-copy" data-tour="quick-analysis">
            <span className="kicker">
              <span className="dot dot-good" /> Quantum ML · SHAP · explanation audit · on-chain proof
            </span>
            <h1 className="hero-title">
              Score the wallet.
              <br />
              <em>See why.</em> Prove it.
            </h1>
            <p className="page-lede" style={{ maxWidth: "52ch" }}>
              A 6-qubit classifier scores DeFi wallets from 0 to 100. Every score comes with its SHAP explanation, an independent test of that explanation, and a
              Keccak256 hash you can anchor on-chain.
            </p>
            <WalletPicker busy={Boolean(running)} onSubmit={open} large />
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={tour.start}>
                <Icon name="compass" /> Take the guided tour
              </button>
              <span className="faint small">
                or press <span className="kbd">⌘K</span> anywhere
              </span>
            </div>
          </div>

          <div className="field-card" data-tour="dataset-field">
            <div className="field-head">
              <div>
                <div className="card-title">The dataset, wallet by wallet</div>
                <div className="card-sub">Wallet age × repayment ratio · hover a point, click to analyze it</div>
              </div>
              <div className="legend">
                <span className="legend-item">
                  <span className="swatch" style={{ background: "var(--down)", borderRadius: "50%" }} /> safe {safeN > 0 && <span className="faint">{safeN}</span>}
                </span>
                <span className="legend-item">
                  <span className="swatch" style={{ background: "var(--up)", borderRadius: "50%" }} /> risky {riskyN > 0 && <span className="faint">{riskyN}</span>}
                </span>
                <span className="legend-item">
                  <span className="swatch" style={{ border: "1.8px solid var(--iris)", borderRadius: "50%", background: "transparent" }} /> analyzed
                </span>
              </div>
            </div>
            {field.error && !field.data ? (
              <div style={{ minHeight: 300, display: "grid", alignItems: "center" }}>
                <ErrorState error={field.error} onRetry={() => field.refetch()} what="dataset wallets" />
              </div>
            ) : !field.data ? (
              <Skeleton h={300} />
            ) : (
              <DatasetField wallets={field.data} marks={marks} onPick={open} />
            )}
            <div className="faint small">
              Dataset labels are ground truth from GET /wallets?limit=200. The model has not seen these colors; they are what it tries to predict.
            </div>
          </div>
        </div>
        <HealthTicker />
      </section>

      <div className="grid g-main">
        <RecentAnalyses />
        <RiskDrivers />
      </div>

      <Pipeline />

      <SampleWallets onOpen={open} />
    </main>
  );
}

function HealthTicker() {
  const health = useHealth();
  const h = health.data;
  if (health.error && !h) {
    return (
      <div className="ticker" data-tour="system-status">
        <div className="ticker-item">
          <span className="dot dot-bad" /> API unreachable
        </div>
        <div className="ticker-item" style={{ borderRight: 0 }}>
          <button className="btn btn-sm" onClick={() => health.refetch()}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      </div>
    );
  }
  const items: [React.ReactNode, React.ReactNode][] = h
    ? [
        [<span key="d" className="dot dot-good dot-live" />, <>API healthy · {h.latencyMs} ms</>],
        ["Model", `${h.quantum_model.model_id} v${h.quantum_model.model_version}`],
        ["Qubits", h.quantum_model.n_qubits],
        ["Test AUC", fmtNumber(h.quantum_model.test_auc, 2)],
        ["Proofs", h.web3.is_live_sepolia ? "Sepolia · live" : "Sepolia · simulated"],
        ["Dataset", `${h.dataset_rows.toLocaleString("en-US")} wallets`],
        ["Server cache", `${h.cached_decisions} decisions`],
      ]
    : [];
  return (
    <div className="ticker" data-tour="system-status" aria-label="System status from GET /health">
      {!h
        ? Array.from({ length: 5 }).map((_, i) => (
            <div className="ticker-item" key={i}>
              <Skeleton w={110} h={12} />
            </div>
          ))
        : items.map(([k, v], i) => (
            <div className="ticker-item" key={i}>
              {k}
              <strong>{v}</strong>
            </div>
          ))}
    </div>
  );
}

function RecentAnalyses() {
  const { history, clearHistory, hydrated } = useAnalysis();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card
      title="Recent analyses"
      sub="Scored from this browser, newest first"
      flush
      tour="recent-analyses"
      i={2}
      actions={
        history.length > 0 ? (
          confirming ? (
            <span className="row">
              <span className="faint small">Remove {history.length}?</span>
              <button className="btn btn-sm btn-danger" onClick={() => (clearHistory(), setConfirming(false))}>
                Clear
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>
                Keep
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
        <div style={{ padding: "0 22px 22px" }}>
          <SkeletonBlock lines={3} />
        </div>
      ) : history.length === 0 ? (
        <div style={{ padding: "0 22px 22px" }}>
          <EmptyState title="Nothing scored yet">
            Analyze a wallet above or click a point in the dataset. Each result lands here with its score, decision, audit verdict and proof status.
          </EmptyState>
        </div>
      ) : (
        <div>
          {history.map((r, idx) => {
            const w = r.score.wallet_address;
            const anchored = r.anchor && r.anchor.decision_hash.toLowerCase() === r.score.decision_hash.toLowerCase();
            return (
              <div className="recent-row rise" key={walletKey(w)} style={{ "--i": idx } as React.CSSProperties}>
                <MiniDial score={r.score.risk_score} />
                <div style={{ minWidth: 0 }}>
                  <Link href={withWallet("/assess", w)} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                    <WalletGlyph address={w} size={18} />
                    <span className="mono" style={{ fontSize: 13.5 }}>
                      {shortAddress(w, 8, 6)}
                    </span>
                    {r.customFeatures && <Tag tone="iris">scenario</Tag>}
                  </Link>
                  <div className="row" style={{ marginTop: 6, gap: 6 }}>
                    <Tag tone={decisionTone(r.score.decision)} icon>
                      {r.score.decision}
                    </Tag>
                    <Link href={withWallet("/audit", w)}>
                      <Tag tone={overallTone(r.score.audit.overall_verdict)} icon>
                        {sentenceCase(r.score.audit.overall_verdict)}
                      </Tag>
                    </Link>
                    <Link href={withWallet("/verify", w)}>{anchored ? <Tag tone="good" icon>anchored</Tag> : <Tag>not anchored</Tag>}</Link>
                    <span className="faint small">{fmtRelative(r.scoredAt)}</span>
                  </div>
                </div>
                <Link href={withWallet("/explain", w)} className="btn btn-sm">
                  Why? <Icon name="arrowRight" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RiskDrivers() {
  const health = useHealth();
  const acc = health.data?.quantum_model.test_accuracy;
  return (
    <Card title="What the model reads" sub="Six features are encoded on six qubits" i={3}>
      <div className="stack" style={{ gap: 16 }}>
        <div style={{ display: "grid", gap: 2 }}>
          {QUANTUM_FEATURES.map((f, i) => (
            <div key={f.key} className="row between" style={{ padding: "9px 0", borderTop: i ? "1px solid var(--line)" : 0, rowGap: 2 }}>
              <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                <span className="mono faint" style={{ fontSize: 11 }}>
                  q{i}
                </span>
                <span style={{ fontWeight: 500 }}>{f.label}</span>
              </span>
              <span className="faint small" style={{ textAlign: "right" }}>
                {f.description.replace(/\.$/, "")}
              </span>
            </div>
          ))}
        </div>
        <div className="notice notice-iris" style={{ gridTemplateColumns: "18px 1fr" }}>
          <Icon name="info" />
          <div>
            Score = P(default) × 100. <strong>{RISK_THRESHOLD} or more is denied.</strong>
            {acc !== undefined && acc !== null && <> Held-out accuracy {fmtPercent(acc, 0)}. </>}
            <Link href="/models" className="link">
              Compare models
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Pipeline() {
  const steps = [
    { icon: "database", name: "12 features", desc: "From the dataset or a scenario you define." },
    { icon: "cpu", name: "QSVC score", desc: "Six features on six qubits. Denied at ≥ 50." },
    { icon: "bars", name: "SHAP", desc: "Risk points each feature adds or removes." },
    { icon: "shield", name: "Audit", desc: "Faithfulness, stability and sensitivity tests." },
    { icon: "chain", name: "Proof", desc: "Keccak256 of the full record, anchored on-chain." },
  ];
  return (
    <section className="stack" style={{ gap: 14 }}>
      <div className="section-head">
        <h2>One request, five stages</h2>
        <p>What POST /score does for every wallet</p>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {steps.map((s, i) => (
          <div key={s.name} className="card rise" style={{ "--i": i + 3, padding: 18, display: "grid", gap: 10 } as React.CSSProperties}>
            <div className="row between">
              <span className="driver-rank" style={{ color: "var(--iris-2)" }}>
                <Icon name={s.icon} className="nav-icon" />
              </span>
              <span className="mono faint" style={{ fontSize: 11 }}>
                0{i + 1}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
            <div className="faint small">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SampleWallets({ onOpen }: { onOpen: (w: string) => void }) {
  const samples = useSampleWallets(12);
  const { getRecord, running } = useAnalysis();
  const cols = ["repayment_ratio", "liquidation_count", "high_risk_tx_count", "wallet_age_days", "balance_stability", "historical_default"] as const;

  return (
    <Card title="Dataset wallets" sub="GET /wallets · six of each label, with the six features the model reads" flush tour="sample-wallets">
      {samples.error && !samples.data ? (
        <div style={{ padding: "0 22px 22px" }}>
          <ErrorState error={samples.error} onRetry={() => samples.refetch()} what="sample wallets" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Label</th>
                {cols.map((c) => (
                  <th key={c} className="r">
                    {FEATURE_BY_KEY[c].label}
                  </th>
                ))}
                <th className="r">Model</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {samples.loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={cols.length + 4}>
                      <Skeleton h={18} />
                    </td>
                  </tr>
                ))}
              {samples.data?.map((w) => {
                const rec = getRecord(w.wallet_address);
                const isRunning = running?.wallet.toLowerCase() === w.wallet_address.toLowerCase();
                return (
                  <tr key={w.wallet_address} className="clickable" onClick={() => onOpen(w.wallet_address)}>
                    <td>
                      <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                        <WalletGlyph address={w.wallet_address} size={22} />
                        <span className="mono">{shortAddress(w.wallet_address, 8, 6)}</span>
                      </span>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 7, flexWrap: "nowrap" }}>
                        <span className="swatch" style={{ background: w.label === 1 ? "var(--up)" : "var(--down)", borderRadius: "50%" }} />
                        {w.label === 1 ? "risky" : "safe"}
                      </span>
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
                        <Tag tone={decisionTone(rec.score.decision)} icon>
                          {fmtNumber(rec.score.risk_score)}
                        </Tag>
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                    <td className="r">
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(w.wallet_address);
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
    </Card>
  );
}
