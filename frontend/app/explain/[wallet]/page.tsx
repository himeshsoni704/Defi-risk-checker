"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getExplain, type ExplainResponse } from "@/lib/api";
import ContributionChart from "@/components/ContributionChart";
import AuditPanel from "@/components/AuditPanel";

export default function ExplainPage() {
  const params = useParams<{ wallet: string }>();
  const wallet = decodeURIComponent(params.wallet);
  const [data, setData] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExplain(wallet)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [wallet]);

  return (
    <main>
      <section className="page-head">
        <div className="container">
          <h1>Why this decision?</h1>
          <p className="mono">{wallet}</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          {error && <div className="error">{error}</div>}
          {!data && !error && <div className="loading">Loading explanation…</div>}
          {data && (
            <>
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="meta-grid">
                  <div className="meta-item">
                    <div className="k">Risk score</div>
                    <div className="v">{data.risk_score.toFixed(1)} / 100</div>
                  </div>
                  <div className="meta-item">
                    <div className="k">Decision</div>
                    <div className="v">{data.decision}</div>
                  </div>
                  <div className="meta-item">
                    <div className="k">Base value</div>
                    <div className="v">{data.base_risk_value.toFixed(1)}</div>
                  </div>
                  <div className="meta-item">
                    <div className="k">Source</div>
                    <div className="v">{data.cached ? "warm cache" : "computed"}</div>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ marginBottom: 18 }}>
                <h3 style={{ marginTop: 0 }}>Feature contributions</h3>
                <ContributionChart contributions={data.feature_contributions} />
              </div>

              <div className="panel" style={{ marginBottom: 18 }}>
                <h3 style={{ marginTop: 0 }}>Explanation audit</h3>
                <AuditPanel audit={data.audit} />
              </div>

              <div className="row">
                <Link href={`/verify/${encodeURIComponent(wallet)}`} className="btn btn-primary">
                  Verify on-chain
                </Link>
                <Link href="/score" className="btn btn-ghost">
                  Score another wallet
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
