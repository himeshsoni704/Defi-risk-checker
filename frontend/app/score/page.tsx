"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getWallets,
  scoreWallet,
  type SampleWallet,
  type ScoreResponse,
} from "@/lib/api";

const EMPTY_FEATURES = {
  repayment_ratio: 0.85,
  high_risk_tx_count: 1,
  wallet_age_days: 450,
  balance_stability: 80,
};

export default function ScorePage() {
  const [wallets, setWallets] = useState<SampleWallet[]>([]);
  const [wallet, setWallet] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [features, setFeatures] = useState({ ...EMPTY_FEATURES });
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWallets(12)
      .then((w) => setWallets(w))
      .catch(() => {
        /* dropdown is optional */
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const addr =
        wallet.trim() || `0x${Math.random().toString(16).slice(2).padEnd(40, "0")}`;
      const res = await scoreWallet(addr, useCustom ? features : undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const approved = result ? result.decision !== "DENIED" : false;

  return (
    <main>
      <section className="page-head">
        <div className="container">
          <h1>Score a wallet</h1>
          <p>
            Choose a sample wallet or paste an address, then run the quantum
            risk pipeline.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <form className="panel" onSubmit={onSubmit}>
            <div className="row">
              <select
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                aria-label="Sample wallets"
              >
                <option value="">Select a sample wallet…</option>
                {wallets.map((w) => (
                  <option key={w.wallet_address} value={w.wallet_address}>
                    {(w.label === 1 ? "⚠ risky" : "✓ safe") +
                      "  " +
                      w.wallet_address}
                  </option>
                ))}
              </select>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <input
                type="text"
                placeholder="0x… wallet address"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
              />
              <button className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                {loading ? "Scoring…" : "Score wallet"}
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <label
                style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}
              >
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                />
                Use custom features instead of dataset lookup
              </label>
            </div>

            {useCustom && (
              <div className="meta-grid" style={{ marginTop: 16 }}>
                <label className="meta-item">
                  <div className="k">Repayment ratio (0–1)</div>
                  <input
                    type="text"
                    value={features.repayment_ratio}
                    onChange={(e) =>
                      setFeatures({
                        ...features,
                        repayment_ratio: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="meta-item">
                  <div className="k">High-risk tx count</div>
                  <input
                    type="text"
                    value={features.high_risk_tx_count}
                    onChange={(e) =>
                      setFeatures({
                        ...features,
                        high_risk_tx_count: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="meta-item">
                  <div className="k">Wallet age (days)</div>
                  <input
                    type="text"
                    value={features.wallet_age_days}
                    onChange={(e) =>
                      setFeatures({
                        ...features,
                        wallet_age_days: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="meta-item">
                  <div className="k">Balance stability (0–100)</div>
                  <input
                    type="text"
                    value={features.balance_stability}
                    onChange={(e) =>
                      setFeatures({
                        ...features,
                        balance_stability: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            )}

            <div className="hint">
              If the address is in the synthetic dataset, its features are looked
              up automatically. Otherwise default features are used.
            </div>
            {error && <div className="error">{error}</div>}
          </form>

          {result && (
            <div className="score-result">
              <div className="score-dial">
                <div
                  className="score-number"
                  style={{ color: approved ? "var(--green)" : "var(--red)" }}
                >
                  {result.risk_score.toFixed(1)}
                </div>
                <div className="score-scale">risk score / 100</div>
                <span
                  className={`pill ${approved ? "pill-approve" : "pill-deny"}`}
                >
                  {result.decision}
                </span>
              </div>

              <div className="panel">
                <div className="meta-grid">
                  <div className="meta-item">
                    <div className="k">Wallet</div>
                    <div className="v mono">{result.wallet_address}</div>
                  </div>
                  <div className="meta-item">
                    <div className="k">Model</div>
                    <div className="v">
                      {String(result.model_version?.model_id ?? "QSVC")} v
                      {String(result.model_version?.model_version ?? "2.0")}
                    </div>
                  </div>
                  <div className="meta-item">
                    <div className="k">Qubits</div>
                    <div className="v">
                      {String(result.model_version?.n_qubits ?? "—")}
                    </div>
                  </div>
                  <div className="meta-item">
                    <div className="k">Audit</div>
                    <div className="v">{result.audit?.overall_verdict ?? "—"}</div>
                  </div>
                  <div className="meta-item" style={{ gridColumn: "1 / -1" }}>
                    <div className="k">Decision hash</div>
                    <div className="v mono">{result.decision_hash}</div>
                  </div>
                </div>

                <div className="row" style={{ marginTop: 20 }}>
                  <Link
                    href={`/explain/${encodeURIComponent(result.wallet_address)}`}
                    className="btn btn-primary"
                  >
                    Why? (explanation)
                  </Link>
                  <Link
                    href={`/audit/${encodeURIComponent(result.wallet_address)}`}
                    className="btn btn-ghost"
                  >
                    Audit report
                  </Link>
                  <Link
                    href={`/verify/${encodeURIComponent(result.wallet_address)}`}
                    className="btn btn-ghost"
                  >
                    Verify on-chain
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
