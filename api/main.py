"""
FastAPI REST API for DeFi Risk Checker (v2.0).
Pipeline: Quantum ML → SHAP → XAI Audit → Canonical Blockchain Record.
"""

import os
import sys
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api.models import (
    ScoreRequest, ScoreResponse,
    ExplainResponse, VerifyWriteResponse, VerifyReadResponse,
)
from api.service import orchestrator

app = FastAPI(
    title="DeFi Risk Checker API",
    description=(
        "Wallet risk-scoring combining Quantum Support Vector Classification (QSVC), "
        "SHAP Explainable AI, an independent XAI Audit layer (faithfulness · stability · sensitivity), "
        "and Blockchain Proof-of-Decision (Keccak256 canonical record on Sepolia)."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── General ──────────────────────────────────────────────────────────────────

@app.get("/", tags=["General"])
def root():
    return {
        "project": "DeFi Risk Checker v2.0",
        "pipeline": "WALLET → QSVC → SHAP → XAI Audit → Canonical Record → Keccak256 → Blockchain",
        "docs_url": "/docs",
        "endpoints": {
            "score":            "POST /score",
            "explain":          "GET  /explain/{wallet_id}",
            "explain_llm":      "GET  /explain/llm/{wallet_id}",
            "audit":            "GET  /audit/{wallet_id}",
            "compare_models":   "GET  /compare",
            "verify_write":     "POST /verify/{wallet_id}",
            "verify_read":      "GET  /verify/{wallet_id}",
            "sample_wallets":   "GET  /wallets",
            "health":           "GET  /health",
        },
    }


@app.get("/health", tags=["General"])
def health_check():
    """System status: QSVC metadata, Web3 connection, cache sizes."""
    return {
        "status": "healthy",
        "quantum_model": {
            "model_id":              orchestrator.qml_model.metadata.get("model_id", "QSVC-ZZFeatureMap"),
            "model_version":         orchestrator.qml_model.metadata.get("model_version", "2.0"),
            "dataset_version":       orchestrator.qml_model.metadata.get("dataset_version", "2.0"),
            "feature_schema_version":orchestrator.qml_model.metadata.get("feature_schema_version", "2.0"),
            "n_qubits":              orchestrator.qml_model.metadata.get("n_qubits", 6),
            "feature_map":           orchestrator.qml_model.metadata.get("feature_map"),
            "test_accuracy":         orchestrator.qml_model.metadata.get("test_accuracy"),
            "test_auc":              orchestrator.qml_model.metadata.get("test_auc"),
            "test_f1":               orchestrator.qml_model.metadata.get("test_f1"),
            "trained_at":            orchestrator.qml_model.metadata.get("trained_at"),
        },
        "web3": {
            "is_live_sepolia":  orchestrator.web3_service.is_live_sepolia,
            "network":          "Sepolia Testnet" if orchestrator.web3_service.is_live_sepolia
                                else "Sepolia (Simulated Provider)",
            "explorer_base":    orchestrator.web3_service.explorer_base_url,
        },
        "dataset_rows":         len(orchestrator.dataset),
        "cached_explanations":  len(orchestrator.xai_explainer.cache),
        "cached_decisions":     len(orchestrator.decisions_store),
    }


# ── Dataset ───────────────────────────────────────────────────────────────────

@app.get("/wallets", response_model=List[Dict[str, Any]], tags=["Dataset"])
def get_sample_wallets(limit: int = 10):
    """
    Returns sample wallet profiles (mix of safe & risky) from the expanded 12-feature dataset.
    Useful for quickly populating frontend demo dropdowns.
    """
    return orchestrator.list_sample_wallets(limit=limit)


# ── Scoring ───────────────────────────────────────────────────────────────────

@app.post("/score", response_model=ScoreResponse, tags=["Scoring"])
def score_wallet(request: ScoreRequest):
    """
    Full pipeline: QSVC risk score → SHAP explanation → XAI audit →
    canonical JSON record → Keccak256 decision hash.

    Returns risk_score, decision (APPROVED/DENIED), full audit report,
    model version provenance, and the canonical_record that was hashed.
    """
    try:
        return orchestrator.score(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk scoring error: {str(e)}")


# ── XAI ───────────────────────────────────────────────────────────────────────

@app.get("/explain/{wallet_id}", response_model=ExplainResponse, tags=["XAI"])
def get_wallet_explanation(
    wallet_id: str = Path(..., description="Ethereum wallet address or ID"),
):
    """
    Returns SHAP feature attribution breakdown + full XAI audit report
    (faithfulness · stability · sensitivity) for the specified wallet.
    Does not invoke the LLM.
    """
    try:
        return orchestrator.explain(wallet_id, include_llm=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation error: {str(e)}")


@app.get("/explain/llm/{wallet_id}", response_model=ExplainResponse, tags=["XAI"])
def get_wallet_llm_explanation(
    wallet_id: str = Path(..., description="Ethereum wallet address or ID"),
):
    """
    Returns SHAP feature attributions, XAI audit report, AND a Gemini RAG-grounded
    structured explanation translating the mathematical features into plain English.
    """
    try:
        return orchestrator.explain(wallet_id, include_llm=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Explanation error: {str(e)}")


@app.get("/audit/{wallet_id}", tags=["XAI"])
def get_xai_audit(
    wallet_id: str = Path(..., description="Ethereum wallet address or ID"),
):
    """
    Returns the standalone XAI audit report for a wallet:
      - Faithfulness: does perturbing top SHAP features shift the prediction proportionally?
      - Stability: do micro-perturbed clones produce consistent SHAP rankings?
      - Sensitivity: does the model respond directionally to feature changes?
      - Overall verdict: SUPPORTED | SUPPORTED WITH CAUTION | QUESTIONABLE
    """
    try:
        return orchestrator.get_audit(wallet_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit error: {str(e)}")


# ── Model Comparison ──────────────────────────────────────────────────────────

@app.get("/compare", tags=["Model Comparison"])
def get_model_comparison():
    """
    Returns head-to-head performance comparison:
      Classical SVM  vs  XGBoost  vs  QSVC (Quantum)
    Metrics: Accuracy, F1, AUC, Inference time.

    Run `python quantum-ml/classical_baseline.py` to populate XGBoost / SVM results.
    """
    return orchestrator.get_model_comparison()


# ── Verification ──────────────────────────────────────────────────────────────

@app.post("/verify/{wallet_id}", response_model=VerifyWriteResponse, tags=["Verification"])
def record_decision_on_chain(
    wallet_id: str = Path(..., description="Wallet address to anchor on-chain"),
):
    """
    Anchors the canonical decision hash on-chain via the DecisionProof smart contract.

    The hash commits to:
      wallet_id · model version · risk_score · decision · features
      · SHAP explanation · XAI audit results (faithfulness · stability · sensitivity)

    Returns tx_hash, block_number, and block explorer link.
    """
    try:
        return orchestrator.verify_write(wallet_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"On-chain write error: {str(e)}")


@app.get("/verify/{wallet_id}", response_model=VerifyReadResponse, tags=["Verification"])
def verify_decision_on_chain(
    wallet_id: str = Path(..., description="Wallet address to verify on-chain"),
):
    """
    Reads the on-chain decision hash and verifies it matches the stored canonical record.

    verified=true means: the exact prediction, explanation, model version,
    and audit result displayed in the UI match the blockchain commitment.
    """
    try:
        return orchestrator.verify_read(wallet_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"On-chain verification error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
