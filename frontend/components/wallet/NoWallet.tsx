"use client";

import { useRouter } from "next/navigation";
import WalletPicker from "./WalletPicker";
import { Panel } from "@/components/ui/primitives";

/** Empty state for flow pages opened without a wallet. */
export default function NoWallet({ page, description }: { page: string; description: string }) {
  const router = useRouter();
  return (
    <Panel title={`No wallet selected`} sub={description}>
      <div className="stack">
        <p className="muted" style={{ maxWidth: "62ch" }}>
          The {page} page works on one wallet at a time. Choose a wallet below: it is scored on the Risk assessment page, and the step bar there brings you back here.
        </p>
        <WalletPicker onSubmit={(w) => router.push(`/assess?wallet=${encodeURIComponent(w)}&run=1`)} />
      </div>
    </Panel>
  );
}
