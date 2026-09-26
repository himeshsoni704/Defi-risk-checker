"use client";

import { useState } from "react";
import WalletInput from "@/components/WalletInput";
import RiskGauge from "@/components/RiskGauge";
import ShapChart from "@/components/ShapChart";
import AuditCard from "@/components/AuditCard";
import VerifyPanel from "@/components/VerifyPanel";
import ComparisonTable from "@/components/ComparisonTable";
import {
  scoreWallet,
  explainWallet,
  getComparison,
  type ScoreResponse,
  type ExplainResponse,
  type ModelComparison,
} from "@/lib/api";

type Step = "input" | "loading" | "risk" | "explain" | "audit" | "verify" | "comparison";

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [walletAddress, setWalletAddress] = useState("");
  const [scoreResult, setScoreResult] = useState<ScoreResponse | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainResponse | null>(null);
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleWalletSubmit = async (wallet: string) => {
    setWalletAddress(wallet);
    setStep("loading");
    setError(null);
    setLoadingStage("Extracting features...");

    try {
      setLoadingStage("Running QSVC model...");
      const score = await scoreWallet(wallet);
      setScoreResult(score);

      try {
        setLoadingStage("Computing SHAP explanations...");
        const explain = await explainWallet(wallet);
        setExplainResult(explain);
      } catch (explainErr) {
        console.warn("SHAP explanation failed, continuing without it:", explainErr);
        setExplainResult(null);
      }

      setLoadingStage("Auditing explanation...");
      // Brief delay to show the audit stage
      await new Promise((resolve) => setTimeout(resolve, 500));

      setStep("risk");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to score wallet";
      setError(errorMessage);
      console.error("Wallet scoring error:", err);
      setStep("input");
    }
  };

  const handleNext = () => {
    if (step === "risk") setStep("explain");
    else if (step === "explain") {
      // Skip audit if not available
      if (scoreResult?.audit) {
        setStep("audit");
      } else {
        setStep("verify");
      }
    }
    else if (step === "audit") setStep("verify");
  };

  const handleBack = () => {
    if (step === "explain") setStep("risk");
    else if (step === "audit") setStep("explain");
    else if (step === "verify") setStep("audit");
  };

  const handleShowComparison = async () => {
    try {
      const comp = await getComparison();
      setComparison(comp);
      setStep("comparison");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load comparison";
      setError(errorMessage);
      console.error("Comparison error:", err);
    }
  };

  const handleReset = () => {
    setStep("input");
    setWalletAddress("");
    setScoreResult(null);
    setExplainResult(null);
    setComparison(null);
    setError(null);
  };

  return (
    <main>
      <section className="page-head">
        <div className="container">
          <h1>DeFi Risk Checker</h1>
          <p>
            Quantum ML risk scoring with explainable AI and blockchain verification
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {step === "input" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>Connect Wallet</h2>
                <p style={{ color: "var(--muted)" }}>
                  Enter a wallet address or select from sample wallets to begin the risk assessment
                </p>
              </div>
              <WalletInput onSubmit={handleWalletSubmit} />
              {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}
            </div>
          )}

          {step === "loading" && (
            <div className="panel" style={{ textAlign: "center", padding: 60 }}>
              <div className="spinner" style={{ width: 48, height: 48, margin: "0 auto 20px" }} />
              <div className="loading-pulse" style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Analyzing wallet...
              </div>
              <div style={{ color: "var(--muted)" }}>{loadingStage}</div>
              <button
                className="btn btn-ghost"
                onClick={handleReset}
                style={{ marginTop: 20 }}
              >
                Cancel
              </button>
            </div>
          )}

          {step === "risk" && scoreResult && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>Risk Assessment</h2>
                <p style={{ color: "var(--muted)" }}>
                  Wallet: <span className="mono">{walletAddress}</span>
                </p>
              </div>

              <div className="grid grid-2">
                <RiskGauge score={scoreResult.risk_score} decision={scoreResult.decision} />

                <div className="panel">
                  <h3 style={{ marginBottom: 16 }}>Decision Details</h3>
                  <div className="meta-grid">
                    <div className="meta-item">
                      <div className="k">Model</div>
                      <div className="v">{scoreResult.model_version?.model_id || scoreResult.quantum_model || "QSVC"}</div>
                    </div>
                    <div className="meta-item">
                      <div className="k">Version</div>
                      <div className="v">{scoreResult.model_version?.model_version || "2.0"}</div>
                    </div>
                    {scoreResult.model_version && (
                      <>
                        <div className="meta-item">
                          <div className="k">Qubits</div>
                          <div className="v">{scoreResult.model_version.n_qubits}</div>
                        </div>
                        <div className="meta-item">
                          <div className="k">Accuracy</div>
                          <div className="v">{(scoreResult.model_version.test_accuracy * 100).toFixed(1)}%</div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="row" style={{ marginTop: 20 }}>
                    <button className="btn btn-primary" onClick={handleNext}>
                      Why? →
                    </button>
                    <button className="btn btn-ghost" onClick={handleReset}>
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "explain" && explainResult && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>Why? (SHAP Explanation)</h2>
                <p style={{ color: "var(--muted)" }}>
                  Feature contributions that influenced the risk score
                </p>
              </div>

              <div className="panel">
                <ShapChart contributions={explainResult.feature_contributions} />

                <div className="row" style={{ marginTop: 24 }}>
                  <button className="btn btn-ghost" onClick={handleBack}>
                    ← Back
                  </button>
                  {scoreResult?.audit ? (
                    <button className="btn btn-primary" onClick={handleNext}>
                      Can we trust this? →
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => setStep("verify")}>
                      On-chain proof →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === "explain" && !explainResult && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>Why? (SHAP Explanation)</h2>
                <p style={{ color: "var(--muted)" }}>
                  Feature contributions that influenced the risk score
                </p>
              </div>

              <div className="panel" style={{ textAlign: "center", padding: 40 }}>
                <p style={{ color: "var(--muted)" }}>
                  Explanation data not available.
                </p>
                <div className="row" style={{ marginTop: 20, justifyContent: "center" }}>
                  <button className="btn btn-ghost" onClick={handleBack}>
                    ← Back
                  </button>
                  {scoreResult?.audit ? (
                    <button className="btn btn-primary" onClick={handleNext}>
                      Can we trust this? →
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => setStep("verify")}>
                      On-chain proof →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === "audit" && scoreResult && scoreResult.audit && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>Can we trust this? (XAI Audit)</h2>
                <p style={{ color: "var(--muted)" }}>
                  Independent verification of the explanation quality
                </p>
              </div>

              <div className="panel">
                <AuditCard audit={scoreResult.audit} />

                <div className="row" style={{ marginTop: 24 }}>
                  <button className="btn btn-ghost" onClick={handleBack}>
                    ← Back
                  </button>
                  <button className="btn btn-primary" onClick={handleNext}>
                    On-chain proof →
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "audit" && scoreResult && !scoreResult.audit && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>Can we trust this? (XAI Audit)</h2>
                <p style={{ color: "var(--muted)" }}>
                  Independent verification of the explanation quality
                </p>
              </div>

              <div className="panel" style={{ textAlign: "center", padding: 40 }}>
                <p style={{ color: "var(--muted)" }}>
                  Audit information not available in the current response.
                </p>
                <div className="row" style={{ marginTop: 20, justifyContent: "center" }}>
                  <button className="btn btn-ghost" onClick={handleBack}>
                    ← Back
                  </button>
                  <button className="btn btn-primary" onClick={handleNext}>
                    On-chain proof →
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "verify" && scoreResult && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>On-Chain Proof</h2>
                <p style={{ color: "var(--muted)" }}>
                  Blockchain verification of the decision record
                </p>
              </div>

              <div className="panel">
                <VerifyPanel
                  walletAddress={walletAddress}
                  decisionHash={scoreResult.decision_hash}
                />

                <div className="row" style={{ marginTop: 24 }}>
                  <button className="btn btn-ghost" onClick={handleBack}>
                    ← Back
                  </button>
                  <button className="btn btn-ghost" onClick={handleShowComparison}>
                    Model comparison
                  </button>
                  <button className="btn btn-primary" onClick={handleReset}>
                    New wallet
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "comparison" && comparison && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>Model Comparison</h2>
                <p style={{ color: "var(--muted)" }}>
                  Performance comparison across different ML models
                </p>
              </div>

              <div className="panel">
                <ComparisonTable comparison={comparison} />

                <div className="row" style={{ marginTop: 24 }}>
                  <button className="btn btn-ghost" onClick={() => setStep("verify")}>
                    ← Back to verification
                  </button>
                  <button className="btn btn-primary" onClick={handleReset}>
                    New wallet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}