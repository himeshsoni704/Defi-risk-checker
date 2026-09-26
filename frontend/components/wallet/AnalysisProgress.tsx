"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { WalletGlyph } from "@/components/ui/primitives";
import { shortAddress } from "@/lib/format";

// The stages POST /score executes, in order (api/service.py RiskOrchestrator.score).
const STAGES = [
  { icon: "database", name: "Features", detail: "12 values from the dataset or your scenario" },
  { icon: "cpu", name: "Quantum inference", detail: "6-qubit ZZFeatureMap, statevector kernel" },
  { icon: "bars", name: "SHAP", detail: "Kernel SHAP over the 6 circuit inputs" },
  { icon: "shield", name: "Audit", detail: "Perturbations, 5 clones, sensitivity" },
  { icon: "hash", name: "Record", detail: "Canonical JSON → Keccak256" },
];

export default function AnalysisProgress({ wallet, startedAt, custom }: { wallet: string; startedAt: number; custom: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);
  const elapsed = (now - startedAt) / 1000;

  return (
    <section className="card card-glow rise" aria-live="polite" aria-busy="true">
      <div className="trace">
        <div className="trace-top">
          <div className="row" style={{ gap: 14 }}>
            <WalletGlyph address={wallet} size={44} />
            <div>
              <div className="faint small">{custom ? "Scoring scenario for" : "Analyzing"}</div>
              <div className="mono" style={{ fontSize: 16 }}>
                {shortAddress(wallet, 10, 8)}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="trace-timer">
              {elapsed.toFixed(1)}
              <span className="faint" style={{ fontSize: 18, marginLeft: 4 }}>
                s
              </span>
            </div>
          </div>
        </div>

        <div className="trace-track">
          <div className="trace-line" />
          {STAGES.map((s, i) => (
            <div className="trace-node" key={s.name}>
              <span className="trace-dot" style={{ "--i": i } as React.CSSProperties}>
                <Icon name={s.icon} />
              </span>
              <span className="trace-name">{s.name}</span>
              <span className="trace-detail">{s.detail}</span>
            </div>
          ))}
        </div>

        <p className="faint small" style={{ maxWidth: "80ch" }}>
          All five stages run inside a single POST /score request, so the server reports no per-stage progress. Scoring usually takes 1–3 seconds; the first
          request after the API starts is slower while the quantum simulator warms up.
        </p>
      </div>
    </section>
  );
}
