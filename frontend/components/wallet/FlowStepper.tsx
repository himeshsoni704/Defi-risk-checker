"use client";

import Link from "next/link";
import { FLOW, withWallet } from "@/components/shell/nav";
import { flowStatus } from "@/components/shell/flowState";
import { useAnalysis } from "@/lib/analysis-store";
import Icon from "@/components/ui/Icon";

export default function FlowStepper({ wallet, current }: { wallet: string; current: "assess" | "explain" | "audit" | "verify" }) {
  const { getRecord } = useAnalysis();
  const status = flowStatus(getRecord(wallet));
  return (
    <nav className="flow" aria-label="Analysis steps">
      {FLOW.map((item) => {
        const s = status[item.flow!];
        const isCurrent = item.flow === current;
        return (
          <Link
            key={item.href}
            href={withWallet(item.href, wallet)}
            className="flow-step"
            data-state={s.state}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="flow-num">
              {s.state === "done" && !isCurrent ? <Icon name="check" className="nav-icon" /> : item.step}
            </span>
            <span className="flow-name">{item.label}</span>
            <span className="flow-meta">{s.meta}</span>
          </Link>
        );
      })}
    </nav>
  );
}
