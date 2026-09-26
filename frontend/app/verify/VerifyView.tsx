"use client";

import { useState } from "react";
import Link from "next/link";
import { useAnalysis, useWalletParam, type WalletRecord } from "@/lib/analysis-store";
import { useHealth, useVerification } from "@/lib/queries";
import { api, errorMessage } from "@/lib/api";
import WalletHeader from "@/components/wallet/WalletHeader";
import NoWallet from "@/components/wallet/NoWallet";
import JsonView from "@/components/ui/JsonView";
import HashFingerprint from "@/components/charts/HashFingerprint";
import { Card, CopyButton, EmptyState, ErrorState, HashValue, Notice, SkeletonBlock, Tag } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
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
          <span className="kicker">
            <span className="step-badge">4</span> Blockchain verification
          </span>
          <h1 className="page-title">Proof of decision</h1>
          <p className="page-lede">
            The Keccak256 hash of the full decision record goes on-chain. Anyone holding the record can recompute the hash and confirm the score, explanation,
            audit and model version were not changed afterwards.
          </p>
        </div>
      </div>

      {!hydrated ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : !wallet ? (
        <NoWallet page="verification" description="On-chain state comes from GET /verify/{wallet}" />
      ) : (
        <>
          <WalletHeader wallet={wallet} />
          {isRunning ? (
            <Notice tone="iris" icon="clock" title="Analysis in progress.">
              Verification status loads when the new score is ready.
            </Notice>
          ) : q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} what="the on-chain verification" />
          ) : !q.data ? (
            <div className="grid g-main">
              <Card title="Reading on-chain state…" tour="verify-status">
                <SkeletonBlock lines={6} />
              </Card>
              <Card tour="canonical-record">
                <SkeletonBlock lines={8} />
              </Card>
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

function Seal({ status }: { status: Status }) {
  const color = status === "verified" ? "var(--good)" : status === "mismatch" ? "var(--bad)" : "var(--ink-3)";
  return (
    <svg className="seal" viewBox="0 0 72 72" aria-hidden>
      <circle className="ring-a" cx="36" cy="36" r="33" stroke={color} strokeOpacity={0.35} />
      <circle cx="36" cy="36" r="26" fill={status === "verified" ? "var(--good-soft)" : status === "mismatch" ? "var(--bad-soft)" : "var(--s2)"} stroke={color} strokeWidth="1.5" />
      {status === "verified" && <path className="check" d="M25 36.5l7.5 7.5L47.5 29" stroke={color} />}
      {status === "mismatch" && <path className="check" d="M28 28l16 16M44 28L28 44" stroke={color} />}
      {(status === "not-anchored" || status === "no-decision") && (
        <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round">
          <rect x="27" y="34" width="18" height="13" rx="2.5" />
          <path d="M30.5 34v-3.5a5.5 5.5 0 0 1 11 0V34" />
        </g>
      )}
    </svg>
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
    verified: { tone: "good", title: "Verified", text: "The hash stored on-chain matches the hash of the current decision record, byte for byte." },
    "not-anchored": { tone: undefined, title: "Not anchored yet", text: "The server holds a decision record for this wallet, but its hash has not been written on-chain." },
    mismatch: {
      tone: "bad",
      title: "Hash mismatch",
      text: "The on-chain hash differs from the current record. The wallet was re-scored after it was anchored, so the proof covers an older decision.",
    },
    "no-decision": { tone: undefined, title: "Nothing to verify", text: "The server has no stored decision for this wallet. Run the assessment to create one." },
  }[status];

  return (
    <>
      <section className="verdict-hero rise" data-tone={head.tone} data-tour="verify-status" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="row" style={{ gap: 22, flexWrap: "nowrap", alignItems: "flex-start" }}>
          <Seal status={status} />
          <div className="stack" style={{ gap: 10 }}>
            <div className="verdict-word" style={{ color: head.tone === "good" ? "var(--good)" : head.tone === "bad" ? "var(--bad)" : "var(--ink)" }}>
              {head.title}
            </div>
            <p style={{ color: "var(--ink)", maxWidth: "60ch", fontSize: 15 }}>{head.text}</p>
            <div className="row">
              <Tag tone={simulated ? "warn" : "good"} icon>
                {v.network}
              </Tag>
              <button className="btn btn-sm" onClick={onRecheck} disabled={refetching}>
                {refetching ? <span className="spinner" /> : <Icon name="refresh" />} Re-check
              </button>
            </div>
          </div>
        </div>
        {v.expected_hash && (
          <div className="row" style={{ gap: 16, flexWrap: "nowrap" }}>
            <div style={{ display: "grid", gap: 6, width: 120 }}>
              <HashFingerprint hash={v.expected_hash} />
              <span className="faint small">Current record</span>
            </div>
            <div style={{ display: "grid", gap: 6, width: 120 }}>
              {v.on_chain_hash ? (
                <HashFingerprint hash={v.on_chain_hash} compare={v.expected_hash} />
              ) : (
                <div className="fingerprint" aria-hidden>
                  {Array.from({ length: 32 }).map((_, i) => (
                    <span key={i} className="fp-cell" style={{ background: "var(--s2)", border: "1px dashed var(--line-3)", "--i": i } as React.CSSProperties} />
                  ))}
                </div>
              )}
              <span className="faint small">On-chain</span>
            </div>
          </div>
        )}
      </section>

      <div className="grid g-main">
        <div className="stack">
          {status === "no-decision" ? (
            <Card i={3}>
              <EmptyState
                title="No record yet"
                actions={
                  <Link href={`/assess?wallet=${encodeURIComponent(wallet)}&run=1`} className="btn btn-primary">
                    <Icon name="play" /> Analyze this wallet
                  </Link>
                }
              >
                GET /verify only reads existing state. Analyzing the wallet creates the decision record that can then be anchored.
              </EmptyState>
            </Card>
          ) : (
            <Card title="Hash comparison" sub="Hash of the server's current record vs. hash read back from the chain" i={3}>
              <div className="stack" style={{ gap: 16 }}>
                <HashRow label="Current record" value={v.expected_hash} other={v.on_chain_hash} />
                <HashRow label="On-chain" value={v.on_chain_hash} other={v.expected_hash} emptyText={v.message ?? "No hash anchored for this wallet."} />
                {status === "verified" && (
                  <Notice tone="good" title="Match.">
                    All 64 hex characters are identical.
                  </Notice>
                )}
              </div>
            </Card>
          )}

          {(status === "not-anchored" || status === "mismatch") && v.expected_hash && (
            <AnchorAction wallet={wallet} hash={v.expected_hash} network={health?.web3.network ?? v.network} simulated={simulated} reanchor={status === "mismatch"} onAnchored={onAnchored} />
          )}

          <Card
            title="Canonical record"
            sub={recordSource ? `The exact JSON that is hashed · ${recordSource}` : "The exact JSON that is hashed"}
            tour="canonical-record"
            i={5}
            actions={recordJson ? <CopyButton value={JSON.stringify(recordJson, null, 2)} label="Copy record JSON" /> : undefined}
          >
            {recordJson ? (
              <div className="stack" style={{ gap: 12 }}>
                <JsonView value={recordJson} maxHeight={420} />
                <p className="faint small">
                  Serialized with sorted keys and no whitespace (<span className="mono">json.dumps(sort_keys=True, separators=(&quot;,&quot;, &quot;:&quot;))</span>), then
                  hashed with Keccak256.
                </p>
              </div>
            ) : (
              <EmptyState title="Record not available here">
                The verification read returns the record once the hash is anchored. Before that, it is shown when the wallet was analyzed in this browser.
              </EmptyState>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Transaction" sub="Anchoring receipt and on-chain read" i={4}>
            <dl className="kv">
              <dt>Status</dt>
              <dd>
                {status === "verified" ? (
                  <Tag tone="good" icon>
                    confirmed · matches
                  </Tag>
                ) : status === "mismatch" ? (
                  <Tag tone="bad" icon>
                    mismatch
                  </Tag>
                ) : (
                  <Tag>not anchored</Tag>
                )}
              </dd>
              <dt>Network</dt>
              <dd>{v.network}</dd>
              <dt>Tx hash</dt>
              <dd>{v.tx_hash ? <HashValue value={v.tx_hash} short /> : <span className="faint">—</span>}</dd>
              <dt>Block</dt>
              <dd className="mono num">
                {receipt ? receipt.block_number.toLocaleString("en-US") : <span className="faint small" style={{ fontFamily: "var(--font-body)" }}>{v.on_chain_hash ? "Only returned when anchoring from this browser" : "—"}</span>}
              </dd>
              <dt>Anchored at</dt>
              <dd>{fmtDateTime(v.timestamp)}</dd>
              <dt>Explorer</dt>
              <dd>
                {v.explorer_url ? (
                  simulated ? (
                    <span className="faint small">Simulated transaction; not on the public Sepolia explorer.</span>
                  ) : (
                    <a href={v.explorer_url} target="_blank" rel="noopener noreferrer" className="link">
                      View on Etherscan
                    </a>
                  )
                ) : (
                  <span className="faint">—</span>
                )}
              </dd>
            </dl>
          </Card>

          <Card title="Proof lifecycle" i={5}>
            <ol className="timeline">
              <li>
                <span className="tl-dot" data-state={v.expected_hash ? "done" : "pending"}>
                  {v.expected_hash && <Icon name="check" />}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>Decision recorded</div>
                  <div className="faint small">
                    {v.expected_hash ? `Hash ${shortHash(v.expected_hash)}` : "Run the assessment to create the record."}
                    {record && v.expected_hash && record.score.decision_hash.toLowerCase() === v.expected_hash.toLowerCase() && ` · ${fmtDateTime(record.score.timestamp)}`}
                  </div>
                </div>
              </li>
              <li>
                <span className="tl-dot" data-state={v.on_chain_hash ? "done" : "pending"}>
                  {v.on_chain_hash && <Icon name="check" />}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>Hash anchored</div>
                  <div className="faint small">{v.on_chain_hash ? `${v.network} · ${fmtDateTime(v.timestamp)}` : "POST /verify writes the hash on-chain."}</div>
                </div>
              </li>
              <li>
                <span className="tl-dot" data-state={status === "verified" ? "done" : status === "mismatch" ? "bad" : "pending"}>
                  {status === "verified" && <Icon name="check" />}
                  {status === "mismatch" && <Icon name="x" />}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>Read back and compared</div>
                  <div className="faint small">
                    {status === "verified" ? "On-chain hash equals the current record's hash." : status === "mismatch" ? "Hashes differ. Re-anchor to cover the current decision." : "Available after anchoring."}
                  </div>
                </div>
              </li>
            </ol>
          </Card>

          {simulated && (
            <Notice tone="warn" title="Simulated provider.">
              No Sepolia RPC URL, private key and contract address are configured, so proofs go to the backend&apos;s local ledger with the same hash logic. See{" "}
              <span className="mono">.env.example</span> to anchor on the live testnet.
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
            {other && other.length === value.length
              ? Array.from(value).map((ch, i) => (
                  <span key={i} className={ch.toLowerCase() === other[i].toLowerCase() ? undefined : "diff"}>
                    {ch}
                  </span>
                ))
              : value}
          </span>
          <CopyButton value={value} label={`Copy ${label.toLowerCase()} hash`} />
        </div>
      ) : (
        <div className="hash-box faint small">{emptyText ?? "—"}</div>
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
  const toast = useToast();

  async function send() {
    setPhase("sending");
    setError(null);
    try {
      const r = await api.anchor(wallet);
      setReceipt(r);
      setPhase("done");
      toast({ tone: "good", title: `Anchored in block ${r.block_number.toLocaleString("en-US")}`, body: `Tx ${shortHash(r.tx_hash)} · ${r.status}` });
      onAnchored(r);
    } catch (e) {
      setError(errorMessage(e));
      setPhase("error");
      toast({ tone: "bad", title: "Anchoring failed", body: errorMessage(e) });
    }
  }

  return (
    <Card title={reanchor ? "Re-anchor the current record" : "Anchor on-chain"} sub="POST /verify/{wallet}" glow i={4}>
      {phase === "idle" && (
        <div className="row between" style={{ gap: 16 }}>
          <p className="muted" style={{ maxWidth: "52ch" }}>
            Writes the current decision hash to {network}.{reanchor ? " The new entry replaces the older proof for this wallet." : ""}
          </p>
          <button className="btn btn-primary" onClick={() => setPhase("confirm")}>
            <Icon name="lock" /> {reanchor ? "Re-anchor hash" : "Anchor hash"}
          </button>
        </div>
      )}
      {phase === "confirm" && (
        <div className="confirm-box" role="alertdialog" aria-label="Confirm anchoring">
          <strong>Write this hash on-chain?</strong>
          <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
            <div style={{ width: 72, flex: "none" }}>
              <HashFingerprint hash={hash} />
            </div>
            <HashValue value={hash} />
          </div>
          <p className="muted small">
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
        <div className="row" style={{ gap: 10 }}>
          <span className="spinner" style={{ color: "var(--iris)" }} /> Anchoring on {network}…
        </div>
      )}
      {phase === "done" && receipt && (
        <Notice tone="good" title={`Anchored in block ${receipt.block_number.toLocaleString("en-US")}.`}>
          Transaction {shortHash(receipt.tx_hash)} is {receipt.status}. Reading it back to verify.
        </Notice>
      )}
      {phase === "error" && (
        <Notice
          tone="bad"
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
    </Card>
  );
}
