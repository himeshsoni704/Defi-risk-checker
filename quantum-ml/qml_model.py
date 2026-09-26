"""
Quantum Machine Learning (QML) Model for DeFi Risk Scoring.
Uses Qiskit Machine Learning's QSVC with ZZFeatureMap and FidelityQuantumKernel.
Trained on Aer statevector simulation and serialized for fast zero-latency inference.

Model versioning support: every artifact includes model_id, model_version,
dataset_version, feature_schema_version and training timestamp — so old blockchain
records remain independently verifiable even after retraining.
"""

import os
import pickle
import json
import time
import hashlib
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any, Union
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, f1_score
from qiskit.circuit.library import ZZFeatureMap
from qiskit_machine_learning.kernels import FidelityStatevectorKernel
from qiskit_machine_learning.algorithms import QSVC

from dataset import FEATURE_NAMES, DISPLAY_FEATURE_MAP  # noqa: F401 (re-export)

# ── Schema & versioning constants ────────────────────────────────────────────
MODEL_ID = "QSVC-ZZFeatureMap"
MODEL_VERSION = "2.0"            # bump when architecture changes
DATASET_VERSION = "2.0"          # bump when feature set changes
FEATURE_SCHEMA_VERSION = "2.0"   # bump when FEATURE_NAMES changes

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "qsvc_model.pkl")
SCALER_PATH = os.path.join(ARTIFACTS_DIR, "scaler.pkl")
METADATA_PATH = os.path.join(ARTIFACTS_DIR, "metadata.json")

# Number of features to pass into the quantum circuit.
# ZZFeatureMap dimension must equal len(QML_FEATURES).
# We PCA-project / select the top-N most discriminative features for the circuit
# to keep simulation tractable; all 12 remain available for SHAP.
N_QUBITS = 6
QML_FEATURES = [
    "repayment_ratio",
    "high_risk_tx_count",
    "wallet_age_days",
    "balance_stability",
    "liquidation_count",
    "historical_default",
]


