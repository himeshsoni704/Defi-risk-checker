"""
Core Orchestration Service for DeFi Risk Checker.
Integrates Quantum ML inference, XAI attribution generation, and Web3 cryptographic proof anchoring.
"""

import os
import sys
import time
import json
import pandas as pd
from typing import Dict, Any, Optional, List
from eth_account import Account
from web3 import Web3

# Add root directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Add quantum-ml and contracts directories
QML_DIR = os.path.join(BASE_DIR, "quantum-ml")
CONTRACTS_DIR = os.path.join(BASE_DIR, "contracts")
if QML_DIR not in sys.path:
    sys.path.insert(0, QML_DIR)
if CONTRACTS_DIR not in sys.path:
    sys.path.insert(0, CONTRACTS_DIR)

from qml_model import QuantumRiskModel, FEATURE_NAMES
from xai_explainer import QuantumXAIExplainer, DISPLAY_FEATURE_MAP
from web3_service import Web3Service, compute_decision_hash
from api.models import (
    ScoreRequest, ScoreResponse,
    ExplainResponse, VerifyWriteResponse, VerifyReadResponse
)

DATA_PATH = os.path.join(BASE_DIR, "data", "synthetic_wallets.csv")
STORE_PATH = os.path.join(BASE_DIR, "data", "decisions_store.json")


