"use client";

import { useState } from "react";
import Link from "next/link";
import { useAnalysis, useWalletParam, type WalletRecord } from "@/lib/analysis-store";
import { useHealth, useVerification } from "@/lib/queries";
import { api, errorMessage } from "@/lib/api";
import WalletHeader from "@/components/wallet/WalletHeader";
import NoWallet from "@/components/wallet/NoWallet";
import JsonView from "@/components/ui/JsonView";
import { Chip, CopyButton, EmptyState, ErrorState, HashValue, Notice, Panel, SkeletonBlock } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { fmtDateTime, shortHash } from "@/lib/format";
import { withWallet } from "@/components/shell/nav";
import type { AnchorResponse, HealthResponse, VerifyResponse } from "@/lib/types";

type Status = "no-decision" | "not-anchored" | "verified" | "mismatch";

function statusOf(v: VerifyResponse): Status {
  if (!v.expected_hash) return v.on_chain_hash ? "mismatch" : "no-decision";
  if (!v.on_chain_hash) return "not-anchored";
  return v.verified ? "verified" : "mismatch";
}

export default function VerifyView({ urlWallet }: { urlWallet?: string }) {
  const { wallet, hydrated } = useWalletParam(urlWallet);
  const { running, getRecord, saveAnchor } = useAnalysis();
  const isRunning = Boolean(running && wallet && running.wallet.toLowerCase() === wallet.toLowerCase());
  const q = useVerification(isRunning ? null : wallet);
  const health = useHealth();
  const record = getRecord(wallet);

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head-text">
          <span className="eyebrow">Step 4 · Blockchain verification</span>
          <h1 className="page-title">Proof of decision</h1>
          <p className="page-lede">
            The Keccak256 hash of the full decision record is written on-chain. Anyone holding the record can recompute the hash and check that the score,
            explanation, audit and model version were not changed afterwards.
          </p>
        </div>
      </div>

      {!hydrated ? (
        <Panel>
          <SkeletonBlock lines={6} />
        </Panel>
      ) : !wallet ? (
        <NoWallet page="verification" description="On-chain state comes from GET /verify/{wallet}" />
      ) : (
        <>
          <WalletHeader wallet={wallet} current="verify" />
          {isRunning ? (
            <Notice tone="accent" icon="clock" title="Analysis in progress.">
              Verification status will load when the new score is ready.
            </Notice>
          ) : q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} what="the on-chain verification" />
          ) : !q.data ? (
            <div className="grid grid-main-side">
              <Panel title="Reading on-chain state…" tour="verify-status">
                <SkeletonBlock lines={6} />
              </Panel>
              <Panel tour="canonical-record">
                <SkeletonBlock lines={8} />
              </Panel>
            </div>
          ) : (
            <VerifyBody
              wallet={wallet}
              v={q.data}
              refetching={q.fetching}
              onRecheck={() => q.refetch()}
              record={record}
              health={health.data}
              onAnchored={(a) => {
                saveAnchor(wallet, a);
                q.refetch();
              }}
            />
          )}
        </>
      )}
    </main>
  );
}

