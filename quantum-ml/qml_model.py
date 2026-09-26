"""
Quantum Machine Learning (QML) Model for DeFi Risk Scoring.
Uses Qiskit Machine Learning's QSVC with ZZFeatureMap and FidelityQuantumKernel.
Trained on Aer statevector simulation and serialized for fast zero-latency inference.
"""

import os
import pickle
import json
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any, Union
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
from qiskit.circuit.library import ZZFeatureMap
from qiskit_machine_learning.kernels import FidelityQuantumKernel
from qiskit_machine_learning.algorithms import QSVC


FEATURE_NAMES = [
    "repayment_history_score",
    "high_risk_tx_count",
    "wallet_age_days",
    "balance_stability_score"
]

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "qsvc_model.pkl")
SCALER_PATH = os.path.join(ARTIFACTS_DIR, "scaler.pkl")
METADATA_PATH = os.path.join(ARTIFACTS_DIR, "metadata.json")


class QuantumRiskModel:
    def __init__(self, model=None, scaler=None, metadata: dict = None):
        self.model = model
        self.scaler = scaler
        self.metadata = metadata or {}
        self.feature_names = FEATURE_NAMES
        
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

    def preprocess_features(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        """Scale raw wallet features to quantum circuit phase angles [0, pi]."""
        if isinstance(X, pd.DataFrame):
            X_arr = X[self.feature_names].values
        else:
            X_arr = np.array(X, dtype=float)
            if X_arr.ndim == 1:
                X_arr = X_arr.reshape(1, -1)
        return self.scaler.transform(X_arr)

    def predict_proba(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        """
        Returns probability of [safe, default/risk].
        Shape: (n_samples, 2)
        """
        X_scaled = self.preprocess_features(X)
        return self.model.predict_proba(X_scaled)

    def predict_risk_score(self, X: Union[np.ndarray, list, pd.DataFrame]) -> np.ndarray:
        """
        Predict continuous DeFi risk score from 0.0 to 100.0 (higher = riskier).
        Based on probability of default from Quantum Support Vector Classifier.
        """
        probs = self.predict_proba(X)
        # Default/risky is class index 1
        risk_scores = probs[:, 1] * 100.0
        return np.round(risk_scores, 1)

    def evaluate_decision(self, risk_score: float, threshold: float = 50.0) -> str:
        """
        Produce lending/risk decision based on threshold.
        risk_score >= 50.0 -> 'deny'
        risk_score < 50.0 -> 'approve'
        """
        return "deny" if risk_score >= threshold else "approve"


def train_and_save_qml_model(
    csv_path: str = "data/synthetic_wallets.csv",
    sample_size: int = 70,
    random_state: int = 42
) -> QuantumRiskModel:
    """
    Train QSVC with ZZFeatureMap and FidelityQuantumKernel on synthetic wallet data.
    Evaluates test metrics and saves artifacts.
    """
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    # Stratified sample for fast, robust quantum kernel computation
    df_0 = df[df["label"] == 0].sample(n=sample_size // 2, random_state=random_state)
    df_1 = df[df["label"] == 1].sample(n=sample_size // 2, random_state=random_state)
    df_sample = pd.concat([df_0, df_1]).sample(frac=1.0, random_state=random_state).reset_index(drop=True)
    
    X = df_sample[FEATURE_NAMES].values
    y = df_sample["label"].values
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=random_state, stratify=y
    )
    
    # Scale into phase angles [0, pi]
    scaler = MinMaxScaler(feature_range=(0.0, np.pi))
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"Configuring 4-qubit ZZFeatureMap and FidelityQuantumKernel...")
    feature_map = ZZFeatureMap(feature_dimension=4, reps=1, entanglement="linear")
    kernel = FidelityQuantumKernel(feature_map=feature_map)
    
    print(f"Training Quantum Support Vector Classifier (QSVC) on {len(X_train)} samples...")
    qsvc = QSVC(quantum_kernel=kernel, probability=True)
    qsvc.fit(X_train_scaled, y_train)
    
    # Evaluate
    test_preds = qsvc.predict(X_test_scaled)
    test_probs = qsvc.predict_proba(X_test_scaled)[:, 1]
    acc = float(accuracy_score(y_test, test_preds))
    auc = float(roc_auc_score(y_test, test_probs))
    
    print(f"Training Complete! Test Accuracy: {acc:.3f}, Test ROC-AUC: {auc:.3f}")
    
    metadata = {
        "model_type": "QSVC",
        "feature_map": "ZZFeatureMap (reps=1, entanglement=linear, 4 qubits)",
        "kernel": "FidelityQuantumKernel (Aer Statevector)",
        "feature_names": FEATURE_NAMES,
        "n_train_samples": len(X_train),
        "test_accuracy": acc,
        "test_auc": auc,
        "risk_threshold": 50.0
    }
    
    qml_model = QuantumRiskModel(model=qsvc, scaler=scaler, metadata=metadata)
    qml_model.save()
    return qml_model


if __name__ == "__main__":
    model = train_and_save_qml_model()
    # Test sample inference
    test_features = [85.0, 1, 600, 80.0]  # Safe profile
    score = model.predict_risk_score(test_features)[0]
    decision = model.evaluate_decision(score)
    print(f"Test Safe Profile -> Score: {score}/100, Decision: {decision}")
    
    test_features_risky = [25.0, 12, 45, 20.0]  # Risky profile
    score_risky = model.predict_risk_score(test_features_risky)[0]
    decision_risky = model.evaluate_decision(score_risky)
    print(f"Test Risky Profile -> Score: {score_risky}/100, Decision: {decision_risky}")
