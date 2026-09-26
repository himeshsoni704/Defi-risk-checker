"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { fmtDuration, shortAddress } from "@/lib/format";

// The stages POST /score executes, in order (api/service.py RiskOrchestrator.score).
const STAGES = [
  { name: "Resolve features", detail: "Look up the wallet's 12 features in the dataset, or use the supplied scenario." },
  { name: "Quantum inference", detail: "QSVC with a 6-qubit ZZFeatureMap and a statevector fidelity kernel." },
  { name: "SHAP attribution", detail: "Kernel SHAP over the 6 circuit features against a 3-profile background." },
  { name: "Explanation audit", detail: "Faithfulness perturbations, 5 stability clones, sensitivity checks." },
  { name: "Decision record", detail: "Canonical JSON record hashed with Keccak256." },
];

export default function AnalysisProgress({ wallet, startedAt, custom }: { wallet: string; startedAt: number; custom: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const elapsed = now - startedAt;

  return (
    <section className="panel fade-in" aria-live="polite" aria-busy="true">
      <div className="progress">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow">Analyzing {custom ? "scenario for" : ""}</div>
            <div className="mono" style={{ fontSize: 15 }}>
              {shortAddress(wallet, 10, 8)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow">Elapsed</div>
            <div className="mono num" style={{ fontSize: 15 }}>
              {fmtDuration(elapsed)}
            </div>
          </div>
        </div>
        <div className="progress-bar" />
        <ol className="stage-list">
          {STAGES.map((s) => (
            <li className="stage" key={s.name} data-state="active">
              <span className="stage-icon">
                <Icon name="clock" />
              </span>
              <span>
                <div className="stage-name">{s.name}</div>
                <div className="stage-detail">{s.detail}</div>
              </span>
              <span className="stage-tag">in request</span>
            </li>
          ))}
        </ol>
        <p className="faint" style={{ fontSize: 12.5 }}>
          All five stages run inside one POST /score request, so the server does not report progress per stage. Scoring usually takes 1–3 seconds;
          the first request after the API starts can take longer while the quantum simulator warms up.
        </p>
      </div>
    </section>
  );
}
