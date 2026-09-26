"""
Pydantic Models for DeFi Risk Checker REST API.
Defines strict schemas for requests, responses, model versioning, XAI audit, and baseline comparisons.
"""

from typing import Dict, Optional, Any, List, Union
from pydantic import BaseModel, Field


class WalletFeatures(BaseModel):
    wallet_age_days: Optional[int] = Field(
        None, ge=0, description="Days since wallet first active on-chain"
    )
    transaction_count: Optional[int] = Field(
        None, ge=0, description="Total number of on-chain transactions"
    )
    avg_transaction_value: Optional[float] = Field(
        None, ge=0.0, description="Average ETH transaction size"
    )
    repayment_ratio: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Fraction of borrows repaid on time (0.0 to 1.0)"
    )
    liquidation_count: Optional[int] = Field(
        None, ge=0, description="Count of past liquidation events"
    )
    borrow_count: Optional[int] = Field(
        None, ge=0, description="Number of DeFi borrow events"
    )
    high_risk_tx_count: Optional[int] = Field(
        None, ge=0, description="Interactions with mixers or high-risk protocols"
    )
    protocol_count: Optional[int] = Field(
        None, ge=0, description="Distinct DeFi protocols interacted with"
    )
    balance_stability: Optional[float] = Field(
        None, ge=0.0, le=100.0, description="Balance stability / coefficient of variation score (0 to 100)"
    )
    failed_transactions: Optional[int] = Field(
        None, ge=0, description="Count of failed transactions"
    )
    large_tx_ratio: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Fraction of transactions > 5 ETH"
    )
    historical_default: Optional[int] = Field(
        None, ge=0, le=1, description="Binary flag: prior default event (0 or 1)"
    )
    # Legacy compatibility fields
    repayment_history_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    balance_stability_score: Optional[float] = Field(None, ge=0.0, le=100.0)


class ModelVersionRecord(BaseModel):
    model_id: str
    model_version: str
    dataset_version: str
    feature_schema_version: str
    qml_features: List[str]
    n_qubits: int
    trained_at: Union[int, str]


class AuditDimensionResult(BaseModel):
    score: float
    score_pct: float
    verdict: str
    display_level: str
    description: str


class XAIAuditReport(BaseModel):
    faithfulness: Dict[str, Any]
    stability: Dict[str, Any]
    sensitivity: Dict[str, Any]
    overall_verdict: str = Field(
        ..., description="'SUPPORTED' | 'SUPPORTED WITH CAUTION' | 'QUESTIONABLE'"
    )
    overall_description: str
    summary_lines: List[str]


class LLMExplanation(BaseModel):
    summary: str
    key_drivers: List[str]
    audit_context: str
    defi_principle: str


class ScoreRequest(BaseModel):
    wallet_address: Optional[str] = Field(
        None,
        description="Ethereum wallet address (0x...). If omitted, an ephemeral address is generated."
    )
    features: Optional[WalletFeatures] = Field(
        None,
        description="Explicit wallet features. If omitted, looked up from synthetic dataset by wallet_address."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "wallet_address": "0x71C8363e3799173F35733365055170993001569B",
                "features": {
                    "wallet_age_days": 420,
                    "transaction_count": 150,
                    "avg_transaction_value": 2.5,
                    "repayment_ratio": 0.85,
                    "liquidation_count": 0,
                    "borrow_count": 12,
                    "high_risk_tx_count": 1,
                    "protocol_count": 8,
                    "balance_stability": 78.0,
                    "failed_transactions": 1,
                    "large_tx_ratio": 0.1,
                    "historical_default": 0
                }
            }
        }
    }


class ScoreResponse(BaseModel):
    wallet_address: str
    risk_score: float = Field(..., description="Continuous risk score from 0.0 to 100.0 (higher = riskier)")
    decision: str = Field(..., description="'APPROVE' or 'DENIED'")
    decision_hash: str = Field(..., description="Keccak256 hash of canonical JSON record")
    features: Dict[str, Any]
    model_version: Dict[str, Any]
    audit: XAIAuditReport
    classical_baseline: Dict[str, Any] = Field(
        ..., description="Head-to-head comparison metrics with XGBoost / Classical SVM"
    )
    canonical_record: Dict[str, Any]
    timestamp: int


class ExplainResponse(BaseModel):
    wallet_address: str
    risk_score: float
    decision: str
    base_risk_value: float = Field(..., description="Expected baseline risk before feature deviations")
    feature_contributions: Dict[str, float] = Field(
        ...,
        description="SHAP attribution points per feature"
    )
    input_features: Dict[str, float]
    audit: XAIAuditReport
    llm_explanation: Optional[LLMExplanation] = Field(None, description="Gemini RAG-based explanation")
    cached: bool = Field(..., description="True if retrieved from fast warm cache")


class VerifyWriteResponse(BaseModel):
    wallet_address: str
    decision_hash: str
    tx_hash: str
    block_number: int
    network: str
    status: str
    explorer_url: str
    timestamp: int


class VerifyReadResponse(BaseModel):
    wallet_address: str
    verified: bool = Field(..., description="True if on-chain recorded hash matches stored canonical decision")
    on_chain_hash: Optional[str] = None
    expected_hash: Optional[str] = None
    tx_hash: Optional[str] = None
    network: str
    explorer_url: Optional[str] = None
    timestamp: Optional[int] = None
    canonical_record: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
