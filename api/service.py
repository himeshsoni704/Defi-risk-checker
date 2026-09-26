"""
Core Orchestration Service for DeFi Risk Checker (v2.0).
Pipeline:
  WALLET → Feature Extraction
         → QSVC (Quantum ML)
         → SHAP (XAI)
         → XAI Auditor (Faithfulness · Stability · Sensitivity)
         → Canonical Record (wallet + model version + score + explanation + audit)
         → Keccak256
         → Blockchain

Blockchain now commits to the *entire* decision, not just wallet+score.
"""

import os
import sys
import time
import json
import pandas as pd
from typing import Dict, Any, Optional, List
from eth_account import Account
from web3 import Web3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

QML_DIR = os.path.join(BASE_DIR, "quantum-ml")
CONTRACTS_DIR = os.path.join(BASE_DIR, "contracts")
for p in [QML_DIR, CONTRACTS_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

from qml_model import QuantumRiskModel, FEATURE_NAMES
from xai_explainer import QuantumXAIExplainer
from xai_auditor import XAIAuditor
from llm_explainer import LLMRiskExplainer
from web3_service import Web3Service, build_canonical_record, compute_canonical_hash
from api.models import (
    ScoreRequest, ScoreResponse, ExplainResponse,
    VerifyWriteResponse, VerifyReadResponse, XAIAuditReport, LLMExplanation
)

DATA_PATH = os.path.join(BASE_DIR, "data", "synthetic_wallets.csv")
STORE_PATH = os.path.join(BASE_DIR, "data", "decisions_store.json")
COMPARISON_PATH = os.path.join(BASE_DIR, "quantum-ml", "artifacts", "model_comparison.json")

# Default feature values when nothing is known about the wallet
_DEFAULTS: Dict[str, Any] = {
    "wallet_age_days": 280,
    "transaction_count": 85,
    "avg_transaction_value": 2.0,
    "repayment_ratio": 0.65,
    "liquidation_count": 0,
    "borrow_count": 10,
    "high_risk_tx_count": 2,
    "protocol_count": 4,
    "balance_stability": 60.0,
    "failed_transactions": 1,
    "large_tx_ratio": 0.08,
    "historical_default": 0,
}


class RiskOrchestrator:
    def __init__(self):
        print("[Orchestrator] Initializing QSVC model...")
        self.qml_model = QuantumRiskModel.load()

        print("[Orchestrator] Initializing XAI Explainer...")
        self.xai_explainer = QuantumXAIExplainer(qml_model=self.qml_model)

        print("[Orchestrator] Initializing XAI Auditor...")
        self.xai_auditor = XAIAuditor(qml_model=self.qml_model, explainer=self.xai_explainer)

        print("[Orchestrator] Initializing LLM Explainer (Gemini)...")
        self.llm_explainer = LLMRiskExplainer()

        print("[Orchestrator] Initializing Web3 Service...")
        self.web3_service = Web3Service()

        self.dataset = self._load_dataset()
        self.decisions_store: Dict[str, Dict[str, Any]] = self._load_decisions_store()
        self._comparison_cache: Optional[Dict[str, Any]] = self._load_comparison()
        print("[Orchestrator] System ready.")

    # ── Dataset helpers ──────────────────────────────────────────────

    def _load_dataset(self) -> pd.DataFrame:
        if os.path.exists(DATA_PATH):
            return pd.read_csv(DATA_PATH)
        return pd.DataFrame()

    def _load_decisions_store(self) -> Dict[str, Dict[str, Any]]:
        if os.path.exists(STORE_PATH):
            try:
                with open(STORE_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_decisions_store(self):
        os.makedirs(os.path.dirname(STORE_PATH), exist_ok=True)
        try:
            with open(STORE_PATH, "w") as f:
                json.dump(self.decisions_store, f, indent=2)
        except Exception as e:
            print(f"[Orchestrator] Warning: Could not save decisions store: {e}")

    def _load_comparison(self) -> Optional[Dict[str, Any]]:
        if os.path.exists(COMPARISON_PATH):
            try:
                with open(COMPARISON_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def get_wallet_from_dataset(self, wallet_address: str) -> Optional[Dict[str, Any]]:
        if self.dataset.empty:
            return None
        match = self.dataset[self.dataset["wallet_address"].str.lower() == wallet_address.lower()]
        if match.empty:
            return None
        row = match.iloc[0]
        return {feat: (float(row[feat]) if feat in row else _DEFAULTS[feat]) for feat in FEATURE_NAMES}

    def list_sample_wallets(self, limit: int = 10) -> List[Dict[str, Any]]:
        if self.dataset.empty:
            return []
        # Split the requested count across both classes so every limit works
        # (previously odd limits dropped a wallet and limit=1 returned none).
        n_safe = (max(limit, 0) + 1) // 2
        n_risky = max(limit, 0) // 2
        safe = self.dataset[self.dataset["label"] == 0].head(n_safe)
        risky = self.dataset[self.dataset["label"] == 1].head(n_risky)
        combined = pd.concat([safe, risky])
        return combined[["wallet_address", "label"] + FEATURE_NAMES].to_dict(orient="records")

    def get_model_comparison(self) -> Dict[str, Any]:
        """Return the model comparison table (QSVC vs XGBoost vs Classical SVM)."""
        if self._comparison_cache:
            return self._comparison_cache
        return {
            "note": "Classical baseline not yet trained. Run `python quantum-ml/classical_baseline.py` to generate.",
            "QSVC (Quantum)": self.qml_model.metadata,
        }

    # ── Features from request ────────────────────────────────────────

    def _resolve_features(self, req: ScoreRequest, wallet_addr: str) -> Dict[str, Any]:
        """Extract a 12-feature dict from the request, dataset, or defaults."""
        if req.features:
            raw = req.features.model_dump(exclude_none=True)
            # Handle legacy field names
            if "repayment_history_score" in raw and "repayment_ratio" not in raw:
                raw["repayment_ratio"] = raw.pop("repayment_history_score") / 100.0
            if "balance_stability_score" in raw and "balance_stability" not in raw:
                raw["balance_stability"] = raw.pop("balance_stability_score")
            return {feat: raw.get(feat, _DEFAULTS[feat]) for feat in FEATURE_NAMES}

        db = self.get_wallet_from_dataset(wallet_addr)
        if db:
            return {feat: db.get(feat, _DEFAULTS[feat]) for feat in FEATURE_NAMES}

        return dict(_DEFAULTS)

    def _features_to_vector(self, features_dict: Dict[str, Any]) -> list:
        return [float(features_dict[f]) for f in FEATURE_NAMES]

    # ── Core pipeline ────────────────────────────────────────────────

    def score(self, req: ScoreRequest) -> ScoreResponse:
        """
        Full pipeline: QML → SHAP → XAI Audit → Canonical Record → Keccak256.
        Returns a ScoreResponse containing the risk score, audit report,
        canonical record, and decision hash ready for on-chain anchoring.
        """
        wallet_addr = req.wallet_address or Account.create().address
        features_dict = self._resolve_features(req, wallet_addr)
        feature_vector = self._features_to_vector(features_dict)

        # ── Step 1: Quantum ML inference ─────────────────────────────
        risk_score = float(self.qml_model.predict_risk_score(feature_vector)[0])
        decision = self.qml_model.evaluate_decision(risk_score).upper()
        # Map to APPROVED / DENIED for clearer display
        decision_label = "DENIED" if decision == "DENY" else "APPROVED"

        # ── Step 2: SHAP explanation ──────────────────────────────────
        explanation = self.xai_explainer.explain(feature_vector, wallet_address=wallet_addr)

        # ── Step 3: XAI Audit ─────────────────────────────────────────
        audit_report = self.xai_auditor.audit(feature_vector, explanation)

        # ── Step 4: Model version record ──────────────────────────────
        model_ver = self.qml_model.version_record()

        # ── Step 5: Canonical record + Keccak256 ─────────────────────
        now = int(time.time())
        canonical = build_canonical_record(
            wallet_id=wallet_addr,
            model_version_record=model_ver,
            risk_score=risk_score,
            decision=decision_label,
            features=features_dict,
            explanation=explanation,
            audit=audit_report,
            timestamp=now,
        )
        decision_hash = compute_canonical_hash(canonical)

        # ── Step 6: Persist ───────────────────────────────────────────
        stored = {
            "wallet_address": wallet_addr,
            "risk_score": risk_score,
            "decision": decision_label,
            "decision_hash": decision_hash,
            "features": features_dict,
            "explanation": explanation,
            "audit": audit_report,
            "model_version": model_ver,
            "canonical_record": canonical,
            "timestamp": now,
        }
        self.decisions_store[wallet_addr.lower()] = stored
        self._save_decisions_store()

        # Wrap audit for pydantic
        audit_pydantic = XAIAuditReport(
            faithfulness=audit_report["faithfulness"],
            stability=audit_report["stability"],
            sensitivity=audit_report["sensitivity"],
            overall_verdict=audit_report["overall_verdict"],
            overall_description=audit_report["overall_description"],
            summary_lines=audit_report["summary_lines"],
        )

        return ScoreResponse(
            wallet_address=wallet_addr,
            risk_score=risk_score,
            decision=decision_label,
            decision_hash=decision_hash,
            features=features_dict,
            model_version=model_ver,
            audit=audit_pydantic,
            classical_baseline=self.get_model_comparison(),
            canonical_record=canonical,
            timestamp=now,
        )

    def explain(self, wallet_id: str, include_llm: bool = False) -> ExplainResponse:
        """Return SHAP attribution + audit report for a previously scored wallet."""
        clean_id = wallet_id.strip()
        stored = self.decisions_store.get(clean_id.lower())

        if stored:
            exp = stored["explanation"]
            audit = stored.get("audit", {})
            audit_pydantic = XAIAuditReport(
                faithfulness=audit.get("faithfulness", {}),
                stability=audit.get("stability", {}),
                sensitivity=audit.get("sensitivity", {}),
                overall_verdict=audit.get("overall_verdict", "UNKNOWN"),
                overall_description=audit.get("overall_description", ""),
                summary_lines=audit.get("summary_lines", []),
            )
            
            llm_exp = None
            if include_llm:
                # Ask Gemini to generate the text explanation
                llm_result = self.llm_explainer.generate_explanation(exp, audit)
                # The explainer returns its own LLMExplanation class; re-wrap it in
                # the API schema's model so ExplainResponse validation accepts it.
                llm_exp = LLMExplanation(**llm_result.model_dump())

            return ExplainResponse(
                wallet_address=stored["wallet_address"],
                risk_score=stored["risk_score"],
                decision=stored["decision"],
                base_risk_value=exp["base_risk_value"],
                feature_contributions=exp["feature_contributions"],
                input_features=exp["input_features"],
                audit=audit_pydantic,
                llm_explanation=llm_exp,
                cached=True,
            )

        # Auto-score if in dataset
        db_wallet = self.get_wallet_from_dataset(clean_id)
        if db_wallet:
            self.score(ScoreRequest(wallet_address=clean_id))
            return self.explain(clean_id, include_llm)

        # Fallback: score with defaults
        self.score(ScoreRequest(wallet_address=clean_id))
        return self.explain(clean_id, include_llm)

    def get_audit(self, wallet_id: str) -> Dict[str, Any]:
        """Return the standalone XAI audit report for a wallet."""
        clean_id = wallet_id.strip().lower()
        stored = self.decisions_store.get(clean_id)
        if stored and "audit" in stored:
            return stored["audit"]
        # Score first
        self.score(ScoreRequest(wallet_address=wallet_id.strip()))
        return self.decisions_store[clean_id]["audit"]

    def verify_write(self, wallet_id: str) -> VerifyWriteResponse:
        """Anchor canonical decision hash on-chain."""
        clean_id = wallet_id.strip()
        stored = self.decisions_store.get(clean_id.lower())
        if not stored:
            self.score(ScoreRequest(wallet_address=clean_id))
            stored = self.decisions_store.get(clean_id.lower())

        receipt = self.web3_service.record_decision_on_chain(
            wallet_address=clean_id,
            decision_hash=stored["decision_hash"],
            canonical_record=stored.get("canonical_record"),
        )
        stored["on_chain"] = receipt
        self._save_decisions_store()

        return VerifyWriteResponse(
            wallet_address=clean_id,
            decision_hash=stored["decision_hash"],
            tx_hash=receipt["tx_hash"],
            block_number=receipt["block_number"],
            network=receipt["network"],
            status=receipt["status"],
            explorer_url=receipt["explorer_url"],
            timestamp=receipt["timestamp"],
        )

    def verify_read(self, wallet_id: str) -> VerifyReadResponse:
        """Read on-chain hash and verify it matches the stored canonical decision."""
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
            canonical_record=result.get("canonical_record"),
            message=result.get("message"),
        )


# Global singleton (loaded once at startup)
orchestrator = RiskOrchestrator()
