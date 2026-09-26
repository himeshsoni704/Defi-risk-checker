"""
Pydantic Models for DeFi Risk Checker REST API.
Defines strict schemas for requests and responses.
"""

from typing import Dict, Optional, Any
from pydantic import BaseModel, Field


class WalletFeatures(BaseModel):
    repayment_history_score: float = Field(
        ..., ge=0.0, le=100.0,
        description="Repayment history quality (0 to 100, higher = better credit)"
    )
    high_risk_tx_count: int = Field(
        ..., ge=0,
        description="Count of interactions with mixers, high-risk leverage, or liquidations"
    )
    wallet_age_days: int = Field(
        ..., ge=0,
        description="Days since wallet first active on-chain"
    )
    balance_stability_score: float = Field(
        ..., ge=0.0, le=100.0,
        description="Wallet liquidity and balance stability (0 to 100, higher = more stable)"
    )


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
                    "repayment_history_score": 82.5,
                    "high_risk_tx_count": 1,
                    "wallet_age_days": 420,
                    "balance_stability_score": 78.0
                }
            }
        }
    }


class ScoreResponse(BaseModel):
    wallet_address: str
    risk_score: float = Field(..., description="Continuous risk score from 0.0 to 100.0 (higher = riskier)")
    decision: str = Field(..., description="'approve' if risk_score < 50.0 else 'deny'")
    decision_hash: str = Field(..., description="keccak256 hash of (wallet_address + score + canonical_explanation)")
    features: Dict[str, float]
    quantum_model: str
    timestamp: int


class ExplainResponse(BaseModel):
    wallet_address: str
    risk_score: float
    decision: str
    base_risk_value: float = Field(..., description="Expected baseline risk before feature deviations")
    feature_contributions: Dict[str, float] = Field(
        ...,
        description="Attribution points per feature (e.g. {'repayment_history': -15.2, 'high_risk_tx': +21.4})"
    )
    input_features: Dict[str, float]
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
    verified: bool = Field(..., description="True if on-chain recorded hash matches stored decision")
    on_chain_hash: Optional[str] = None
    expected_hash: Optional[str] = None
    tx_hash: Optional[str] = None
    network: str
    explorer_url: Optional[str] = None
    timestamp: Optional[int] = None
    message: Optional[str] = None
