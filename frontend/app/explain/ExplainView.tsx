"use client";

import Link from "next/link";
import { useAnalysis, useWalletParam } from "@/lib/analysis-store";
import { useExplanation } from "@/lib/queries";
import WalletHeader from "@/components/wallet/WalletHeader";
import NoWallet from "@/components/wallet/NoWallet";
import Waterfall from "@/components/charts/Waterfall";
import ContributionBars from "@/components/charts/ContributionBars";
import LLMPanel from "./LLMPanel";
import { Card, CountUp, ErrorState, Notice, SkeletonBlock, Tag } from "@/components/ui/primitives";
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
          <span className="kicker">
            <span className="step-badge">2</span> Explanation
          </span>
          <h1 className="page-title">Why it scored this way</h1>
          <p className="page-lede">SHAP splits the score into risk points per feature, starting from what the model gives an average wallet.</p>
        </div>
      </div>

      {!hydrated ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : !wallet ? (
        <NoWallet page="explanation" description="SHAP attributions come from GET /explain/{wallet}" />
      ) : (
        <>
          <WalletHeader wallet={wallet} />
          {isRunning ? (
            <Notice tone="iris" icon="clock" title="Analysis in progress.">
              The explanation loads when the new score is ready.
            </Notice>
          ) : q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} what="the SHAP explanation" />
          ) : !q.data ? (
            <div className="grid g-main">
              <Card title="Computing attributions…" sub="GET /explain" tour="waterfall">
                <SkeletonBlock lines={9} />
              </Card>
              <Card>
                <SkeletonBlock lines={6} />
              </Card>
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
  const ranked = [...active].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const drivers = ranked.slice(0, 3);
  const up = active.filter(([, v]) => v > 0).reduce((a, [, v]) => a + v, 0);
  const down = active.filter(([, v]) => v < 0).reduce((a, [, v]) => a + v, 0);
  const mismatch = recordScore !== undefined && Math.abs(recordScore - data.risk_score) > 0.05;
  const top = ranked[0];

  return (
    <>
      {recordScore === undefined && (
        <Notice title="Not analyzed in this browser.">
          Showing the decision the server has stored for this wallet (it scores the wallet first if it had none).{" "}
          <Link className="link" href={withWallet("/assess", wallet)}>
            Open the assessment
          </Link>
        </Notice>
      )}
      {mismatch && (
        <Notice tone="warn" title="Different result on the server.">
          This browser last saw {fmtNumber(recordScore)}, but the server&apos;s stored decision scores {fmtNumber(data.risk_score)}. The wallet was probably
          re-scored elsewhere; this page shows the server&apos;s version.
        </Notice>
      )}

      <section className="card rise" style={{ "--i": 2, padding: "26px 26px 22px" } as React.CSSProperties}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 22, alignItems: "end" }}>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <div className="faint small">In one line</div>
            <p className="display" style={{ fontSize: "clamp(22px, 2.6vw, 30px)", marginTop: 8, lineHeight: 1.15 }}>
              From a baseline of {fmtNumber(data.base_risk_value)} to{" "}
              <span style={{ color: data.risk_score >= RISK_THRESHOLD ? "var(--bad)" : "var(--good)" }}>{fmtNumber(data.risk_score)}</span>
              {top ? (
                <>
                  , mostly because of <span style={{ color: top[1] > 0 ? "var(--up)" : "var(--down)" }}>{featureLabel(top[0]).toLowerCase()}</span>.
                </>
              ) : (
                "."
              )}
            </p>
          </div>
          <div>
            <div className="faint small">Pushes toward deny</div>
            <div className="strip-value" style={{ fontSize: 28 }}>
              {up > 0 ? "+" : ""}
              <CountUp value={up} />
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="key-line" style={{ background: "var(--up)" }} />
              <span className="faint small">sum of positive points</span>
            </div>
          </div>
          <div>
            <div className="faint small">Pulls toward approve</div>
            <div className="strip-value" style={{ fontSize: 28 }}>
              <CountUp value={down} />
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="key-line" style={{ background: "var(--down)" }} />
              <span className="faint small">sum of negative points</span>
            </div>
          </div>
          <div>
            <div className="faint small">Model decision</div>
            <div style={{ marginTop: 8 }}>
              <Tag tone={decisionTone(data.decision)} icon large>
                {data.decision}
              </Tag>
            </div>
          </div>
        </div>
      </section>

      <div className="grid g-main">
        <div className="stack">
          <Card
            title="From baseline to score"
            sub="Each step adds one feature's attribution. Hover a bar for details."
            tour="waterfall"
            i={3}
            actions={
              <div className="legend">
                <span className="legend-item">
                  <span className="swatch" style={{ background: "var(--up)" }} /> raises risk
                </span>
                <span className="legend-item">
                  <span className="swatch" style={{ background: "var(--down)" }} /> lowers risk
                </span>
              </div>
            }
          >
            <Waterfall base={data.base_risk_value} contributions={data.feature_contributions} inputs={data.input_features} score={data.risk_score} />
            <p className="faint small" style={{ marginTop: 12 }}>
              Dotted line: deny threshold at {RISK_THRESHOLD}.
            </p>
          </Card>

          <Card title="Feature contributions" sub="Ranked by size, with the input value behind each one" tour="contributions" i={4}>
            <div className="stack" style={{ gap: 14 }}>
              <ContributionBars items={active.map(([k, v]) => ({ key: k, value: v, input: data.input_features[k] }))} />
              {zero.length > 0 && (
                <p className="faint small">
                  0.0 for {zero.map(([k]) => featureLabel(k)).join(", ")}: recorded, but not inputs to the quantum circuit, so they cannot move this model&apos;s
                  score.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Key drivers" sub="The three largest attributions" i={3}>
            {drivers.length === 0 ? (
              <p className="muted">Every attribution is zero: the score equals the base value.</p>
            ) : (
              <div>
                {drivers.map(([k, v], i) => {
                  const meta = featureMeta(k);
                  return (
                    <div key={k} className="driver">
                      <span className="driver-rank">{i + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{featureLabel(k)}</div>
                        <div className="faint small" style={{ marginTop: 3 }}>
                          At {formatFeatureValue(meta, data.input_features[k])}, it {v > 0 ? "raised" : "lowered"} the score by {Math.abs(v).toFixed(1)} points.
                        </div>
                      </div>
                      <div className="driver-value">
                        <Icon name={v > 0 ? "arrowUp" : "arrowDown"} />
                        <span style={{ color: v > 0 ? "var(--up)" : "var(--down)" }}>{fmtSigned(v)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <LLMPanel wallet={wallet} />

          <Card title="Reading SHAP values" i={5}>
            <div className="prose">
              <p>
                Attributions are in <strong>risk points</strong> and add up, with the base value, to the model&apos;s score. Kernel SHAP estimates them from 32
                samples, so a small residual can remain.
              </p>
              <p>They explain this one score, not how a feature behaves in general. Whether they can be trusted is what the audit tests next.</p>
            </div>
          </Card>
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
