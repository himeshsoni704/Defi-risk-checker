"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  anchorOnChain,
  verifyOnChain,
  type VerifyReadResponse,
  type VerifyWriteResponse,
} from "@/lib/api";

export default function VerifyPage() {
  const params = useParams<{ wallet: string }>();
  const wallet = decodeURIComponent(params.wallet);
  const [write, setWrite] = useState<VerifyWriteResponse | null>(null);
  const [read, setRead] = useState<VerifyReadResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRead(await verifyOnChain(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  async function anchor() {
    setBusy(true);
    setError(null);
    try {
      setWrite(await anchorOnChain(wallet));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const verified = read?.verified === true;

  return (
    <main>
      <section className="page-head">
        <div className="container">
          <h1>On-chain proof</h1>
          <p className="mono">{wallet}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          {error && <div className="error">{error}</div>}

          <div className="panel" style={{ marginBottom: 18 }}>
            <div
              className={`pill ${verified ? "pill-approve" : "pill-deny"}`}
              style={{ marginTop: 0 }}
            >
              {verified ? "✓ VERIFIED" : "NOT YET ANCHORED"}
            </div>
            <p style={{ color: "var(--muted)", marginTop: 14 }}>
              {read?.message ??
                (verified
                  ? "The on-chain hash matches the canonical decision record."
                  : "Anchor the decision hash to commit it to the chain.")}
            </p>
            <button className="btn btn-primary" onClick={anchor} disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? "Anchoring…" : "Anchor decision on-chain"}
            </button>
          </div>

          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Hashes</h3>
            <div className="meta-grid">
              <div className="meta-item" style={{ gridColumn: "1 / -1" }}>
                <div className="k">On-chain hash</div>
                <div className="v mono">{read?.on_chain_hash ?? "—"}</div>
              </div>
              <div className="meta-item" style={{ gridColumn: "1 / -1" }}>
                <div className="k">Expected hash</div>
                <div className="v mono">{read?.expected_hash ?? "—"}</div>
              </div>
              <div className="meta-item">
                <div className="k">Network</div>
                <div className="v">{read?.network ?? "—"}</div>
              </div>
              {write && (
                <div className="meta-item">
                  <div className="k">Block</div>
                  <div className="v">{write.block_number}</div>
                </div>
              )}
              {read?.tx_hash && (
                <div className="meta-item" style={{ gridColumn: "1 / -1" }}>
                  <div className="k">Transaction</div>
                  <div className="v mono">{read.tx_hash}</div>
                </div>
              )}
            </div>
            {read?.explorer_url && (
              <p className="hint">
                Simulated provider — explorer link:{" "}
                <a href={read.explorer_url} style={{ color: "var(--accent)" }}>
                  {read.explorer_url}
                </a>
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
