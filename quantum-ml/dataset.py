"""
Synthetic Wallet Dataset Generator for DeFi Risk Checker
Generates synthetic wallet on-chain risk features and labels.
"""

import os
import numpy as np
import pandas as pd
from eth_account import Account


def generate_wallet_data(num_samples: int = 300, random_state: int = 42) -> pd.DataFrame:
    """
    Generate synthetic wallet dataset.
    Features:
      - wallet_address: Realistic Ethereum checksum address
      - repayment_history_score: 0 to 100 (higher = better repayment/credit history)
      - high_risk_tx_count: 0 to 25 (count of interactions with mixers, liquidations, risky protocols)
      - wallet_age_days: 7 to 1500 (age of first tx on chain)
      - balance_stability_score: 0 to 100 (higher = stable balance & cashflow)
      - label: 0 = safe, 1 = default/risky
    """
    np.random.seed(random_state)
    
    addresses = []
    for _ in range(num_samples):
        # Generate valid eth address
        addr = Account.create().address
        addresses.append(addr)
    
    # Half safe-leaning distribution, half risky-leaning distribution with realistic noise
    half = num_samples // 2
    
    # Safe population (lower risk, label 0)
    repay_safe = np.random.normal(loc=78, scale=12, size=half).clip(30, 100)
    risk_tx_safe = np.random.poisson(lam=1.5, size=half).clip(0, 10)
    age_safe = np.random.exponential(scale=500, size=half) + 120
    age_safe = age_safe.clip(60, 1500)
    stab_safe = np.random.normal(loc=75, scale=12, size=half).clip(30, 100)
    
    # Default/risky population (higher risk, label 1)
    repay_risk = np.random.normal(loc=35, scale=15, size=num_samples - half).clip(0, 75)
    risk_tx_risk = np.random.poisson(lam=8.0, size=num_samples - half).clip(1, 30)
    age_risk = np.random.exponential(scale=120, size=num_samples - half) + 7
    age_risk = age_risk.clip(7, 600)
    stab_risk = np.random.normal(loc=32, scale=14, size=num_samples - half).clip(0, 70)
    
    repayment_history_score = np.concatenate([repay_safe, repay_risk])
    high_risk_tx_count = np.concatenate([risk_tx_safe, risk_tx_risk])
    wallet_age_days = np.concatenate([age_safe, age_risk])
    balance_stability_score = np.concatenate([stab_safe, stab_risk])
    
    # Latent risk score calculation for ground truth label
    # High risk if low repayment, high risk_tx, low age, low stability
    normalized_repay = (100.0 - repayment_history_score) / 100.0
    normalized_tx = np.clip(high_risk_tx_count / 15.0, 0, 1.0)
    normalized_age = (1500.0 - wallet_age_days) / 1500.0
    normalized_stab = (100.0 - balance_stability_score) / 100.0
    
    latent_risk = (
        0.35 * normalized_repay +
        0.30 * normalized_tx +
        0.15 * normalized_age +
        0.20 * normalized_stab +
        np.random.normal(0, 0.08, size=num_samples)
    )
    
    labels = (latent_risk > 0.50).astype(int)
    
    df = pd.DataFrame({
        "wallet_address": addresses,
        "repayment_history_score": np.round(repayment_history_score, 1),
        "high_risk_tx_count": high_risk_tx_count.astype(int),
        "wallet_age_days": np.round(wallet_age_days).astype(int),
        "balance_stability_score": np.round(balance_stability_score, 1),
        "label": labels
    })
    
    # Shuffle dataframe
    df = df.sample(frac=1.0, random_state=random_state).reset_index(drop=True)
    return df


def ensure_dataset(output_path: str = "data/synthetic_wallets.csv") -> pd.DataFrame:
    """Load existing dataset or generate a new one if not present."""
    if os.path.exists(output_path):
        return pd.read_csv(output_path)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df = generate_wallet_data()
    df.to_csv(output_path, index=False)
    print(f"Generated synthetic wallet dataset saved to {output_path} ({len(df)} records).")
    return df


if __name__ == "__main__":
    df = ensure_dataset()
    print("Dataset Summary:")
    print(df.describe())
    print("\nLabel distribution:")
    print(df["label"].value_counts())