class QuantumRiskModel:
    """Wraps a pretrained QSVC with preprocessing, metadata, and model-version tracking."""

    def __init__(self, model=None, scaler=None, metadata: dict = None):
        self.model = model
        self.scaler = scaler
        self.metadata = metadata or {}
        self.feature_names = FEATURE_NAMES          # all 12 features
        self.qml_feature_names = QML_FEATURES        # 6 features fed to the circuit

    @classmethod
    def load(cls) -> "QuantumRiskModel":
        """Load pretrained model and scaler from artifacts directory."""
        if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
            raise FileNotFoundError(
                f"Model artifacts not found in {ARTIFACTS_DIR}. Please run training first."
            )

        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        with open(SCALER_PATH, "rb") as f:
            scaler = pickle.load(f)

        metadata = {}
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, "r") as f:
                metadata = json.load(f)

        return cls(model=model, scaler=scaler, metadata=metadata)

    def save(self):
        """Save model, scaler, and metadata to artifacts directory."""
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(self.model, f)
        with open(SCALER_PATH, "wb") as f:
            pickle.dump(self.scaler, f)
        with open(METADATA_PATH, "w") as f:
            json.dump(self.metadata, f, indent=2)
        print(f"Artifacts successfully saved to {ARTIFACTS_DIR}")

    # ── Feature helpers ──────────────────────────────────────────────

    def _extract_qml_features(self, X_raw: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        """Select the 6 QML features from a full 12-feature input."""
        if isinstance(X_raw, pd.DataFrame):
            return X_raw[self.qml_feature_names].values.astype(float)
        arr = np.array(X_raw, dtype=float)
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        # If the caller already passed only the QML feature columns
        # (e.g. the SHAP explainer works on the 6-feature subspace),
        # use them as-is instead of re-indexing a full 12-feature vector.
        if arr.shape[1] == len(QML_FEATURES):
            return arr
        # Map by position: indices of QML_FEATURES within FEATURE_NAMES
        indices = [FEATURE_NAMES.index(f) for f in QML_FEATURES]
        return arr[:, indices]

    def preprocess_features(self, X_raw: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        """Scale QML features to quantum circuit phase angles [0, π]."""
        X_qml = self._extract_qml_features(X_raw)
        return self.scaler.transform(X_qml)

    # ── Inference ────────────────────────────────────────────────────

    def predict_proba(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        """Returns probability array of shape (n_samples, 2): [P(safe), P(risky)]."""
        X_scaled = self.preprocess_features(X)
        return self.model.predict_proba(X_scaled)

    def predict_risk_score(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        """
        Continuous DeFi risk score 0.0–100.0 (higher = riskier).
        Derived from QSVC P(default) × 100.
        """
        probs = self.predict_proba(X)
        return np.round(probs[:, 1] * 100.0, 1)

    def evaluate_decision(self, risk_score: float, threshold: float = 50.0) -> str:
        """'deny' if risk_score ≥ threshold, else 'approve'."""
        return "deny" if risk_score >= threshold else "approve"

    # ── Version record (for blockchain commits) ──────────────────────

    def version_record(self) -> dict:
        """
        Returns a compact dict capturing model provenance for blockchain hashing.
        This is included verbatim in the canonical decision record.
        """
        return {
            "model_id": self.metadata.get("model_id", MODEL_ID),
            "model_version": self.metadata.get("model_version", MODEL_VERSION),
            "dataset_version": self.metadata.get("dataset_version", DATASET_VERSION),
            "feature_schema_version": self.metadata.get("feature_schema_version", FEATURE_SCHEMA_VERSION),
            "qml_features": self.qml_feature_names,
            "n_qubits": N_QUBITS,
            "trained_at": self.metadata.get("trained_at", "unknown"),
        }


# ── Training ─────────────────────────────────────────────────────────────────

def train_and_save_qml_model(
    csv_path: str = "data/synthetic_wallets.csv",
    sample_size: int = 80,
    random_state: int = 42,
) -> QuantumRiskModel:
    """
    Train QSVC with 6-qubit ZZFeatureMap on the expanded 12-feature dataset.
    Evaluates test metrics and saves artifacts with full model version metadata.
    """
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)

    # Stratified sample for manageable quantum kernel computation
    n_each = sample_size // 2
    df_0 = df[df["label"] == 0].sample(n=n_each, random_state=random_state)
    df_1 = df[df["label"] == 1].sample(n=n_each, random_state=random_state)
    df_sample = pd.concat([df_0, df_1]).sample(frac=1.0, random_state=random_state).reset_index(drop=True)

    X_qml = df_sample[QML_FEATURES].values
    y = df_sample["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X_qml, y, test_size=0.25, random_state=random_state, stratify=y
    )

    # Scale to [0, π] for quantum phase encoding
    scaler = MinMaxScaler(feature_range=(0.0, np.pi))
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print(f"Configuring {N_QUBITS}-qubit ZZFeatureMap and FidelityStatevectorKernel...")
    feature_map = ZZFeatureMap(feature_dimension=N_QUBITS, reps=1, entanglement="linear")
    # FidelityStatevectorKernel simulates the statevector directly (with caching)
    # instead of rebuilding/transpiling a circuit on every call. It computes the
    # same fidelity kernel but is orders of magnitude faster on small qubit counts.
    kernel = FidelityStatevectorKernel(feature_map=feature_map)

    print(f"Training QSVC on {len(X_train)} samples (this may take a few minutes)...")
    qsvc = QSVC(quantum_kernel=kernel, probability=True)
    qsvc.fit(X_train_scaled, y_train)

    # Evaluation
    test_preds = qsvc.predict(X_test_scaled)
    test_probs = qsvc.predict_proba(X_test_scaled)[:, 1]
    acc = float(accuracy_score(y_test, test_preds))
    auc = float(roc_auc_score(y_test, test_probs))
    f1 = float(f1_score(y_test, test_preds))

    print(f"QSVC - Acc: {acc:.3f}  F1: {f1:.3f}  AUC: {auc:.3f}")

    trained_at = int(time.time())
    metadata = {
        "model_id": MODEL_ID,
        "model_version": MODEL_VERSION,
        "dataset_version": DATASET_VERSION,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "model_type": "QSVC",
        "feature_map": f"ZZFeatureMap (reps=1, entanglement=linear, {N_QUBITS} qubits)",
        "kernel": "FidelityStatevectorKernel (Statevector simulation)",
        "all_feature_names": FEATURE_NAMES,
        "qml_feature_names": QML_FEATURES,
        "n_qubits": N_QUBITS,
        "n_train_samples": len(X_train),
        "test_accuracy": acc,
        "test_auc": auc,
        "test_f1": f1,
        "risk_threshold": 50.0,
        "trained_at": trained_at,
    }

    qml_model = QuantumRiskModel(model=qsvc, scaler=scaler, metadata=metadata)
    qml_model.save()
    return qml_model


if __name__ == "__main__":
    model = train_and_save_qml_model()
    # Quick smoke tests
    safe_vec = [650, 120, 1.5, 0.91, 0, 8, 1, 10, 78, 2, 0.05, 0]
    risky_vec = [30, 15, 5.2, 0.22, 4, 35, 12, 2, 22, 11, 0.62, 1]
    s = model.predict_risk_score(safe_vec)[0]
    r = model.predict_risk_score(risky_vec)[0]
    print(f"Safe profile -> Score: {s}/100  Decision: {model.evaluate_decision(s)}")
    print(f"Risky profile -> Score: {r}/100  Decision: {model.evaluate_decision(r)}")