class RiskOrchestrator:
    def __init__(self):
        print("[Orchestrator] Initializing Quantum ML model and XAI Explainer...")
        self.qml_model = QuantumRiskModel.load()
        self.xai_explainer = QuantumXAIExplainer(qml_model=self.qml_model)
        self.web3_service = Web3Service()
        self.dataset = self._load_dataset()
        self.decisions_store: Dict[str, Dict[str, Any]] = self._load_decisions_store()
        print("[Orchestrator] System initialized and ready.")

    def _load_dataset(self) -> pd.DataFrame:
        """Load toy dataset of synthetic wallets."""
        if os.path.exists(DATA_PATH):
            return pd.read_csv(DATA_PATH)
        return pd.DataFrame()

    def _load_decisions_store(self) -> Dict[str, Dict[str, Any]]:
        """Load decisions cache from disk."""
        if os.path.exists(STORE_PATH):
            try:
                with open(STORE_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_decisions_store(self):
        """Save decisions store to disk."""
        os.makedirs(os.path.dirname(STORE_PATH), exist_ok=True)
        try:
            with open(STORE_PATH, "w") as f:
                json.dump(self.decisions_store, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save decisions store: {e}")

    def get_wallet_from_dataset(self, wallet_address: str) -> Optional[Dict[str, Any]]:
        """Look up wallet in synthetic dataset by address (case-insensitive)."""
        if self.dataset.empty:
            return None
        match = self.dataset[self.dataset["wallet_address"].str.lower() == wallet_address.lower()]
        if not match.empty:
            row = match.iloc[0]
            return {
                "wallet_address": row["wallet_address"],
                "repayment_history_score": float(row["repayment_history_score"]),
                "high_risk_tx_count": int(row["high_risk_tx_count"]),
                "wallet_age_days": int(row["wallet_age_days"]),
                "balance_stability_score": float(row["balance_stability_score"]),
                "label": int(row["label"])
            }
        return None

    def list_sample_wallets(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Return list of sample wallets from the dataset for quick frontend testing."""
        if self.dataset.empty:
            return []
        
        # Take equal mix of safe and risky wallets
        safe = self.dataset[self.dataset["label"] == 0].head(limit // 2)
        risky = self.dataset[self.dataset["label"] == 1].head(limit // 2)
        combined = pd.concat([safe, risky]).to_dict(orient="records")
        return combined

    def score(self, req: ScoreRequest) -> ScoreResponse:
        """
        Process risk scoring for a wallet:
        1. Resolve features (from request or synthetic dataset).
        2. Run Quantum ML model inference.
        3. Retrieve/compute XAI feature contributions.
        4. Compute deterministic keccak256 decision hash.
        5. Store decision for subsequent verify / explain requests.
        """
        # Resolve wallet address
        wallet_addr = req.wallet_address
        if not wallet_addr:
            wallet_addr = Account.create().address

        # Resolve features
        features_dict = None
        if req.features:
            features_dict = req.features.model_dump()
        else:
            db_record = self.get_wallet_from_dataset(wallet_addr)
            if db_record:
                features_dict = {
                    "repayment_history_score": db_record["repayment_history_score"],
                    "high_risk_tx_count": db_record["high_risk_tx_count"],
                    "wallet_age_days": db_record["wallet_age_days"],
                    "balance_stability_score": db_record["balance_stability_score"]
                }
            else:
                # Default baseline profile if unknown wallet address
                features_dict = {
                    "repayment_history_score": 65.0,
                    "high_risk_tx_count": 2,
                    "wallet_age_days": 280,
                    "balance_stability_score": 60.0
                }

        feature_vector = [
            features_dict["repayment_history_score"],
            features_dict["high_risk_tx_count"],
            features_dict["wallet_age_days"],
            features_dict["balance_stability_score"]
        ]

        # 1. Quantum ML inference (pretrained QSVC)
        risk_score = float(self.qml_model.predict_risk_score(feature_vector)[0])
        decision = self.qml_model.evaluate_decision(risk_score)

        # 2. XAI explanation (SHAP attributions with warm cache)
        explanation = self.xai_explainer.explain(feature_vector, wallet_address=wallet_addr)

        # 3. Cryptographic hash: keccak256(wallet_addr + score + explanation_json)
        decision_hash = compute_decision_hash(wallet_addr, risk_score, explanation)

        # 4. Save to decisions store
        now = int(time.time())
        stored_entry = {
            "wallet_address": wallet_addr,
            "risk_score": risk_score,
            "decision": decision,
            "decision_hash": decision_hash,
            "features": features_dict,
            "explanation": explanation,
            "timestamp": now,
            "quantum_model": self.qml_model.metadata.get("model_type", "QSVC with ZZFeatureMap")
        }
        self.decisions_store[wallet_addr.lower()] = stored_entry
        self._save_decisions_store()

        return ScoreResponse(
            wallet_address=wallet_addr,
            risk_score=risk_score,
            decision=decision,
            decision_hash=decision_hash,
            features=features_dict,
            quantum_model=stored_entry["quantum_model"],
            timestamp=now
        )

    def explain(self, wallet_id: str) -> ExplainResponse:
        """
        Return feature contribution breakdown for a given wallet ID.
        Uses fast precomputed cache where available.
        """
        clean_id = wallet_id.strip()
        stored = self.decisions_store.get(clean_id.lower())

        if stored and "explanation" in stored:
            exp = stored["explanation"]
            return ExplainResponse(
                wallet_address=stored["wallet_address"],
                risk_score=stored["risk_score"],
                decision=stored["decision"],
                base_risk_value=exp["base_risk_value"],
                feature_contributions=exp["feature_contributions"],
                input_features=exp["input_features"],
                cached=True
            )

        # Check dataset if not yet scored in this session
        db_wallet = self.get_wallet_from_dataset(clean_id)
        if db_wallet:
            # Score and explain
            score_res = self.score(ScoreRequest(wallet_address=clean_id))
            return self.explain(clean_id)

        # If completely unknown, return neutral baseline explanation
        baseline_features = [65.0, 2, 280, 60.0]
        exp = self.xai_explainer.explain(baseline_features, wallet_address=clean_id)
        return ExplainResponse(
            wallet_address=clean_id,
            risk_score=exp["risk_score"],
            decision=exp["decision"],
            base_risk_value=exp["base_risk_value"],
            feature_contributions=exp["feature_contributions"],
            input_features=exp["input_features"],
            cached=exp.get("cached", False)
        )

    def verify_write(self, wallet_id: str) -> VerifyWriteResponse:
        """
        Anchor decision hash on-chain via smart contract recordDecision().
        Returns transaction hash and explorer URL.
        """
        clean_id = wallet_id.strip()
        stored = self.decisions_store.get(clean_id.lower())

        if not stored:
            # Auto-score if wallet is present in dataset
            self.score(ScoreRequest(wallet_address=clean_id))
            stored = self.decisions_store.get(clean_id.lower())

        decision_hash = stored["decision_hash"]
        on_chain_receipt = self.web3_service.record_decision_on_chain(clean_id, decision_hash)

        # Update stored record with on-chain metadata
        stored["on_chain"] = on_chain_receipt
        self._save_decisions_store()

        return VerifyWriteResponse(
            wallet_address=clean_id,
            decision_hash=decision_hash,
            tx_hash=on_chain_receipt["tx_hash"],
            block_number=on_chain_receipt["block_number"],
            network=on_chain_receipt["network"],
            status=on_chain_receipt["status"],
            explorer_url=on_chain_receipt["explorer_url"],
            timestamp=on_chain_receipt["timestamp"]
        )

    def verify_read(self, wallet_id: str) -> VerifyReadResponse:
        """
        Read on-chain decision hash from smart contract and confirm it matches stored decision.
        """
        clean_id = wallet_id.strip()
        stored = self.decisions_store.get(clean_id.lower())
        expected_hash = stored.get("decision_hash") if stored else None

        result = self.web3_service.verify_decision_on_chain(clean_id, expected_hash=expected_hash)

        return VerifyReadResponse(
            wallet_address=clean_id,
            verified=result["verified"],
            on_chain_hash=result.get("on_chain_hash"),
            expected_hash=expected_hash,
            tx_hash=result.get("tx_hash"),
            network=result.get("network", "Sepolia"),
            explorer_url=result.get("explorer_url"),
            timestamp=result.get("timestamp"),
            message=result.get("message")
        )


# Global singleton instance
orchestrator = RiskOrchestrator()
