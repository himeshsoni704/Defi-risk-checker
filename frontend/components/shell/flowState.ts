import type { WalletRecord } from "@/lib/analysis-store";
import { overallTone } from "@/lib/verdicts";
import { fmtNumber } from "@/lib/format";

export type StepState = "done" | "warn" | "bad" | "idle";

export interface FlowStatus {
  state: StepState;
  meta: string;
}

/** Summarises what this browser knows about each flow step for a wallet. */
export function flowStatus(record: WalletRecord | undefined): Record<"assess" | "explain" | "audit" | "verify", FlowStatus> {
  if (!record) {
    return {
      assess: { state: "idle", meta: "Not analyzed" },
      explain: { state: "idle", meta: "Needs a score" },
      audit: { state: "idle", meta: "Needs a score" },
      verify: { state: "idle", meta: "Needs a score" },
    };
  }
  const s = record.score;
  const tone = overallTone(s.audit.overall_verdict);
  const anchored = record.anchor && record.anchor.decision_hash.toLowerCase() === s.decision_hash.toLowerCase();
  return {
    assess: { state: "done", meta: `${fmtNumber(s.risk_score)} · ${s.decision}` },
    explain: {
      state: "done",
      meta: `base ${fmtNumber(s.canonical_record?.explanation?.base_value)} → ${fmtNumber(s.risk_score)}`,
    },
    audit: {
      state: tone === "pos" ? "done" : tone === "warn" ? "warn" : tone === "neg" ? "bad" : "idle",
      meta: s.audit.overall_verdict.toLowerCase(),
    },
    verify: anchored ? { state: "done", meta: `block ${record.anchor!.block_number}` } : { state: "idle", meta: "Not anchored" },
  };
}
