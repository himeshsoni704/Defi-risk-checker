"""
FastAPI REST API for DeFi Risk Checker.
Combines Quantum ML, Explainable AI, and Blockchain Proof-of-Decision.
"""

import os
import sys
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

# Ensure project root is in python path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api.models import (
    ScoreRequest, ScoreResponse,
    ExplainResponse, VerifyWriteResponse, VerifyReadResponse
)
from api.service import orchestrator

app = FastAPI(
    title="DeFi Risk Checker Backend API",
    description=(
        "Wallet risk-scoring system combining Quantum Support Vector Classification (QSVC), "
        "Explainable AI (SHAP attributions), and Blockchain Proof-of-Decision (Sepolia / On-Chain Hash Proofs)."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend teammate (Vite, Next.js, React, Vue, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["General"])
def root():
    return {
        "project": "DeFi Risk Checker",
        "description": "Quantum ML + XAI + Blockchain Proof-of-Decision API",
        "docs_url": "/docs",
        "endpoints": {
            "score": "POST /score",
            "explain": "GET /explain/{wallet_id}",
            "verify_write": "POST /verify/{wallet_id}",
            "verify_read": "GET /verify/{wallet_id}",
            "sample_wallets": "GET /wallets",
            "health": "GET /health"
        }
    }


@app.get("/health", tags=["General"])
def health_check():
    """Returns backend status, Quantum model metadata, and Web3 connection info."""
    return {
        "status": "healthy",
        "quantum_model": {
            "type": orchestrator.qml_model.metadata.get("model_type", "QSVC"),
            "kernel": orchestrator.qml_model.metadata.get("kernel", "FidelityQuantumKernel"),
            "feature_map": orchestrator.qml_model.metadata.get("feature_map", "ZZFeatureMap"),
            "test_accuracy": orchestrator.qml_model.metadata.get("test_accuracy"),
            "test_auc": orchestrator.qml_model.metadata.get("test_auc")
        },
        "web3": {
            "is_live_sepolia": orchestrator.web3_service.is_live_sepolia,
            "network": "Sepolia Testnet" if orchestrator.web3_service.is_live_sepolia else "Sepolia Testnet (Simulated Provider)",
            "explorer_base": orchestrator.web3_service.explorer_base_url
        },
        "dataset_rows": len(orchestrator.dataset),
        "cached_explanations": len(orchestrator.xai_explainer.cache),
        "cached_decisions": len(orchestrator.decisions_store)
    }


@app.get("/wallets", response_model=List[Dict[str, Any]], tags=["Dataset"])
def get_sample_wallets(limit: int = 10):
    """
    Returns sample wallet profiles from the toy dataset.
    Helps frontend teammates easily populate demo dropdowns with pre-existing wallets.
    """
    return orchestrator.list_sample_wallets(limit=limit)


@app.post("/score", response_model=ScoreResponse, tags=["Scoring"])
def score_wallet(request: ScoreRequest):
    """
    Compute Quantum ML DeFi risk score for a wallet.
    Accepts explicit features OR looks up features from the synthetic dataset if only wallet_address is provided.
    Returns continuous risk score (0-100), decision ('approve' or 'deny'), and cryptographic decision hash.
    """
    try:
        return orchestrator.score(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk scoring error: {str(e)}")


@app.get("/explain/{wallet_id}", response_model=ExplainResponse, tags=["XAI"])
def get_wallet_explanation(
    wallet_id: str = Path(..., description="Ethereum wallet address or ID")
):
    """
    Returns SHAP Explainable AI feature contribution breakdown for the specified wallet.
    Shows exact points contributed to risk by repayment_history, high_risk_tx, wallet_age, and balance_stability.
    """
    try:
        return orchestrator.explain(wallet_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation generation error: {str(e)}")


@app.post("/verify/{wallet_id}", response_model=VerifyWriteResponse, tags=["Verification"])
def record_decision_on_chain(
    wallet_id: str = Path(..., description="Ethereum wallet address to anchor on-chain")
):
    """
    Writes the cryptographic decision hash keccak256(wallet_addr + score + explanation_json) on-chain
    via the DecisionProof smart contract.
    Returns transaction hash, block number, and block explorer link.
    """
    try:
        return orchestrator.verify_write(wallet_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"On-chain write error: {str(e)}")


@app.get("/verify/{wallet_id}", response_model=VerifyReadResponse, tags=["Verification"])
def verify_decision_on_chain(
    wallet_id: str = Path(..., description="Ethereum wallet address to verify on-chain")
):
    """
    Reads the recorded decision hash from the smart contract and confirms it matches the stored decision.
    Returns verification boolean (true/false), on-chain hash, and block explorer link.
    """
    try:
        return orchestrator.verify_read(wallet_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"On-chain verification error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
