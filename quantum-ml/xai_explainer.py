"""
Explainable AI (XAI) Layer for Quantum Machine Learning DeFi Risk Scoring.
Uses shap.KernelExplainer to treat the Quantum QSVC as a black-box model and compute
per-feature attributions for all 12 features.
Includes intelligent multi-tier caching (in-memory + disk JSON) for fast responses.
"""

import os
import json
import hashlib
import numpy as np
import pandas as pd
import shap
from typing import Dict, Any, Optional, Union
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from dataset import FEATURE_NAMES, DISPLAY_FEATURE_MAP
from qml_model import QuantumRiskModel, QML_FEATURES

CACHE_PATH = os.path.join(os.path.dirname(current_dir), "data", "cached_explanations.json")

# Bump this whenever the feature schema or explanation shape changes so that
# stale cached entries from an older version are never served.
CACHE_SCHEMA_VERSION = "2.0"
_CACHE_PREFIX = f"v{CACHE_SCHEMA_VERSION}:"


class QuantumXAIExplainer:
    """
    Wraps shap.KernelExplainer around the QSVC.
    The SHAP black-box function receives the 6 QML features; we then broadcast
    the attributions back to the full 12-feature display format.
    """

    def __init__(self, qml_model: Optional[QuantumRiskModel] = None, cache_path: str = CACHE_PATH):
        self.qml_model = qml_model or QuantumRiskModel.load()
        self.cache_path = cache_path
        self.cache: Dict[str, Dict[str, Any]] = self._load_cache()
        self._explainer = None
        self._init_explainer()

    def _load_cache(self) -> Dict[str, Dict[str, Any]]:
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Failed to load explanation cache ({e}), initializing empty.")
        return {}

    def _save_cache(self):
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
        try:
            with open(self.cache_path, "w") as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save explanation cache: {e}")

    def _init_explainer(self):
        """
        Initialize shap.KernelExplainer.
        Background represents low / mid / high risk profiles across QML_FEATURES.
        """
        # QML_FEATURES: repayment_ratio, high_risk_tx_count, wallet_age_days,
        #               balance_stability, liquidation_count, historical_default
        background_samples = np.array([
            [0.92, 1.0,  650.0, 80.0, 0.0, 0.0],   # Prime wallet
            [0.60, 5.0,  280.0, 52.0, 1.0, 0.0],   # Average wallet
            [0.18, 14.0,  35.0, 20.0, 5.0, 1.0],   # High-risk wallet
        ])

        def model_predict_fn(X_qml_raw):
            # X_qml_raw shape: (n_samples, 6) — QML features only
            return self.qml_model.predict_risk_score(X_qml_raw)

        self._explainer = shap.KernelExplainer(model_predict_fn, background_samples)
        self.base_value = float(np.round(self._explainer.expected_value, 1))

    @staticmethod
    def _compute_feature_hash(features: list) -> str:
        features_str = ",".join(f"{float(x):.4f}" for x in features)
        return hashlib.sha256(features_str.encode()).hexdigest()[:16]

    def explain(
        self,
        features: Union[list, np.ndarray],
        wallet_address: Optional[str] = None,
        force_recompute: bool = False,
    ) -> Dict[str, Any]:
        """
        Compute or retrieve SHAP explanations for the given 12-feature vector.

        Returns:
          wallet_address, risk_score, decision, base_risk_value,
          feature_contributions (all 12), input_features (all 12), cached
        """
        feat_list = [float(x) for x in features]
        feat_hash = self._compute_feature_hash(feat_list)
        cache_key = _CACHE_PREFIX + (wallet_address.lower() if wallet_address else f"hash_{feat_hash}")

        if not force_recompute:
            # In-memory cache hit
            if cache_key in self.cache:
                entry = dict(self.cache[cache_key])
                entry["cached"] = True
                return entry
            # Disk cache hit
            disk_cache = self._load_cache()
            if cache_key in disk_cache:
                self.cache.update(disk_cache)
                entry = dict(disk_cache[cache_key])
                entry["cached"] = True
                return entry

        # Extract QML-only features for SHAP
        qml_indices = [FEATURE_NAMES.index(f) for f in QML_FEATURES]
        feat_qml = [feat_list[i] for i in qml_indices]

        # Compute risk score via full model (passes QML features internally)
        risk_score = float(self.qml_model.predict_risk_score(feat_list)[0])
        decision = self.qml_model.evaluate_decision(risk_score)

        # SHAP on the 6-feature QML subspace
        X_eval = np.array([feat_qml])
        shap_vals = self._explainer.shap_values(X_eval, nsamples=32)

        if isinstance(shap_vals, list):
            vals_qml = shap_vals[0][0]
        elif shap_vals.ndim == 2:
            vals_qml = shap_vals[0]
        else:
            vals_qml = shap_vals

        # Build contributions for ALL 12 features
        # QML features get their SHAP values; remaining 8 features get 0.0
        qml_contribs = {
            DISPLAY_FEATURE_MAP.get(QML_FEATURES[i], QML_FEATURES[i]): round(float(vals_qml[i]), 1)
            for i in range(len(QML_FEATURES))
        }
        # Non-QML features contribute 0 to this model's output (not in circuit)
        non_qml_contribs = {
            DISPLAY_FEATURE_MAP.get(name, name): 0.0
            for name in FEATURE_NAMES
            if name not in QML_FEATURES
        }
        contributions = {**qml_contribs, **non_qml_contribs}

        result = {
            "wallet_address": wallet_address or "custom_features",
            "risk_score": risk_score,
            "decision": decision,
            "base_risk_value": self.base_value,
            "feature_contributions": contributions,
            "input_features": {
                DISPLAY_FEATURE_MAP.get(name, name): feat_list[i]
                for i, name in enumerate(FEATURE_NAMES)
            },
        }

        # Cache
        self.cache[cache_key] = result
        if wallet_address:
            self.cache[_CACHE_PREFIX + f"hash_{feat_hash}"] = result
        self._save_cache()

        result["cached"] = False
        return result


def precompute_dataset_explanations(max_wallets: int = 100):
    """Pre-warm the explanation cache for the first max_wallets in the dataset."""
    print("Loading synthetic wallets dataset...")
    df_path = os.path.join(os.path.dirname(current_dir), "data", "synthetic_wallets.csv")
    df = pd.read_csv(df_path)

    explainer = QuantumXAIExplainer()
    print(f"Precomputing explanations for {min(len(df), max_wallets)} wallets...")

    count = 0
    for idx, row in df.head(max_wallets).iterrows():
        wallet_addr = row["wallet_address"]
        feats = [float(row[f]) for f in FEATURE_NAMES]
        if wallet_addr.lower() not in explainer.cache:
            explainer.explain(feats, wallet_address=wallet_addr)
            count += 1
            if count % 10 == 0:
                print(f"  Precomputed {count} explanations...")

    print(f"Done! {count} new explanations cached ({len(explainer.cache)} total).")


if __name__ == "__main__":
    explainer = QuantumXAIExplainer()
    # Prime wallet profile (all 12 features)
    sample_safe = [650, 120, 1.5, 0.91, 0, 10, 1, 12, 80, 2, 0.05, 0]
    exp = explainer.explain(sample_safe, wallet_address="0x71C...DemoSafe")
    print("\nSample Safe Wallet Explanation:")
    print(json.dumps(exp, indent=2))
