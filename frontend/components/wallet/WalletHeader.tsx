"use client";

import Link from "next/link";
import { CopyButton, WalletGlyph } from "@/components/ui/primitives";
import FlowStepper from "./FlowStepper";

/** Wallet identity bar + step navigation shared by the four flow pages. */
export default function WalletHeader({
  wallet,
  current,
  right,
}: {
  wallet: string;
  current: "assess" | "explain" | "audit" | "verify";
  right?: React.ReactNode;
}) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="wallet-bar">
        <div className="wallet-id">
          <WalletGlyph address={wallet} />
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Wallet</div>
            <div className="hash">
              <span className="hash-text">{wallet}</span>
              <CopyButton value={wallet} label="Copy address" />
            </div>
          </div>
        </div>
        <div className="topbar-spacer" />
        <div className="row">
          {right}
          <Link href="/" className="btn btn-ghost btn-sm">
            Change wallet
          </Link>
        </div>
      </div>
      <FlowStepper wallet={wallet} current={current} />
    </div>
  );
}
