"""
Classical ML Baseline for DeFi Risk Scoring.
Trains XGBoost on the same 12-feature dataset used by QSVC.
Provides head-to-head performance comparison table so judges can
evaluate whether the quantum component is justified.
"""

import os
import json
import time
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Union
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, roc_auc_score, f1_score,
    classification_report,
)
from sklearn.svm import SVC  # classical SVM baseline

try:
    from xgboost import XGBClassifier
    _XGBOOST_AVAILABLE = True
except ImportError:
    _XGBOOST_AVAILABLE = False
    print("[BaselineModel] xgboost not installed; XGBoost baseline will be skipped.")

import sys
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from dataset import FEATURE_NAMES

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
CLASSICAL_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "classical_model.pkl")
CLASSICAL_SCALER_PATH = os.path.join(ARTIFACTS_DIR, "classical_scaler.pkl")
CLASSICAL_METADATA_PATH = os.path.join(ARTIFACTS_DIR, "classical_metadata.json")
COMPARISON_PATH = os.path.join(ARTIFACTS_DIR, "model_comparison.json")


class ClassicalRiskModel:
    """
    XGBoost (or classical SVM fallback) trained on all 12 features.
    Exposes the same predict_risk_score / evaluate_decision interface as QuantumRiskModel.
    """

    def __init__(self, model=None, scaler=None, metadata: dict = None):
        self.model = model
        self.scaler = scaler
        self.metadata = metadata or {}
        self.feature_names = FEATURE_NAMES

    @classmethod
    def load(cls) -> "ClassicalRiskModel":
        if not os.path.exists(CLASSICAL_MODEL_PATH):
            raise FileNotFoundError(
                f"Classical model artifacts not found in {ARTIFACTS_DIR}. "
                "Run train_classical_baseline() first."
            )
        with open(CLASSICAL_MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        with open(CLASSICAL_SCALER_PATH, "rb") as f:
            scaler = pickle.load(f)
        metadata = {}
        if os.path.exists(CLASSICAL_METADATA_PATH):
            with open(CLASSICAL_METADATA_PATH, "r") as f:
                metadata = json.load(f)
        return cls(model=model, scaler=scaler, metadata=metadata)

    def save(self):
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)
        with open(CLASSICAL_MODEL_PATH, "wb") as f:
            pickle.dump(self.model, f)
        with open(CLASSICAL_SCALER_PATH, "wb") as f:
            pickle.dump(self.scaler, f)
        with open(CLASSICAL_METADATA_PATH, "w") as f:
            json.dump(self.metadata, f, indent=2)
        print(f"Classical model artifacts saved to {ARTIFACTS_DIR}")

    def preprocess_features(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        if isinstance(X, pd.DataFrame):
            X_arr = X[self.feature_names].values.astype(float)
        else:
            X_arr = np.array(X, dtype=float)
            if X_arr.ndim == 1:
                X_arr = X_arr.reshape(1, -1)
        return self.scaler.transform(X_arr)

    def predict_proba(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        X_scaled = self.preprocess_features(X)
        return self.model.predict_proba(X_scaled)

    def predict_risk_score(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        probs = self.predict_proba(X)
        return np.round(probs[:, 1] * 100.0, 1)

    def evaluate_decision(self, risk_score: float, threshold: float = 50.0) -> str:
        return "deny" if risk_score >= threshold else "approve"


def train_classical_baseline(
    csv_path: str = "data/synthetic_wallets.csv",
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Train classical ML baselines (XGBoost + Classical SVM) on the full 12-feature dataset.
    Returns a comparison dict that is also saved to artifacts/model_comparison.json.
    """
    print(f"Loading full dataset from {csv_path}...")
    df = pd.read_csv(csv_path)

    X = df[FEATURE_NAMES].values.astype(float)
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    results = {}

    # ── 1. XGBoost ────────────────────────────────────────────────────
    if _XGBOOST_AVAILABLE:
        print("Training XGBoost...")
        t0 = time.time()
        xgb = XGBClassifier(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=random_state,
        )
        xgb.fit(X_train_scaled, y_train)
        t_xgb = round(time.time() - t0, 2)

        xgb_preds = xgb.predict(X_test_scaled)
        xgb_probs = xgb.predict_proba(X_test_scaled)[:, 1]
        results["XGBoost"] = {
            "accuracy": round(float(accuracy_score(y_test, xgb_preds)), 4),
            "f1": round(float(f1_score(y_test, xgb_preds)), 4),
            "auc": round(float(roc_auc_score(y_test, xgb_probs)), 4),
            "inference_ms_per_sample": round(t_xgb / len(X_test) * 1000, 3),
            "n_features": len(FEATURE_NAMES),
            "notes": "All 12 features, gradient boosted trees",
        }

        # Save best classical model (XGBoost preferred)
        cm = ClassicalRiskModel(model=xgb, scaler=scaler, metadata={
            "model_type": "XGBoost",
            "n_estimators": 150,
            "n_features": len(FEATURE_NAMES),
            "feature_names": FEATURE_NAMES,
            "test_accuracy": results["XGBoost"]["accuracy"],
            "test_auc": results["XGBoost"]["auc"],
            "test_f1": results["XGBoost"]["f1"],
            "trained_at": int(time.time()),
        })
        cm.save()
        print(f"XGBoost — Acc: {results['XGBoost']['accuracy']}  "
              f"F1: {results['XGBoost']['f1']}  AUC: {results['XGBoost']['auc']}")

    # ── 2. Classical SVM ──────────────────────────────────────────────
    print("Training classical SVM (RBF kernel)...")
    t0 = time.time()
    csvm = SVC(kernel="rbf", probability=True, C=10.0, gamma="scale", random_state=random_state)
    csvm.fit(X_train_scaled, y_train)
    t_csvm = round(time.time() - t0, 2)

    csvm_preds = csvm.predict(X_test_scaled)
    csvm_probs = csvm.predict_proba(X_test_scaled)[:, 1]
    results["Classical SVM"] = {
        "accuracy": round(float(accuracy_score(y_test, csvm_preds)), 4),
        "f1": round(float(f1_score(y_test, csvm_preds)), 4),
        "auc": round(float(roc_auc_score(y_test, csvm_probs)), 4),
        "inference_ms_per_sample": round(t_csvm / len(X_test) * 1000, 3),
        "n_features": len(FEATURE_NAMES),
        "notes": "RBF kernel SVM, all 12 features",
    }
    print(f"Classical SVM — Acc: {results['Classical SVM']['accuracy']}  "
          f"F1: {results['Classical SVM']['f1']}  AUC: {results['Classical SVM']['auc']}")

    # ── 3. Placeholder for QSVC (filled in after QML training) ───────
    qml_meta_path = os.path.join(ARTIFACTS_DIR, "metadata.json")
    if os.path.exists(qml_meta_path):
        with open(qml_meta_path, "r") as f:
            qml_meta = json.load(f)
        results["QSVC (Quantum)"] = {
            "accuracy": round(qml_meta.get("test_accuracy", 0.0), 4),
            "f1": round(qml_meta.get("test_f1", 0.0), 4),
            "auc": round(qml_meta.get("test_auc", 0.0), 4),
            "inference_ms_per_sample": "N/A (simulation)",
            "n_features": len(qml_meta.get("qml_feature_names", [])),
            "notes": f"ZZFeatureMap, {qml_meta.get('n_qubits', 6)} qubits, Aer statevector",
        }

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    with open(COMPARISON_PATH, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nComparison saved to {COMPARISON_PATH}")

    return results


def print_comparison_table(results: Dict[str, Any]):
    """Pretty-print the model comparison table."""
    print("\n" + "=" * 76)
    print(f"{'Model':<22} {'Accuracy':>10} {'F1':>8} {'AUC':>8} {'Inference':>16}")
    print("-" * 76)
    for model_name, metrics in results.items():
        acc = metrics.get("accuracy", "—")
        f1 = metrics.get("f1", "—")
        auc = metrics.get("auc", "—")
        inf = metrics.get("inference_ms_per_sample", "—")
        if isinstance(inf, float):
            inf = f"{inf:.3f} ms/s"
        print(f"{model_name:<22} {str(acc):>10} {str(f1):>8} {str(auc):>8} {str(inf):>16}")
    print("=" * 76 + "\n")


if __name__ == "__main__":
    results = train_classical_baseline()
    print_comparison_table(results)
