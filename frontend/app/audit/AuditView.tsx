"use client";

import Link from "next/link";
import { useAnalysis, useWalletParam } from "@/lib/analysis-store";
import { useAudit } from "@/lib/queries";
import WalletHeader from "@/components/wallet/WalletHeader";
import NoWallet from "@/components/wallet/NoWallet";
import RiskShiftChart from "@/components/charts/RiskShiftChart";
import CorrelationChart from "@/components/charts/CorrelationChart";
import { Bool, Chip, EmptyState, ErrorState, Notice, Panel, SkeletonBlock } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { AUDIT_RULES, featureLabel, featureMeta, formatFeatureValue } from "@/lib/features";
import { fmtNumber, fmtSigned } from "@/lib/format";
import { dimensionTone, overallTone, titleCase, toneVar } from "@/lib/verdicts";
import { withWallet } from "@/components/shell/nav";
import type { AuditReport } from "@/lib/types";

export default function AuditView({ urlWallet }: { urlWallet?: string }) {
  const { wallet, hydrated } = useWalletParam(urlWallet);
  const { running, getRecord } = useAnalysis();
  const isRunning = Boolean(running && wallet && running.wallet.toLowerCase() === wallet.toLowerCase());
  const q = useAudit(isRunning ? null : wallet);

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head-text">
          <span className="eyebrow">Step 3 · XAI audit</span>
          <h1 className="page-title">Does the explanation hold up?</h1>
          <p className="page-lede">
            SHAP values are estimates. The audit tests them against the model itself with three independent experiments, then reports what passed and what
            did not.
          </p>
        </div>
      </div>

      {!hydrated ? (
        <Panel>
          <SkeletonBlock lines={6} />
        </Panel>
      ) : !wallet ? (
        <NoWallet page="audit" description="Audit results come from GET /audit/{wallet}" />
      ) : (
        <>
          <WalletHeader wallet={wallet} current="audit" />
          {isRunning ? (
            <Notice tone="accent" icon="clock" title="Analysis in progress.">
              The audit will load when the new score is ready.
            </Notice>
          ) : q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} what="the audit report" />
          ) : !q.data ? (
            <div className="stack">
              <Panel tour="audit-verdict">
                <SkeletonBlock lines={3} />
              </Panel>
              <div className="grid grid-3" data-tour="audit-dimensions">
                {[0, 1, 2].map((i) => (
                  <Panel key={i}>
                    <SkeletonBlock lines={5} />
                  </Panel>
                ))}
              </div>
            </div>
          ) : (
            <AuditBody audit={q.data} wallet={wallet} analyzedHere={Boolean(getRecord(wallet))} />
          )}
        </>
      )}
    </main>
  );
}

const LEVEL_POINTS: Record<string, number> = { HIGH: 2, MEDIUM: 1, LOW: 0, UNKNOWN: 0 };