function VerifyBody({
  wallet,
  v,
  refetching,
  onRecheck,
  record,
  health,
  onAnchored,
}: {
  wallet: string;
  v: VerifyResponse;
  refetching: boolean;
  onRecheck: () => void;
  record: WalletRecord | undefined;
  health: HealthResponse | undefined;
  onAnchored: (a: AnchorResponse) => void;
}) {
  const status = statusOf(v);
  const simulated = /simulated/i.test(v.network) || (health ? !health.web3.is_live_sepolia : false);
  const receipt = record?.anchor && v.on_chain_hash && record.anchor.decision_hash.toLowerCase() === v.on_chain_hash.toLowerCase() ? record.anchor : undefined;
  const recordJson = v.canonical_record ?? (status !== "mismatch" ? record?.score.canonical_record : undefined) ?? null;
  const recordSource = v.canonical_record ? "anchored record from the ledger" : recordJson ? "current record from this browser's analysis" : null;

  const head = {
    verified: { tone: "pos" as const, title: "Verified", text: "The hash stored on-chain matches the hash of the current decision record." },
    "not-anchored": { tone: "neutral" as const, title: "Not anchored yet", text: "The server has a decision record for this wallet, but its hash has not been written on-chain." },
    mismatch: {
      tone: "neg" as const,
      title: "Hash mismatch",
      text: "The hash on-chain differs from the current decision record. The wallet was re-scored after it was anchored, so the anchored proof covers an older decision.",
    },
    "no-decision": {
      tone: "neutral" as const,
      title: "No decision to verify",
      text: "The server has no stored decision for this wallet. Run the assessment first; that creates the record and its hash.",
    },
  }[status];

  return (
    <>
      <div className="grid grid-main-side">
        <div className="stack">
          <section className="verdict-banner" data-tone={head.tone === "neutral" ? undefined : head.tone} data-tour="verify-status">
            <div>
              <div className="eyebrow">Verification</div>
              <div className="verdict-word" style={{ color: head.tone === "pos" ? "var(--pos)" : head.tone === "neg" ? "var(--neg)" : "var(--text)" }}>
                {head.title}
              </div>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <p style={{ color: "var(--text)" }}>{head.text}</p>
              <div className="row">
                <Chip tone={simulated ? "warn" : "pos"}>{v.network}</Chip>
                <button className="btn btn-sm" onClick={onRecheck} disabled={refetching}>
                  {refetching ? <span className="spinner" /> : <Icon name="refresh" />} Re-check
                </button>
              </div>
            </div>
          </section>

          {status === "no-decision" ? (
            <Panel>
              <EmptyState
                title="Nothing recorded yet"
                actions={
                  <Link href={`/assess?wallet=${encodeURIComponent(wallet)}&run=1`} className="btn btn-primary">
                    <Icon name="play" /> Analyze this wallet
                  </Link>
                }
              >
                GET /verify reads existing state only. Analyzing the wallet creates the decision record that can then be anchored.
              </EmptyState>
            </Panel>
          ) : (
            <Panel title="Hash comparison" sub="Expected: hash of the server's current decision record · On-chain: hash read back from the contract or ledger">
              <div className="stack" style={{ gap: 14 }}>
                <HashRow label="Expected (current record)" value={v.expected_hash} other={v.on_chain_hash} />
                <HashRow label="On-chain" value={v.on_chain_hash} other={v.expected_hash} emptyText={v.message ?? "No hash anchored for this wallet."} />
                {status === "verified" && (
                  <Notice tone="pos" title="Match.">
                    All 64 hex characters are identical.
                  </Notice>
                )}
              </div>
            </Panel>
          )}

          {(status === "not-anchored" || status === "mismatch") && v.expected_hash && (
            <AnchorAction wallet={wallet} hash={v.expected_hash} network={health?.web3.network ?? v.network} simulated={simulated} reanchor={status === "mismatch"} onAnchored={onAnchored} />
          )}

          <Panel title="Canonical record" sub={recordSource ? `The exact JSON that is hashed · ${recordSource}` : "The exact JSON that is hashed"} tour="canonical-record" actions={recordJson ? <CopyButton value={JSON.stringify(recordJson, null, 2)} label="Copy record JSON" /> : undefined}>
            {recordJson ? (
              <div className="stack" style={{ gap: 12 }}>
                <JsonView value={recordJson} maxHeight={420} />
                <p className="faint" style={{ fontSize: 12.5 }}>
                  The backend serializes this object with sorted keys and no whitespace (<span className="mono">json.dumps(sort_keys=True, separators=(&quot;,&quot;, &quot;:&quot;))</span>) and hashes the
                  UTF-8 string with Keccak256.
                </p>
              </div>
            ) : (
              <EmptyState title="Record not available here">
                The verification read returns the record once the hash is anchored. Before that, it is shown when the wallet was analyzed in this browser.
              </EmptyState>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Transaction" sub="Anchoring receipt and on-chain read">
            <dl className="kv">
              <dt>Status</dt>
              <dd>
                {status === "verified" ? <Chip tone="pos">confirmed · matches</Chip> : status === "mismatch" ? <Chip tone="neg">mismatch</Chip> : <Chip>not anchored</Chip>}
              </dd>
              <dt>Network</dt>
              <dd>{v.network}</dd>
              <dt>Tx hash</dt>
              <dd>{v.tx_hash ? <HashValue value={v.tx_hash} short /> : <span className="faint">—</span>}</dd>
              <dt>Block</dt>
              <dd className="mono num">
                {receipt ? receipt.block_number.toLocaleString("en-US") : <span className="faint" style={{ fontFamily: "var(--font-body)" }}>{v.on_chain_hash ? "Returned only when anchoring from this browser" : "—"}</span>}
              </dd>
              <dt>Anchored at</dt>
              <dd>{fmtDateTime(v.timestamp)}</dd>
              <dt>Explorer</dt>
              <dd>
                {v.explorer_url ? (
                  simulated ? (
                    <span className="faint" style={{ fontSize: 12.5 }}>
                      Simulated transaction; it does not exist on the public Sepolia explorer.
                    </span>
                  ) : (
                    <a href={v.explorer_url} target="_blank" rel="noopener noreferrer" className="link">
                      View on Etherscan <Icon name="external" className="nav-icon" />
                    </a>
                  )
                ) : (
                  <span className="faint">—</span>
                )}
              </dd>
            </dl>
          </Panel>

          <Panel title="Proof lifecycle">
            <ol className="timeline">
              <li>
                <span className="tl-dot" data-state={v.expected_hash ? "done" : "pending"} />
                <div>
                  <div style={{ fontWeight: 500 }}>Decision recorded</div>
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    {v.expected_hash ? `Hash ${shortHash(v.expected_hash)}` : "Run the assessment to create the record."}
                    {record && v.expected_hash && record.score.decision_hash.toLowerCase() === v.expected_hash.toLowerCase() && ` · ${fmtDateTime(record.score.timestamp)}`}
                  </div>
                </div>
              </li>
              <li>
                <span className="tl-dot" data-state={v.on_chain_hash ? "done" : "pending"} />
                <div>
                  <div style={{ fontWeight: 500 }}>Hash anchored</div>
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    {v.on_chain_hash ? `${v.network} · ${fmtDateTime(v.timestamp)}` : "POST /verify writes the hash on-chain."}
                  </div>
                </div>
              </li>
              <li>
                <span className="tl-dot" data-state={status === "verified" ? "done" : status === "mismatch" ? "bad" : "pending"} />
                <div>
                  <div style={{ fontWeight: 500 }}>Read back and compared</div>
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    {status === "verified" ? "On-chain hash equals the current record's hash." : status === "mismatch" ? "Hashes differ. Re-anchor to cover the current decision." : "Available after anchoring."}
                  </div>
                </div>
              </li>
            </ol>
          </Panel>

          {simulated && (
            <Notice tone="warn" title="Simulated provider.">
              The backend has no Sepolia RPC URL, private key and contract address configured, so it records proofs in a local ledger file with the same hash logic.
              See <span className="mono">.env.example</span> to anchor on the live testnet.
            </Notice>
          )}
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Link href={withWallet("/audit", wallet)} className="btn btn-ghost">
          <Icon name="arrowLeft" /> Audit
        </Link>
        <Link href="/" className="btn">
          Back to dashboard
        </Link>
      </div>
    </>
  );
}

function HashRow({ label, value, other, emptyText }: { label: string; value: string | null; other: string | null; emptyText?: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {value ? (
        <div className="hash hash-box">
          <span className="hash-compare" style={{ flex: 1 }}>
            <span>
              {other && other.length === value.length
                ? Array.from(value).map((ch, i) => (
                    <span key={i} className={ch.toLowerCase() === other[i].toLowerCase() ? "ok" : "diff"}>
                      {ch}
                    </span>
                  ))
                : value}
            </span>
          </span>
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
        </div>
      ) : (
        <div className="hash-box faint" style={{ fontSize: 13 }}>
          {emptyText ?? "—"}
        </div>
      )}
    </div>
  );
}

function AnchorAction({
  wallet,
  hash,
  network,
  simulated,
  reanchor,
  onAnchored,
}: {
  wallet: string;
  hash: string;
  network: string;
  simulated: boolean;
  reanchor: boolean;
  onAnchored: (a: AnchorResponse) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<AnchorResponse | null>(null);

  async function send() {
    setPhase("sending");
    setError(null);
    try {
      const r = await api.anchor(wallet);
      setReceipt(r);
      setPhase("done");
      onAnchored(r);
    } catch (e) {
      setError(errorMessage(e));
      setPhase("error");
    }
  }

  return (
    <Panel title={reanchor ? "Re-anchor the current record" : "Anchor on-chain"} sub="POST /verify/{wallet}">
      {phase === "idle" && (
        <div className="stack" style={{ gap: 12 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Writes the current decision hash to {network}. {reanchor ? "The new entry replaces the older proof for this wallet." : ""}
          </p>
          <div>
            <button className="btn btn-primary" onClick={() => setPhase("confirm")}>
              <Icon name="lock" /> {reanchor ? "Re-anchor hash" : "Anchor hash"}
            </button>
          </div>
        </div>
      )}
      {phase === "confirm" && (
        <div className="confirm-box fade-in" role="alertdialog" aria-label="Confirm anchoring">
          <strong>Write this hash on-chain?</strong>
          <HashValue value={hash} />
          <p className="muted" style={{ fontSize: 13 }}>
            {simulated
              ? "The simulated provider stores it in the backend's local ledger. No real transaction is sent and no gas is spent."
              : "This sends a real Sepolia transaction signed with the server's key and waits for the receipt (up to 90 seconds)."}
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={send}>
              Confirm and anchor
            </button>
            <button className="btn btn-ghost" onClick={() => setPhase("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {phase === "sending" && (
        <div className="tour-wait">
          <span className="spinner" /> Anchoring on {network}…
        </div>
      )}
      {phase === "done" && receipt && (
        <Notice tone="pos" title={`Anchored in block ${receipt.block_number.toLocaleString("en-US")}.`}>
          Transaction {shortHash(receipt.tx_hash)} is {receipt.status}. Reading the hash back now to verify it.
        </Notice>
      )}
      {phase === "error" && (
        <Notice
          tone="neg"
          title="Anchoring failed."
          actions={
            <button className="btn btn-sm" onClick={() => setPhase("confirm")}>
              Try again
            </button>
          }
        >
          {error}
        </Notice>
      )}
    </Panel>
  );
}
