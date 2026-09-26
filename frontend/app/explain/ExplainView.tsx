"use client";

import Link from "next/link";
import { useAnalysis, useWalletParam } from "@/lib/analysis-store";
import { useExplanation } from "@/lib/queries";
import WalletHeader from "@/components/wallet/WalletHeader";
import NoWallet from "@/components/wallet/NoWallet";
import Waterfall from "@/components/charts/Waterfall";
import ContributionBars from "@/components/charts/ContributionBars";
import RiskScale from "@/components/charts/RiskScale";
import LLMPanel from "./LLMPanel";
import { Chip, ErrorState, Notice, Panel, SkeletonBlock, Stat } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { featureLabel, featureMeta, formatFeatureValue, RISK_THRESHOLD } from "@/lib/features";
import { fmtNumber, fmtSigned } from "@/lib/format";
import { decisionTone } from "@/lib/verdicts";
import { withWallet } from "@/components/shell/nav";
import type { ExplainResponse } from "@/lib/types";

export default function ExplainView({ urlWallet }: { urlWallet?: string }) {
  const { wallet, hydrated } = useWalletParam(urlWallet);
  const { getRecord, running } = useAnalysis();
  const isRunning = Boolean(running && wallet && running.wallet.toLowerCase() === wallet.toLowerCase());
  const q = useExplanation(isRunning ? null : wallet);
  const record = getRecord(wallet);

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head-text">
          <span className="eyebrow">Step 2 · Explanation</span>
          <h1 className="page-title">Why the model scored it this way</h1>
          <p className="page-lede">
            SHAP splits the risk score into points contributed by each feature, starting from the score the model gives an average wallet.
          </p>
        </div>
      </div>

      {!hydrated ? (
        <Panel>
          <SkeletonBlock lines={6} />
        </Panel>
      ) : !wallet ? (
        <NoWallet page="explanation" description="SHAP attributions come from GET /explain/{wallet}" />
      ) : (
        <>
          <WalletHeader wallet={wallet} current="explain" />
          {isRunning ? (
            <Notice tone="accent" icon="clock" title="Analysis in progress.">
              The explanation will load when the new score is ready.
            </Notice>
          ) : q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} what="the SHAP explanation" />
          ) : !q.data ? (
            <div className="grid grid-main-side">
              <Panel title="Loading explanation…" sub={`GET /explain/${wallet.slice(0, 10)}…`} tour="waterfall">
                <SkeletonBlock lines={8} />
              </Panel>
              <Panel>
                <SkeletonBlock lines={5} />
              </Panel>
            </div>
          ) : (
            <ExplainBody data={q.data} wallet={wallet} recordScore={record?.score.risk_score} />
          )}
        </>
      )}
    </main>
  );
}

