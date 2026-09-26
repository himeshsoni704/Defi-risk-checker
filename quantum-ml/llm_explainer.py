"""
LLM Explanation Layer using Gemini 3.8 Flash, RAG, and Chain of Thought.
Takes the SHAP attributions and XAI Audit results, retrieves relevant
DeFi risk principles from the RAG knowledge base, and outputs a structured
explanation of *why* the wallet received its risk score, backed by data.
"""

import os
from typing import Dict, Any, List
from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

from rag_knowledge_base import retrieve_passages, build_retrieval_query


# ── Structured Output Schema ────────────────────────────────────────────────

class LLMExplanation(BaseModel):
    summary: str = Field(
        ..., description="A 1-2 sentence executive summary of the risk decision."
    )
    key_drivers: List[str] = Field(
        ..., description="Bullet points explaining the top SHAP features in plain English."
    )
    audit_context: str = Field(
        ..., description="Explanation of the XAI audit result (Faithfulness/Stability/Sensitivity)."
    )
    defi_principle: str = Field(
        ..., description="A broader DeFi risk principle from the RAG knowledge base that applies here."
    )


# ── Explainer ───────────────────────────────────────────────────────────────

class LLMRiskExplainer:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key or not genai:
            self.client = None
            print("[LLM] Warning: google-genai not installed or GEMINI_API_KEY missing. LLM explanations disabled.")
        else:
            self.client = genai.Client(api_key=self.api_key)

    def generate_explanation(self, shap_result: Dict[str, Any], audit_result: Dict[str, Any]) -> LLMExplanation:
        """
        Generate a RAG-grounded, Chain-of-Thought explanation using Gemini.
        """
        if not self.client:
            return LLMExplanation(
                summary="LLM explanations are currently disabled (missing API key or SDK).",
                key_drivers=["Enable GEMINI_API_KEY to see detailed drivers."],
                audit_context=f"The algorithmic audit returned: {audit_result.get('overall_verdict', 'UNKNOWN')}.",
                defi_principle="DeFi risk models evaluate on-chain behavior such as repayment history and liquidations."
            )

        # 1. RAG Retrieval
        query, boost_topics = build_retrieval_query(shap_result, audit_result)
        passages = retrieve_passages(query, top_k=3, boost_topics=boost_topics)
        
        rag_context = "\n\n".join(
            f"KNOWLEDGE PASSAGE (Topic: {p['topic']}):\n{p['text']}" 
            for p in passages
        )

        # 2. Build Context for the Prompt
        risk_score = shap_result.get("risk_score", 0)
        decision = shap_result.get("decision", "UNKNOWN")
        base_value = shap_result.get("base_risk_value", 0)
        
        contribs = shap_result.get("feature_contributions", {})
        sorted_feats = sorted(contribs.items(), key=lambda x: -abs(x[1]))
        
        feature_context = "\n".join(
            f"- {feat}: {val:.1f} attribution point(s) (Actual value: {shap_result.get('input_features', {}).get(feat, 'N/A')})"
            for feat, val in sorted_feats[:5]
        )

        audit_context = (
            f"Overall Verdict: {audit_result.get('overall_verdict')}\n"
            f"Faithfulness: {audit_result.get('faithfulness', {}).get('verdict')}\n"
            f"Stability: {audit_result.get('stability', {}).get('verdict')}\n"
            f"Sensitivity: {audit_result.get('sensitivity', {}).get('verdict')}"
        )

        # 3. System Prompt (Chain of Thought + RAG)
        prompt = f"""You are an expert DeFi Risk Analyst.
Your task is to explain a Quantum Machine Learning (QSVC) risk decision to a user or loan officer.

<RAG_KNOWLEDGE_BASE>
You MUST ground your explanation in these retrieved DeFi risk principles:
{rag_context}
</RAG_KNOWLEDGE_BASE>

<WALLET_DECISION>
Risk Score: {risk_score:.1f} / 100 (Baseline: {base_value:.1f})
Decision: {decision}
</WALLET_DECISION>

<SHAP_FEATURE_ATTRIBUTIONS>
The top driving factors (positive = increases risk, negative = decreases risk):
{feature_context}
</SHAP_FEATURE_ATTRIBUTIONS>

<XAI_AUDIT_RESULTS>
An independent audit tested the SHAP explanation:
{audit_context}
</XAI_AUDIT_RESULTS>

INSTRUCTIONS (Chain of Thought):
1. Think silently about how the top SHAP features relate to the RAG knowledge.
2. Note whether the XAI Audit supports the SHAP values (if QUESTIONABLE, mention that the explanation is mathematically unreliable).
3. Draft a 1-2 sentence executive summary.
4. Translate the top 2-3 SHAP features into plain English bullet points (key_drivers).
5. Explain the audit result simply (audit_context).
6. State the broader DeFi principle at play based *only* on the RAG knowledge.
7. Output exactly the structured JSON matching the schema.
"""

        try:
            # We use 3.8-flash (fast, good at structured output + thought)
            response = self.client.interactions.create(
                model="gemini-3.8-flash",
                input=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=LLMExplanation,
                    temperature=0.2, # Keep it factual
                )
            )
            
            # Pydantic will parse the JSON string back into our model
            return LLMExplanation.model_validate_json(response.output_text)
            
        except Exception as e:
            print(f"[LLM] Error generating explanation: {e}")
            return LLMExplanation(
                summary=f"Failed to generate LLM explanation: {e}",
                key_drivers=["SHAP extraction succeeded, but LLM generation failed."],
                audit_context="See raw audit output.",
                defi_principle="N/A"
            )
