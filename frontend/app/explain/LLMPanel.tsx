"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { hasQueryData, useQuery } from "@/lib/query";
import { walletKey } from "@/lib/analysis-store";
import { Card, ErrorState, Notice, SkeletonBlock } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";

// Placeholder texts the backend returns instead of an explanation
// (quantum-ml/llm_explainer.py). They are shown as states, not as content.
const DISABLED_PREFIX = "LLM explanations are currently disabled";
const FAILED_PREFIX = "Failed to generate LLM explanation";

/** On-demand Gemini explanation from GET /explain/llm/{wallet}. */
export default function LLMPanel({ wallet }: { wallet: string }) {
  const key = `llm:${walletKey(wallet)}`;
  const [requested, setRequested] = useState(() => hasQueryData(key));
  const q = useQuery(requested ? key : null, () => api.explainWithLLM(wallet));
  const llm = q.data?.llm_explanation ?? null;

  const disabled = llm?.summary.startsWith(DISABLED_PREFIX);
  const failed = llm?.summary.startsWith(FAILED_PREFIX);

  return (
    <Card
      i={4}
      title={
        <>
          <Icon name="sparkle" className="nav-icon" /> Plain-English explanation
        </>
      }
      sub="Gemini, grounded in the SHAP values, the audit and a DeFi knowledge base"
      tour="llm"
      actions={
        requested && !q.fetching && (llm || q.error) ? (
          <button className="btn btn-ghost btn-sm" onClick={() => q.refetch()}>
            <Icon name="refresh" /> Regenerate
          </button>
        ) : undefined
      }
    >
      {!requested ? (
        <div className="stack" style={{ gap: 12 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Generates a written summary of this decision on request. It needs a <span className="mono">GEMINI_API_KEY</span> on the server; without one the
            API reports that the language model is disabled.
          </p>
          <div>
            <button className="btn btn-sm" onClick={() => setRequested(true)}>
              <Icon name="sparkle" /> Generate explanation
            </button>
          </div>
        </div>
      ) : q.fetching && !llm ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="tour-wait">
            <span className="spinner" /> Asking the language model…
          </div>
          <SkeletonBlock lines={4} />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} what="the language-model explanation" />
      ) : !llm ? (
        <Notice tone="warn">The API returned no language-model explanation.</Notice>
      ) : disabled ? (
        <Notice tone="warn" title="Language model disabled on the server.">
          Set <span className="mono">GEMINI_API_KEY</span> in the backend environment and restart the API to enable written explanations. The SHAP and audit
          results on this page do not depend on it.
        </Notice>
      ) : failed ? (
        <Notice tone="bad" title="The language model call failed.">
          {llm.summary.replace(FAILED_PREFIX + ":", "").trim()}
        </Notice>
      ) : (
        <div className="stack rise" style={{ gap: 14 }}>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{llm.summary}</p>
          {llm.key_drivers.length > 0 && (
            <div className="field">
              <span className="faint small">Key drivers</span>
              <ul className="bullets">
                {llm.key_drivers.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="field">
            <span className="faint small">About the audit</span>
            <p className="muted" style={{ fontSize: 13 }}>
              {llm.audit_context}
            </p>
          </div>
          <div className="field">
            <span className="faint small">DeFi principle</span>
            <p className="muted" style={{ fontSize: 13 }}>
              {llm.defi_principle}
            </p>
          </div>
          <p className="faint" style={{ fontSize: 11.5 }}>
            Generated text. Check it against the attributions above.
          </p>
        </div>
      )}
    </Card>
  );
}