function ExplainBody({ data, wallet, recordScore }: { data: ExplainResponse; wallet: string; recordScore?: number }) {
  const entries = Object.entries(data.feature_contributions);
  const active = entries.filter(([, v]) => v !== 0);
  const zero = entries.filter(([, v]) => v === 0);
  const sum = active.reduce((a, [, v]) => a + v, 0);
  const ranked = [...active].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const drivers = ranked.slice(0, 3);
  const up = active.filter(([, v]) => v > 0).reduce((a, [, v]) => a + v, 0);
  const down = active.filter(([, v]) => v < 0).reduce((a, [, v]) => a + v, 0);
  const mismatch = recordScore !== undefined && Math.abs(recordScore - data.risk_score) > 0.05;

  return (
    <>
      {recordScore === undefined && (
        <Notice title="Not analyzed in this browser.">
          Showing the decision the server has stored for this wallet. If it had none, the server scored the wallet to build this explanation.{" "}
          <Link className="link" href={withWallet("/assess", wallet)}>
            Open the assessment
          </Link>
        </Notice>
      )}
      {mismatch && (
        <Notice tone="warn" title="Different result on the server.">
          This browser last saw a score of {fmtNumber(recordScore)}, but the server&apos;s stored decision scores {fmtNumber(data.risk_score)}. The wallet was
          probably re-scored elsewhere. This page shows the server&apos;s version.
        </Notice>
      )}

      <div className="stat-row">
        <Stat label="Expected value (base)" value={fmtNumber(data.base_risk_value)} note="Model output for the SHAP background" />
        <Stat label="Pushes toward deny" value={fmtSigned(up)} tone={up > 0 ? "neg" : undefined} note="Sum of positive attributions" />
        <Stat label="Pulls toward approve" value={fmtSigned(down)} tone={down < 0 ? "pos" : undefined} note="Sum of negative attributions" />
        <Stat
          label="Risk score"
          value={fmtNumber(data.risk_score)}
          note={
            <span className="row" style={{ gap: 6 }}>
              <Chip tone={decisionTone(data.decision)}>{data.decision}</Chip>
            </span>
          }
        />
      </div>

      <div className="grid grid-main-side">
        <div className="stack">
          <Panel
            title="From baseline to score"
            sub={`Base ${fmtNumber(data.base_risk_value)} ${fmtSigned(sum)} from features = ${fmtNumber(data.base_risk_value + sum)} · model score ${fmtNumber(data.risk_score)}`}
            tour="waterfall"
          >
            <div className="stack" style={{ gap: 14 }}>
              <Waterfall base={data.base_risk_value} contributions={data.feature_contributions} score={data.risk_score} />
              <div className="legend">
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: "var(--risk-up)" }} /> raises risk
                </span>
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: "var(--risk-down)" }} /> lowers risk
                </span>
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: "transparent", borderTop: "1px dashed var(--text-2)", height: 0 }} /> deny threshold {RISK_THRESHOLD}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Feature contributions" sub="Risk points per feature, largest first, with the wallet's input value" tour="contributions">
            <div className="stack" style={{ gap: 14 }}>
              <ContributionBars items={active.map(([k, v]) => ({ key: k, value: v, input: data.input_features[k] }))} />
              {zero.length > 0 && (
                <p className="faint" style={{ fontSize: 12.5 }}>
                  0.0 for {zero.map(([k]) => featureLabel(k)).join(", ")}. These features are recorded but are not inputs to the quantum circuit, so they
                  cannot affect this model&apos;s score.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Key drivers" sub="The three largest attributions">
            {drivers.length === 0 ? (
              <p className="muted">Every attribution is zero: the score equals the base value.</p>
            ) : (
              <ol className="def-list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {drivers.map(([k, v]) => {
                  const meta = featureMeta(k);
                  return (
                    <li key={k} className="def-item">
                      <span className="row" style={{ justifyContent: "space-between" }}>
                        <span className="def-term">{featureLabel(k)}</span>
                        <span className={`mono ${v > 0 ? "delta-up" : "delta-down"}`}>{fmtSigned(v)} pts</span>
                      </span>
                      <span className="def-desc">
                        At {formatFeatureValue(meta, data.input_features[k])}, this feature {v > 0 ? "raised" : "lowered"} the score by{" "}
                        {Math.abs(v).toFixed(1)} points relative to the baseline.
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <LLMPanel wallet={wallet} />

          <Panel title="Reading SHAP values">
            <div className="prose" style={{ fontSize: 13 }}>
              <p>
                Attributions are in <strong>risk points</strong>. They add up, together with the base value, to the model&apos;s score. Kernel SHAP estimates
                them by sampling (32 samples here), so a small residual can remain.
              </p>
              <p>
                An attribution tells you what moved <em>this</em> score, not how the feature behaves in general. Whether it can be trusted is what the audit
                checks next.
              </p>
            </div>
          </Panel>
          <RiskScaleCard base={data.base_risk_value} score={data.risk_score} />
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Link href={withWallet("/assess", wallet)} className="btn btn-ghost">
          <Icon name="arrowLeft" /> Assessment
        </Link>
        <Link href={withWallet("/audit", wallet)} className="btn btn-primary">
          Audit this explanation <Icon name="arrowRight" />
        </Link>
      </div>
    </>
  );
}

function RiskScaleCard({ base, score }: { base: number; score: number }) {
  return (
    <Panel title="Baseline vs. score" sub="Hollow marker: expected value · solid marker: this wallet">
      <RiskScale score={score} baseValue={base} />
    </Panel>
  );
}
