"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAudit, type XAIAuditReport } from "@/lib/api";
import AuditPanel from "@/components/AuditPanel";

export default function AuditPage() {
  const params = useParams<{ wallet: string }>();
  const wallet = decodeURIComponent(params.wallet);
  const [audit, setAudit] = useState<XAIAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAudit(wallet)
      .then(setAudit)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [wallet]);

  return (
    <main>
      <section className="page-head">
        <div className="container">
          <h1>Explanation audit</h1>
          <p className="mono">{wallet}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          {error && <div className="error">{error}</div>}
          {!audit && !error && <div className="loading">Running audit…</div>}
          {audit && (
            <>
              <div className="panel">
                <AuditPanel audit={audit} />
              </div>
              <div className="row" style={{ marginTop: 18 }}>
                <Link
                  href={`/explain/${encodeURIComponent(wallet)}`}
                  className="btn btn-ghost"
                >
                  View explanation
                </Link>
                <Link
                  href={`/verify/${encodeURIComponent(wallet)}`}
                  className="btn btn-primary"
                >
                  Verify on-chain
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
