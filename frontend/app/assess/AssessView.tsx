"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAnalysis, useWalletParam, type WalletRecord } from "@/lib/analysis-store";
import WalletHeader from "@/components/wallet/WalletHeader";
import WalletPicker from "@/components/wallet/WalletPicker";
import AnalysisProgress from "@/components/wallet/AnalysisProgress";
import ScenarioEditor from "./ScenarioEditor";
import RiskDial from "@/components/charts/RiskDial";
import HashFingerprint from "@/components/charts/HashFingerprint";
import { Card, EmptyState, HashValue, Notice, SkeletonBlock, Tag } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { FEATURES, RISK_THRESHOLD, formatFeatureValue, isDefaultProfile, QUANTUM_FEATURES, RECORDED_ONLY_FEATURES, type FeatureMeta } from "@/lib/features";
import { fmtDateTime, fmtDuration, fmtNumber, fmtSigned } from "@/lib/format";
import { isDenied, overallTone, sentenceCase } from "@/lib/verdicts";
import { withWallet } from "@/components/shell/nav";
import type { WalletFeatures } from "@/lib/types";

export default function AssessView({ urlWallet, autoRun }: { urlWallet?: string; autoRun: boolean }) {
  const router = useRouter();
  const { wallet, hydrated } = useWalletParam(urlWallet);
  const { getRecord, running, lastError, analyze } = useAnalysis();
  const record = getRecord(wallet);
  const isRunning = Boolean(running && wallet && running.wallet.toLowerCase() === wallet.toLowerCase());
  const error = lastError && wallet && lastError.wallet.toLowerCase() === wallet.toLowerCase() ? lastError.message : null;
  const autoRan = useRef(false);

  // ?run=1 starts the analysis once (used by the dashboard, palette and tour).
  useEffect(() => {
    if (!hydrated || !autoRun || !wallet || autoRan.current) return;
    autoRan.current = true;
    router.replace(`/assess?wallet=${encodeURIComponent(wallet)}`, { scroll: false });
    if (!getRecord(wallet) && !running) analyze(wallet);
  }, [hydrated, autoRun, wallet, getRecord, running, analyze, router]);

  const selectWallet = (w: string) => {
    if (wallet && w.toLowerCase() === wallet.toLowerCase()) {
      analyze(w);
      return;
    }
    router.push(`/assess?wallet=${encodeURIComponent(w)}${getRecord(w) ? "" : "&run=1"}`);
  };

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head-text">
          <span className="kicker">
            <span className="step-badge">1</span> Risk assessment
          </span>
          <h1 className="page-title">What the model decided</h1>
          <p className="page-lede">
            The quantum classifier scores the wallet from 0 to 100 and denies at {RISK_THRESHOLD}. The same request explains the score, audits the explanation
            and hashes the decision.
          </p>
        </div>
      </div>

      {!hydrated ? (
        <Card>
          <SkeletonBlock lines={5} />
        </Card>
      ) : !wallet ? (
        <Card title="Choose a wallet" sub="Paste an address or start from a dataset wallet" tour="assess-input" glow i={1}>
          <WalletPicker onSubmit={selectWallet} busy={Boolean(running)} autoFocus large />
        </Card>
      ) : (
        <>
          <WalletHeader wallet={wallet} />
          <div className="grid g-main">
            <div className="stack">
              {isRunning && running ? (
                <AnalysisProgress wallet={running.wallet} startedAt={running.startedAt} custom={running.custom} />
              ) : error ? (
                <Notice
                  tone="bad"
                  title="The analysis failed."
                  actions={
                    <button className="btn btn-sm" onClick={() => analyze(wallet)}>
                      <Icon name="refresh" /> Try again
                    </button>
                  }
                >
                  {error}
                </Notice>
              ) : null}

              {!isRunning && record && <ResultCard key={record.score.decision_hash} record={record} onRerun={() => analyze(wallet)} busy={Boolean(running)} />}

              {!isRunning && !record && !error && (
                <Card glow i={2}>
                  <EmptyState
                    title="Not analyzed yet"
                    actions={
                      <button className="btn btn-primary" onClick={() => analyze(wallet)} disabled={Boolean(running)}>
                        <Icon name="play" /> Analyze wallet
                      </button>
                    }
                  >
                    Running the analysis calls POST /score. It usually takes one to three seconds.
                  </EmptyState>
                </Card>
              )}

              {!isRunning && record && <FeatureLedger key={`l-${record.score.decision_hash}`} record={record} />}
            </div>

            <div className="stack">
              <Card title="Wallet & scenario" sub="Analyze another address, or override this one's features" tour="assess-input" i={3}>
                <div className="stack">
                  <WalletPicker initial={wallet} onSubmit={selectWallet} busy={isRunning} disabled={Boolean(running)} samples={0} />
                  <hr className="divider" />
                  <ScenarioEditor
                    base={(record?.score.features as WalletFeatures | undefined) ?? null}
                    disabled={Boolean(running)}
                    onRun={(features) => analyze(wallet, features)}
                  />
                </div>
              </Card>
              {record && !isRunning && <ModelInfo record={record} />}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function ResultCard({ record, onRerun, busy }: { record: WalletRecord; onRerun: () => void; busy: boolean }) {
  const s = record.score;
  const denied = isDenied(s.decision);
  const anchored = record.anchor && record.anchor.decision_hash.toLowerCase() === s.decision_hash.toLowerCase();
  const [confirm, setConfirm] = useState(false);
  const usedDefaults = !record.customFeatures && isDefaultProfile(s.features);
  const distance = s.risk_score - RISK_THRESHOLD;
  const tone = overallTone(s.audit.overall_verdict);

  return (
    <section className="card card-glow rise" data-tour="risk-result" style={{ "--i": 2 } as React.CSSProperties}>
      <header className="card-head">
        <div>
          <h2 className="card-title">Result</h2>
          <div className="card-sub">
            {fmtDateTime(s.timestamp)} · computed in {fmtDuration(record.durationMs)}
          </div>
        </div>
        <div className="row">
          {confirm ? (
            <>
              <span className="faint small">New score, new hash{anchored ? "; the anchored proof will stop matching" : ""}.</span>
              <button className="btn btn-sm btn-primary" onClick={() => (setConfirm(false), onRerun())} disabled={busy}>
                Re-run
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => setConfirm(true)} disabled={busy}>
              <Icon name="refresh" /> Re-run
            </button>
          )}
        </div>
      </header>

      <div className="result-hero">
        <RiskDial score={s.risk_score} />
        <div className="stack" style={{ gap: 18 }}>
          <div>
            <div className="faint small" style={{ marginBottom: 8 }}>
              Loan decision
            </div>
            <div className={`decision-word ${denied ? "bad" : "good"}`}>{s.decision}</div>
            <p className="muted" style={{ marginTop: 10 }}>
              {Math.abs(distance) < 0.05 ? (
                "Exactly at the deny threshold."
              ) : (
                <>
                  <strong style={{ color: "var(--ink)" }}>{fmtNumber(Math.abs(distance))} points</strong> {distance > 0 ? "above" : "below"} the deny threshold of{" "}
                  {RISK_THRESHOLD}.
                </>
              )}
            </p>
          </div>
          <div className="row">
            <Link href={withWallet("/audit", s.wallet_address)}>
              <Tag tone={tone} icon large>
                Explanation {sentenceCase(s.audit.overall_verdict).toLowerCase()}
              </Tag>
            </Link>
            <Link href={withWallet("/verify", s.wallet_address)}>
              {anchored ? (
                <Tag tone="good" icon large>
                  Anchored · block {record.anchor!.block_number}
                </Tag>
              ) : (
                <Tag large>Not anchored</Tag>
              )}
            </Link>
          </div>
          <div className="row" style={{ gap: 14, alignItems: "center", flexWrap: "nowrap" }}>
            <div style={{ width: 88, flex: "none" }}>
              <HashFingerprint hash={s.decision_hash} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="faint small">Decision hash · Keccak256</div>
              <HashValue value={s.decision_hash} short />
            </div>
          </div>
        </div>
      </div>

      {(usedDefaults || record.customFeatures) && (
        <div style={{ padding: "0 22px 18px" }}>
          {usedDefaults && (
            <Notice tone="warn" title="Default profile used.">
              This address is not in the dataset and no features were supplied, so the backend scored its neutral default profile. The result describes that
              profile, not this wallet&apos;s history. Use scenario mode to supply real values.
            </Notice>
          )}
          {record.customFeatures && (
            <Notice tone="iris" title="Scenario.">
              This score uses feature values entered in scenario mode, not the dataset record.
            </Notice>
          )}
        </div>
      )}

      <footer className="card-foot">
        <span>Next: which features produced this score?</span>
        <Link href={withWallet("/explain", s.wallet_address)} className="btn btn-primary btn-sm">
          Understand why <Icon name="arrowRight" />
        </Link>
      </footer>
    </section>
  );
}

function FeatureLedger({ record }: { record: WalletRecord }) {
  const s = record.score;
  const contributions = s.canonical_record?.explanation?.feature_contributions ?? {};
  const maxAbs = Math.max(1, ...Object.values(contributions).map((v) => Math.abs(v)));
  let idx = 0;
  const row = (f: FeatureMeta) => {
    const v = Number(s.features[f.key]);
    const c = contributions[f.shapKey] ?? 0;
    const pct = Math.max(0, Math.min(1, (v - f.min) / (f.max - f.min || 1)));
    const w = `${(Math.abs(c) / maxAbs) * 100}%`;
    const i = idx++;
    return (
      <div className="ledger-row" key={f.key} style={{ "--i": i } as React.CSSProperties}>
        <div style={{ minWidth: 0 }}>
          <div className="ledger-name">{f.label}</div>
          <div className="ledger-desc">{f.description}</div>
        </div>
        <div className="ledger-value">{formatFeatureValue(f, v)}</div>
        <div className="range-cell" title={`Dataset range ${f.min}–${f.max}`}>
          <div className="range">
            <div className="range-fill" style={{ width: `${pct * 100}%` }} />
            <div className={`range-dot${f.quantum ? " q" : ""}`} style={{ left: `${pct * 100}%` }} />
          </div>
        </div>
        <div className="shap-cell">
          <div className="shap-mini" title={`SHAP ${fmtSigned(c)} risk points`}>
            <div>{c < 0 && <div className="shap-mini-bar neg" style={{ width: w, background: "var(--down)" }} />}</div>
            <div className="shap-mini-axis" />
            <div>{c > 0 && <div className="shap-mini-bar" style={{ width: w, background: "var(--up)" }} />}</div>
            <div className="shap-mini-val">{fmtSigned(c)}</div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <Card
      title="Feature ledger"
      sub={`All ${FEATURES.length} features in the decision record, where each sits in the dataset range, and its SHAP attribution`}
      flush
      tour="feature-breakdown"
      i={4}
    >
      <div className="ledger">
        <div className="ledger-row ledger-head">
          <span>Feature</span>
          <span style={{ textAlign: "right" }}>Value</span>
          <span>Dataset range</span>
          <span>
            SHAP <span style={{ color: "var(--down)" }}>−</span> / <span style={{ color: "var(--up)" }}>+</span> risk
          </span>
        </div>
        <div className="ledger-group">
          <span className="swatch" style={{ background: "var(--iris)", borderRadius: "50%" }} /> Quantum circuit inputs · {QUANTUM_FEATURES.length} of{" "}
          {FEATURES.length}
        </div>
        {QUANTUM_FEATURES.map(row)}
        <div className="ledger-group">
          <span className="swatch" style={{ background: "var(--ink-2)", borderRadius: "50%" }} /> Recorded in the hash, not read by the QSVC · attribution always 0
        </div>
        {RECORDED_ONLY_FEATURES.map(row)}
      </div>
    </Card>
  );
}

function ModelInfo({ record }: { record: WalletRecord }) {
  const m = record.score.model_version;
  return (
    <Card title="Model provenance" sub="Returned with the score and included in the hash" tour="model-info" i={5}>
      <dl className="kv">
        <dt>Model</dt>
        <dd className="mono">{m.model_id}</dd>
        <dt>Versions</dt>
        <dd className="mono">
          model {m.model_version} · data {m.dataset_version} · schema {m.feature_schema_version}
        </dd>
        <dt>Qubits</dt>
        <dd className="mono">{m.n_qubits}</dd>
        <dt>Circuit inputs</dt>
        <dd>
          <div className="row" style={{ gap: 6 }}>
            {m.qml_features.map((f, i) => (
              <Tag key={f} tone="iris">
                q{i} {f}
              </Tag>
            ))}
          </div>
        </dd>
        <dt>Trained</dt>
        <dd>{fmtDateTime(m.trained_at)}</dd>
      </dl>
    </Card>
  );
}