function AuditBody({ audit, wallet, analyzedHere }: { audit: AuditReport; wallet: string; analyzedHere: boolean }) {
  const tone = overallTone(audit.overall_verdict);
  const f = audit.faithfulness;
  const st = audit.stability;
  const se = audit.sensitivity;
  const points = [f.verdict, st.verdict, se.verdict].map((v) => LEVEL_POINTS[String(v).toUpperCase()] ?? 0);
  const avg = points.reduce((a, b) => a + b, 0) / 3;

  return (
    <>
      {!analyzedHere && (
        <Notice title="Not analyzed in this browser.">
          Showing the audit stored on the server for this wallet. If it had none, the server scored the wallet first.
        </Notice>
      )}

      <section className="verdict-banner fade-in" data-tone={tone} data-tour="audit-verdict">
        <div>
          <div className="eyebrow">Overall verdict</div>
          <div className="verdict-word" style={{ color: toneVar(tone) }}>
            {titleCase(audit.overall_verdict)}
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <p style={{ color: "var(--text)", maxWidth: "70ch" }}>{audit.overall_description}</p>
          <div className="row">
            <Chip tone={dimensionTone(f.verdict)}>Faithfulness {String(f.verdict).toLowerCase()}</Chip>
            <Chip tone={dimensionTone(st.verdict)}>Stability {String(st.verdict).toLowerCase()}</Chip>
            <Chip tone={dimensionTone(se.verdict)}>Sensitivity {String(se.verdict).toLowerCase()}</Chip>
          </div>
        </div>
      </section>

      <div className="grid grid-3" data-tour="audit-dimensions">
        <Dimension
          name="Faithfulness"
          question="Do the features SHAP ranks highest actually move the prediction?"
          verdict={String(f.verdict)}
          value={`${f.faithful_features ?? "?"}/${f.tested_features ?? "?"}`}
          valueNote="top features passed"
          fraction={f.score}
          marks={[
            { at: AUDIT_RULES.ratioMedium, label: "med" },
            { at: AUDIT_RULES.ratioHigh, label: "high" },
          ]}
          rule={`The top ${AUDIT_RULES.faithfulnessTopK} features are each moved one step against their attribution. A feature passes when the risk changes by at least max(${AUDIT_RULES.faithfulnessMinDelta} pts, ${AUDIT_RULES.faithfulnessMinShare * 100}% of its attribution) and the direction check passes. High ≥ ${AUDIT_RULES.ratioHigh * 100}% pass, medium ≥ ${AUDIT_RULES.ratioMedium * 100}%.`}
        />
        <Dimension
          name="Stability"
          question="Do nearly identical wallets get nearly identical explanations?"
          verdict={String(st.verdict)}
          value={fmtNumber(st.mean_rank_correlation ?? st.score, 3)}
          valueNote={`mean Spearman ρ, ${st.n_clones_tested ?? 0} clones`}
          fraction={Math.max(0, st.mean_rank_correlation ?? st.score)}
          marks={[
            { at: AUDIT_RULES.stabilityMedium, label: "med" },
            { at: AUDIT_RULES.stabilityHigh, label: "high" },
          ]}
          rule={`${AUDIT_RULES.stabilityClones} clones get Gaussian noise of ${AUDIT_RULES.stabilityNoiseStd * 100}% of each feature's range and are explained again. The feature ranking is compared with Spearman rank correlation. High ≥ ${AUDIT_RULES.stabilityHigh}, medium ≥ ${AUDIT_RULES.stabilityMedium}.`}
        />
        <Dimension
          name="Sensitivity"
          question="Does making a feature riskier actually raise the risk?"
          verdict={String(se.verdict)}
          value={`${se.sensitive_features ?? 0}/${se.tested_features ?? 0}`}
          valueNote="features responded"
          fraction={se.tested_features ? se.score : null}
          marks={[
            { at: AUDIT_RULES.ratioMedium, label: "med" },
            { at: AUDIT_RULES.ratioHigh, label: "high" },
          ]}
          rule={`Every feature with an attribution of at least ${AUDIT_RULES.sensitivityMinAttribution} pts is moved one step toward its risky extreme. It passes if the risk rises by ${AUDIT_RULES.sensitivityMinDelta} pts or more. High ≥ ${AUDIT_RULES.ratioHigh * 100}% pass, medium ≥ ${AUDIT_RULES.ratioMedium * 100}%.`}
        />
      </div>

      <FaithfulnessDetail audit={audit} />
      <div className="grid grid-2">
        <StabilityDetail audit={audit} />
        <SensitivityDetail audit={audit} />
      </div>

      <div className="grid grid-main-side">
        <Panel title="How the overall verdict is formed" sub="xai_auditor.py · _aggregate_verdict">
          <div className="stack" style={{ gap: 14 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th>Level</th>
                    <th className="r">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Faithfulness", f.verdict],
                    ["Stability", st.verdict],
                    ["Sensitivity", se.verdict],
                  ].map(([n, v], i) => (
                    <tr key={n}>
                      <td>{n}</td>
                      <td>
                        <Chip tone={dimensionTone(String(v))}>{String(v).toLowerCase()}</Chip>
                      </td>
                      <td className="r">{points[i]}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Average</td>
                    <td />
                    <td className="r" style={{ color: "var(--text)" }}>
                      {avg.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="faint" style={{ fontSize: 12.5 }}>
              High = 2, medium = 1, low or unknown = 0. An average of 1.7 or more is <strong>Supported</strong>, 0.9 or more is{" "}
              <strong>Supported with caution</strong>, anything lower is <strong>Questionable</strong>.
            </p>
          </div>
        </Panel>
        <Panel title="Auditor summary" sub="summary_lines, verbatim from the API">
          <pre className="code-block" tabIndex={0}>
            {audit.summary_lines.join("\n")}
          </pre>
        </Panel>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Link href={withWallet("/explain", wallet)} className="btn btn-ghost">
          <Icon name="arrowLeft" /> Explanation
        </Link>
        <Link href={withWallet("/verify", wallet)} className="btn btn-primary">
          Verify the record <Icon name="arrowRight" />
        </Link>
      </div>
    </>
  );
}

function Dimension({
  name,
  question,
  verdict,
  value,
  valueNote,
  fraction,
  marks,
  rule,
}: {
  name: string;
  question: string;
  verdict: string;
  value: string;
  valueNote: string;
  fraction: number | null;
  marks: { at: number; label: string }[];
  rule: string;
}) {
  const tone = dimensionTone(verdict);
  return (
    <section className="panel">
      <div className="dim">
        <div className="dim-head">
          <div>
            <h3 style={{ fontSize: 15 }}>{name}</h3>
            <p className="dim-q">{question}</p>
          </div>
          <Chip tone={tone}>{verdict.toLowerCase()}</Chip>
        </div>
        <div>
          <span className="dim-score" style={{ color: toneVar(tone) }}>
            {value}
          </span>{" "}
          <span className="faint" style={{ fontSize: 12.5 }}>
            {valueNote}
          </span>
        </div>
        <div style={{ paddingTop: 14 }}>
          <div className="meter" role="img" aria-label={fraction === null ? "Not measured" : `${Math.round(fraction * 100)}%`}>
            {fraction !== null && <div className="meter-fill" style={{ width: `${Math.min(1, fraction) * 100}%`, background: toneVar(tone) }} />}
            {marks.map((m) => (
              <span key={m.label} className="meter-mark" style={{ left: `${m.at * 100}%` }} data-label={m.label} />
            ))}
          </div>
        </div>
        <p className="faint" style={{ fontSize: 12.5 }}>
          {rule}
        </p>
      </div>
    </section>
  );
}

function FaithfulnessDetail({ audit }: { audit: AuditReport }) {
  const rows = audit.faithfulness.perturb_results ?? [];
  return (
    <Panel
      title="Faithfulness experiments"
      sub="Risk before (hollow) and after (filled) moving each top-attributed feature"
      tight
    >
      {rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState title="No experiments recorded">The server returned no perturbation results for this wallet.</EmptyState>
        </div>
      ) : (
        <>
          <div className="panel-body">
            <RiskShiftChart rows={rows.map((r) => ({ feature: r.feature, from: r.original_risk, to: r.new_risk, pass: r.faithful }))} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="r">SHAP</th>
                  <th className="r">Value moved</th>
                  <th className="r">Risk</th>
                  <th className="r">Δ risk</th>
                  <th>Direction</th>
                  <th>Magnitude</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = featureMeta(r.feature);
                  const unchanged = r.original_value === r.perturbed_value;
                  return (
                    <tr key={r.feature}>
                      <td>{featureLabel(r.feature)}</td>
                      <td className="r">{fmtSigned(r.shap_attribution)}</td>
                      <td className="r" title={unchanged ? "Already at the bound of its range, so the value could not move" : undefined}>
                        {formatFeatureValue(meta, r.original_value)} → {formatFeatureValue(meta, r.perturbed_value)}
                        {unchanged && <span className="faint"> *</span>}
                      </td>
                      <td className="r">
                        {fmtNumber(r.original_risk)} → {fmtNumber(r.new_risk)}
                      </td>
                      <td className={`r ${r.actual_delta > 0 ? "delta-up" : r.actual_delta < 0 ? "delta-down" : ""}`}>{fmtSigned(r.actual_delta)}</td>
                      <td>
                        <Bool value={r.expected_direction_correct} yes="ok" no="wrong" />
                      </td>
                      <td>
                        <Bool value={r.magnitude_sufficient} yes="enough" no="too small" />
                      </td>
                      <td>
                        <Chip tone={r.faithful ? "pos" : "warn"}>{r.faithful ? "supported" : "questionable"}</Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.some((r) => r.original_value === r.perturbed_value) && (
            <div className="panel-foot">
              <span>* The feature was already at the edge of its range, so the perturbation could not change it and the risk could not move.</span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function StabilityDetail({ audit }: { audit: AuditReport }) {
  const s = audit.stability;
  const clones = s.clone_details ?? [];
  return (
    <Panel title="Stability across clones" sub="Rank correlation between the original ranking and each clone">
      {clones.length === 0 ? (
        <EmptyState title="No clones evaluated">
          The auditor could not compute any clone explanations for this wallet, so stability is scored as 0.
        </EmptyState>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <CorrelationChart clones={clones} mean={s.mean_rank_correlation ?? s.score} />
          <p className="faint" style={{ fontSize: 12.5 }}>
            {s.description}
          </p>
        </div>
      )}
    </Panel>
  );
}

function SensitivityDetail({ audit }: { audit: AuditReport }) {
  const s = audit.sensitivity;
  const rows = s.feature_details ?? [];
  return (
    <Panel title="Sensitivity checks" sub="Risk before and after worsening each strongly attributed feature" tight>
      {rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState title="Nothing to test">
            No feature had an attribution of {AUDIT_RULES.sensitivityMinAttribution} points or more, so the auditor had no feature to move. Sensitivity is
            reported as unknown and counts as 0 points in the overall verdict.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="panel-body">
            <RiskShiftChart rows={rows.map((r) => ({ feature: r.feature, from: r.original_risk, to: r.new_risk, pass: r.sensitive }))} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="r">Worsened to</th>
                  <th className="r">Δ risk</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = featureMeta(r.feature);
                  return (
                    <tr key={r.feature}>
                      <td>{featureLabel(r.feature)}</td>
                      <td className="r">
                        {formatFeatureValue(meta, r.original_value)} → {formatFeatureValue(meta, r.worsened_value)}
                      </td>
                      <td className={`r ${r.delta > 0 ? "delta-up" : r.delta < 0 ? "delta-down" : ""}`}>{fmtSigned(r.delta)}</td>
                      <td>
                        <Chip tone={r.sensitive ? "pos" : "warn"}>{r.sensitive ? "sensitive" : "insensitive"}</Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
