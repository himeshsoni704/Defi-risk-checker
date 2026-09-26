"use client";

import { useRouter } from "next/navigation";
import WalletPicker from "./WalletPicker";
import { Card } from "@/components/ui/primitives";

/** Empty state for flow pages opened without a wallet. */
export default function NoWallet({ page, description }: { page: string; description: string }) {
  const router = useRouter();
  return (
    <Card title="Pick a wallet to continue" sub={description} glow i={1}>
      <div className="stack">
        <p className="muted" style={{ maxWidth: "62ch" }}>
          The {page} works on one wallet at a time. Choose one below: it is scored on the Risk assessment page, and the flow bar at the top brings you back
          here.
        </p>
        <WalletPicker onSubmit={(w) => router.push(`/assess?wallet=${encodeURIComponent(w)}&run=1`)} />
      </div>
    </Card>
  );
}
