"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAnalysis, useWalletParam, type WalletRecord } from "@/lib/analysis-store";
import WalletHeader from "@/components/wallet/WalletHeader";
import WalletPicker from "@/components/wallet/WalletPicker";
import AnalysisProgress from "@/components/wallet/AnalysisProgress";
import ScenarioEditor from "./ScenarioEditor";
import RiskScale from "@/components/charts/RiskScale";
import RangeBar from "@/components/charts/RangeBar";
import { Chip, EmptyState, HashValue, Notice, Panel, SkeletonBlock } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { FEATURES, RISK_THRESHOLD, formatFeatureValue, isDefaultProfile, QUANTUM_FEATURES, RECORDED_ONLY_FEATURES, type FeatureMeta } from "@/lib/features";
import { fmtDateTime, fmtDuration, fmtNumber, fmtRelative, fmtSigned } from "@/lib/format";
import { decisionTone, overallTone, titleCase } from "@/lib/verdicts";
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

  // ?run=1 starts the analysis once (used by the dashboard and the tour).
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
          <span className="eyebrow">Step 1 · Risk assessment</span>
          <h1 className="page-title">Risk assessment</h1>
          <p className="page-lede">
            The quantum classifier scores the wallet from 0 to 100 and approves or denies it. The same request explains the score, audits the explanation and
            hashes the decision.
          </p>
        </div>
      </div>

      {!hydrated ? (
        <Panel>
          <SkeletonBlock lines={5} />
        </Panel>
      ) : !wallet ? (
        <div className="grid grid-main-side">
          <Panel title="Choose a wallet" sub="Paste an address or pick a sample from the dataset" tour="assess-input">
            <WalletPicker onSubmit={selectWallet} busy={Boolean(running)} autoFocus />
          </Panel>
          <Panel title="What you get">
            <ul className="bullets">
              <li>A risk score from 0 to 100 and an approve / deny decision at {RISK_THRESHOLD}.</li>
              <li>The value of all 12 wallet features and which of them the model actually uses.</li>
              <li>SHAP attributions, an audit of those attributions, and a Keccak256 decision hash ready to anchor.</li>
            </ul>
          </Panel>
        </div>
      ) : (
        <>
          <WalletHeader wallet={wallet} current="assess" />
          <div className="grid grid-main-side">
            <div className="stack">
              {isRunning && running ? (
                <AnalysisProgress wallet={running.wallet} startedAt={running.startedAt} custom={running.custom} />
              ) : error ? (
                <Notice
                  tone="neg"
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

              {!isRunning && record && <ResultPanel record={record} onRerun={() => analyze(wallet)} busy={Boolean(running)} />}

              {!isRunning && !record && !error && (
                <Panel>
                  <EmptyState
                    title="This wallet has not been analyzed yet"
                    actions={
                      <button className="btn btn-primary" onClick={() => analyze(wallet)} disabled={Boolean(running)}>
                        <Icon name="play" /> Analyze wallet
                      </button>
                    }
                  >
                    Running the analysis calls POST /score. It usually takes one to three seconds.
                  </EmptyState>
                </Panel>
              )}

              {!isRunning && record && <FeatureBreakdown record={record} />}
            </div>

            <div className="stack">
              <Panel title="Wallet & scenario" sub="Analyze another address, or override features for this one" tour="assess-input">
                <div className="stack">
                  <WalletPicker initial={wallet} onSubmit={selectWallet} busy={isRunning} disabled={Boolean(running)} submitLabel="Analyze" />
                  <hr className="divider" />
                  <ScenarioEditor
                    base={(record?.score.features as WalletFeatures | undefined) ?? null}
                    disabled={Boolean(running)}
                    onRun={(features) => analyze(wallet, features)}
                  />
                </div>
              </Panel>
              {record && !isRunning && <ModelInfo record={record} />}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function ResultPanel({ record, onRerun, busy }: { record: WalletRecord; onRerun: () => void; busy: boolean }) {
  const s = record.score;
  const denied = s.decision.toUpperCase().startsWith("DEN");
  const anchored = record.anchor && record.anchor.decision_hash.toLowerCase() === s.decision_hash.toLowerCase();
  const [confirm, setConfirm] = useState(false);
  const usedDefaults = !record.customFeatures && isDefaultProfile(s.features);
  const distance = s.risk_score - RISK_THRESHOLD;

  return (
    <section className="panel fade-in" data-tour="risk-result">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">Result</h2>
          <div className="panel-sub">
            Scored {fmtRelative(record.scoredAt)} · {fmtDateTime(s.timestamp)} · {fmtDuration(record.durationMs)}
          </div>
        </div>
        <div className="row">
          {confirm ? (
            <>
              <span className="faint" style={{ fontSize: 12.5 }}>
                A new score gets a new hash{anchored ? "; the anchored proof will stop matching" : ""}.
              </span>
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
      <div className="panel-body stack" style={{ gap: 20 }}>
        <div className="score-hero">
          <div>
            <div className="eyebrow">Risk score</div>
            <div className="score-figure">
              <span className="score-number" style={{ color: denied ? "var(--neg)" : "var(--text)" }}>
                {fmtNumber(s.risk_score)}
              </span>
              <span className="score-of">/ 100</span>
            </div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
              {Math.abs(distance) < 0.05
                ? "Exactly at the threshold."
                : `${fmtNumber(Math.abs(distance))} points ${distance > 0 ? "above" : "below"} the deny threshold of ${RISK_THRESHOLD}.`}
            </div>
          </div>
          <div className="decision">
            <div className="eyebrow">Loan decision</div>
            <div className={`decision-word ${denied ? "neg" : "pos"}`}>{s.decision}</div>
            <Link href={withWallet("/audit", s.wallet_address)}>
              <Chip tone={overallTone(s.audit.overall_verdict)}>Explanation {titleCase(s.audit.overall_verdict)}</Chip>
            </Link>
          </div>
        </div>

        <RiskScale score={s.risk_score} />

        {usedDefaults && (
          <Notice tone="warn" title="Default profile used.">
            This address is not in the dataset and no features were supplied, so the backend scored its neutral default profile. The result describes that
            profile, not this wallet&apos;s on-chain history. Use scenario mode to supply real values.
          </Notice>
        )}
        {record.customFeatures && (
          <Notice tone="accent" title="Scenario.">
            This score uses feature values entered in scenario mode, not the dataset record.
          </Notice>
        )}

        <div className="grid grid-2" style={{ gap: 14 }}>
          <div className="field">
            <span className="field-label">Decision hash (Keccak256)</span>
            <HashValue value={s.decision_hash} boxed />
          </div>
          <div className="field">
            <span className="field-label">On-chain proof</span>
            <div className="hash-box row" style={{ justifyContent: "space-between", minHeight: 42 }}>
              {anchored ? <Chip tone="pos">anchored · block {record.anchor!.block_number}</Chip> : <Chip>not anchored</Chip>}
              <Link href={withWallet("/verify", s.wallet_address)} className="link" style={{ fontSize: 12.5 }}>
                {anchored ? "Verify" : "Anchor"}
              </Link>
            </div>
          </div>
        </div>
      </div>
      <footer className="panel-foot">
        <span>Next: see which features produced this score.</span>
        <Link href={withWallet("/explain", s.wallet_address)} className="btn btn-primary btn-sm">
          Understand why <Icon name="arrowRight" />
        </Link>
      </footer>
    </section>
  );
}

function FeatureBreakdown({ record }: { record: WalletRecord }) {
  const s = record.score;
  const contributions = s.canonical_record?.explanation?.feature_contributions ?? {};
  const row = (f: FeatureMeta) => {
    const v = Number(s.features[f.key]);
    const c = contributions[f.shapKey];
    return (
      <tr key={f.key}>
        <td>
          <div style={{ fontWeight: 500 }}>{f.label}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {f.description}
          </div>
        </td>
        <td className="r">{formatFeatureValue(f, v)}</td>
        <td style={{ minWidth: 120 }}>
          <RangeBar meta={f} value={v} />
          <div className="faint mono" style={{ fontSize: 10.5, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span>{f.min}</span>
            <span>{f.max}</span>
          </div>
        </td>
        <td className="r">
          {c === undefined ? (
            <span className="faint">—</span>
          ) : (
            <span className={c > 0 ? "delta-up" : c < 0 ? "delta-down" : "faint"}>{fmtSigned(c)}</span>
          )}
        </td>
      </tr>
    );
  };
  return (
    <Panel
      title="Feature breakdown"
      sub="All 12 features in the decision record. SHAP column: risk points added (+) or removed (−)."
      tight
      tour="feature-breakdown"
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Feature</th>
              <th className="r">Value</th>
              <th>Dataset range</th>
              <th className="r">SHAP pts</th>
            </tr>
          </thead>
          <tbody>
            <tr className="group-row">
              <td colSpan={4}>Quantum circuit inputs · {QUANTUM_FEATURES.length} of {FEATURES.length}</td>
            </tr>
            {QUANTUM_FEATURES.map(row)}
            <tr className="group-row">
              <td colSpan={4}>Recorded, not used by the QSVC · attribution is always 0</td>
            </tr>
            {RECORDED_ONLY_FEATURES.map(row)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ModelInfo({ record }: { record: WalletRecord }) {
  const m = record.score.model_version;
  return (
    <Panel title="Model" sub="Provenance returned with the score and included in the hash" tour="model-info">
      <dl className="kv">
        <dt>Model ID</dt>
        <dd className="mono">{m.model_id}</dd>
        <dt>Version</dt>
        <dd className="mono">
          model {m.model_version} · dataset {m.dataset_version} · schema {m.feature_schema_version}
        </dd>
        <dt>Qubits</dt>
        <dd className="mono">{m.n_qubits}</dd>
        <dt>Circuit inputs</dt>
        <dd>
          <div className="row" style={{ gap: 6 }}>
            {m.qml_features.map((f) => (
              <Chip key={f} tone="accent">
                {f}
              </Chip>
            ))}
          </div>
        </dd>
        <dt>Trained</dt>
        <dd>{fmtDateTime(m.trained_at)}</dd>
      </dl>
    </Panel>
  );
}
