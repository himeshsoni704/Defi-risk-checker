"""
Explainable AI (XAI) Layer for Quantum Machine Learning DeFi Risk Scoring.
Uses shap.KernelExplainer to treat the Quantum QSVC as a black-box model and compute
exact per-feature attributions to the overall risk score.
Includes intelligent multi-tier caching (in-memory + disk JSON) for instant response times.
"""

import os
import json
import hashlib
import numpy as np
import pandas as pd
import shap
from typing import Dict, Any, Optional, Union
import sys

# Ensure quantum-ml path is accessible
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from qml_model import QuantumRiskModel, FEATURE_NAMES

CACHE_PATH = os.path.join(os.path.dirname(current_dir), "data", "cached_explanations.json")

# Friendly display keys requested in spec
DISPLAY_FEATURE_MAP = {
    "repayment_history_score": "repayment_history",
    "high_risk_tx_count": "high_risk_tx",
    "wallet_age_days": "wallet_age",
    "balance_stability_score": "balance_stability"
}


class QuantumXAIExplainer:
    def __init__(self, qml_model: Optional[QuantumRiskModel] = None, cache_path: str = CACHE_PATH):
        self.qml_model = qml_model or QuantumRiskModel.load()
        self.cache_path = cache_path
        self.cache: Dict[str, Dict[str, Any]] = self._load_cache()
        self._explainer = None
        self._init_explainer()

    def _load_cache(self) -> Dict[str, Dict[str, Any]]:
        """Load persisted cache from disk if available."""
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Failed to load explanation cache ({e}), initializing empty.")
        return {}

    def _save_cache(self):
        """Persist cache to disk."""
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
        try:
            with open(self.cache_path, "w") as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save explanation cache: {e}")

    def _init_explainer(self):
        """
        Initialize shap.KernelExplainer with a compact background summary.
        Model function wraps predict_risk_score, returning continuous risk score (0-100).
        """
        # Compact 3-point background summary representing low, mid, and high credit profiles
        background_samples = np.array([
            [80.0, 1.0, 600.0, 80.0],   # Prime wallet
            [55.0, 4.0, 250.0, 50.0],   # Average wallet
            [30.0, 10.0, 60.0, 25.0]    # Risky wallet
        ])

        def model_predict_fn(X_raw):
            return self.qml_model.predict_risk_score(X_raw)

        self._explainer = shap.KernelExplainer(model_predict_fn, background_samples)
        self.base_value = float(np.round(self._explainer.expected_value, 1))

    @staticmethod
    def _compute_feature_hash(features: list) -> str:
        """Create a deterministic hash for given feature values."""
        features_str = ",".join(f"{float(x):.2f}" for x in features)
        return hashlib.sha256(features_str.encode()).hexdigest()[:16]

    def explain(
        self,
        features: Union[list, np.ndarray],
        wallet_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compute or retrieve SHAP explanations for the given wallet features.
        Returns dictionary with:
          - wallet_address
          - risk_score
          - decision ('approve' or 'deny')
          - base_risk_value
          - feature_contributions: {"repayment_history": +25.0, ...}
          - cached: bool
        """
        feat_list = [float(x) for x in features]
        feat_hash = self._compute_feature_hash(feat_list)
        
        # Check cache by wallet_address (if provided) or by feature hash
        cache_key = wallet_address.lower() if wallet_address else f"hash_{feat_hash}"
        if cache_key in self.cache:
            entry = dict(self.cache[cache_key])
            entry["cached"] = True
            return entry

        # Check if cache file on disk has this entry
        disk_cache = self._load_cache()
        if cache_key in disk_cache:
            self.cache.update(disk_cache)
            entry = dict(disk_cache[cache_key])
            entry["cached"] = True
            return entry

        # Compute risk score
        risk_score = float(self.qml_model.predict_risk_score(feat_list)[0])
        decision = self.qml_model.evaluate_decision(risk_score)

        # Compute SHAP values via KernelExplainer
        X_eval = np.array([feat_list])
        shap_vals = self._explainer.shap_values(X_eval, nsamples=24)
        
        if isinstance(shap_vals, list):
            vals = shap_vals[0][0]
        elif shap_vals.ndim == 2:
            vals = shap_vals[0]
        else:
            vals = shap_vals

        # Map to requested output structure:
        # e.g. {"repayment_history": +25, "high_risk_tx": +18, "wallet_age": +12, "balance_stability": -5}
        contributions = {}
        for original_name, val in zip(FEATURE_NAMES, vals):
            friendly_name = DISPLAY_FEATURE_MAP.get(original_name, original_name)
            contributions[friendly_name] = round(float(val), 1)

        result = {
            "wallet_address": wallet_address or "custom_features",
            "risk_score": risk_score,
            "decision": decision,
            "base_risk_value": self.base_value,
            "feature_contributions": contributions,
            "input_features": {
                DISPLAY_FEATURE_MAP.get(name, name): feat_list[i]
                for i, name in enumerate(FEATURE_NAMES)
            }
        }

        # Store in cache
        self.cache[cache_key] = result
        if wallet_address:
            # Also cache by feature hash
            self.cache[f"hash_{feat_hash}"] = result
        self._save_cache()

        result["cached"] = False
        return result


def precompute_dataset_explanations(max_wallets: int = 150):
    """Precompute explanations for synthetic wallets to ensure sub-millisecond API responses."""
    print("Loading synthetic wallets dataset...")
    df_path = os.path.join(os.path.dirname(current_dir), "data", "synthetic_wallets.csv")
    df = pd.read_csv(df_path)
    
    explainer = QuantumXAIExplainer()
    print(f"Precomputing explanations for {min(len(df), max_wallets)} wallets...")
    
    count = 0
    for idx, row in df.head(max_wallets).iterrows():
        wallet_addr = row["wallet_address"]
        feats = [
            row["repayment_history_score"],
            row["high_risk_tx_count"],
            row["wallet_age_days"],
            row["balance_stability_score"]
        ]
        if wallet_addr.lower() not in explainer.cache:
            res = explainer.explain(feats, wallet_address=wallet_addr)
            count += 1
            if count % 10 == 0:
                print(f"Precomputed {count} explanations...")

    print(f"Done! {count} new explanations added to cache ({len(explainer.cache)} total in cache).")


if __name__ == "__main__":
    explainer = QuantumXAIExplainer()
    sample_safe = [85.0, 1.0, 650.0, 85.0]
    exp = explainer.explain(sample_safe, wallet_address="0x71C...DemoSafe")
    print("\nSample Safe Wallet Explanation:")
    print(json.dumps(exp, indent=2))
