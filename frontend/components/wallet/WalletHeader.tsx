"use client";

import Link from "next/link";
import { CopyButton, Tag, WalletGlyph } from "@/components/ui/primitives";
import { useAnalysis } from "@/lib/analysis-store";
import { decisionTone } from "@/lib/verdicts";
import { fmtRelative } from "@/lib/format";
import Icon from "@/components/ui/Icon";

/** Wallet identity bar shared by the four flow pages. */
export default function WalletHeader({ wallet, right }: { wallet: string; right?: React.ReactNode }) {
  const { getRecord } = useAnalysis();
  const rec = getRecord(wallet);
  return (
    <div className="wallet-bar rise" style={{ "--i": 1 } as React.CSSProperties}>
      <WalletGlyph address={wallet} size={36} />
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        <div className="faint small">Wallet</div>
        <div className="hash" style={{ fontSize: 13.5 }}>
          <span className="hash-text">{wallet}</span>
          <CopyButton value={wallet} label="Copy address" />
        </div>
      </div>
      <div className="row">
        {rec ? (
          <>
            <Tag tone={decisionTone(rec.score.decision)} icon>
              {rec.score.risk_score.toFixed(1)} · {rec.score.decision}
            </Tag>
            <span className="faint small">scored {fmtRelative(rec.scoredAt)}</span>
          </>
        ) : (
          <Tag>not analyzed here</Tag>
        )}
        {right}
        <Link href="/" className="btn btn-ghost btn-sm">
          <Icon name="refresh" /> Switch
        </Link>
      </div>
    </div>
  );
}
