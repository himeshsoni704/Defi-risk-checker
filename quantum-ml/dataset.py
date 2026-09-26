"""
Synthetic Wallet Dataset Generator for DeFi Risk Checker.
Generates synthetic wallet on-chain risk features and labels.
Expanded: 1000–5000 wallets, 12 features, nonlinear interaction-based risk labeling.
"""

import os
import numpy as np
import pandas as pd
from eth_account import Account


FEATURE_NAMES = [
    "wallet_age_days",
    "transaction_count",
    "avg_transaction_value",
    "repayment_ratio",
    "liquidation_count",
    "borrow_count",
    "high_risk_tx_count",
    "protocol_count",
    "balance_stability",
    "failed_transactions",
    "large_tx_ratio",
    "historical_default",
]

# Human-friendly display names
DISPLAY_FEATURE_MAP = {
    "wallet_age_days": "wallet_age",
    "transaction_count": "tx_count",
    "avg_transaction_value": "avg_tx_value",
    "repayment_ratio": "repayment_ratio",
    "liquidation_count": "liquidations",
    "borrow_count": "borrow_count",
    "high_risk_tx_count": "high_risk_tx",
    "protocol_count": "protocol_diversity",
    "balance_stability": "balance_stability",
    "failed_transactions": "failed_tx",
    "large_tx_ratio": "large_tx_ratio",
    "historical_default": "historical_default",
}


def generate_wallet_data(num_samples: int = 2000, random_state: int = 42) -> pd.DataFrame:
    """
    Generate synthetic wallet dataset with 12 on-chain risk features.

    Features:
      - wallet_age_days:        Days since first transaction (7–1500)
      - transaction_count:      Total number of on-chain transactions (5–2000)
      - avg_transaction_value:  Average ETH transaction size (0.01–200 ETH)
      - repayment_ratio:        Fraction of borrows repaid on time (0.0–1.0)
      - liquidation_count:      Number of times wallet has been liquidated (0–20)
      - borrow_count:           Number of DeFi borrow events (0–150)
      - high_risk_tx_count:     Interactions with mixers/risky protocols (0–30)
      - protocol_count:         Number of distinct DeFi protocols used (1–25)
      - balance_stability:      Balance coefficient of variation score (0–100)
      - failed_transactions:    Count of failed on-chain txs (0–40)
      - large_tx_ratio:         Fraction of txs > 5 ETH (0.0–1.0)
      - historical_default:     Binary: prior DeFi default event (0 or 1)

    Labels use nonlinear interaction logic:
      - High tx_risk alone ≠ bad
      - High tx_risk + low repayment + new wallet → strongly risky
    """
    np.random.seed(random_state)

    addresses = [Account.create().address for _ in range(num_samples)]
    half = num_samples // 2

    # ── Safe population ──────────────────────────────────────────────
    safe = {
        "wallet_age_days": (np.random.exponential(500, half) + 180).clip(60, 1500),
        "transaction_count": (np.random.lognormal(5.5, 0.8, half)).clip(20, 2000).astype(int),
        "avg_transaction_value": (np.random.lognormal(1.5, 1.0, half)).clip(0.01, 200),
        "repayment_ratio": np.random.beta(8, 2, half),  # right-skewed toward 1.0
        "liquidation_count": np.random.poisson(0.3, half).clip(0, 3),
        "borrow_count": np.random.poisson(12, half).clip(0, 80),
        "high_risk_tx_count": np.random.poisson(1.2, half).clip(0, 8),
        "protocol_count": np.random.randint(3, 20, half),
        "balance_stability": np.random.normal(72, 12, half).clip(30, 100),
        "failed_transactions": np.random.poisson(1.5, half).clip(0, 10),
        "large_tx_ratio": np.random.beta(2, 8, half),  # few large tx
        "historical_default": np.random.binomial(1, 0.05, half),
    }

    # ── Risky population ─────────────────────────────────────────────
    risky = {
        "wallet_age_days": (np.random.exponential(80, half) + 7).clip(7, 400),
        "transaction_count": (np.random.lognormal(3.2, 1.0, half)).clip(5, 500).astype(int),
        "avg_transaction_value": (np.random.lognormal(2.5, 1.5, half)).clip(0.01, 200),
        "repayment_ratio": np.random.beta(2, 7, half),  # left-skewed toward 0
        "liquidation_count": np.random.poisson(4.5, half).clip(0, 20),
        "borrow_count": np.random.poisson(28, half).clip(0, 150),
        "high_risk_tx_count": np.random.poisson(9, half).clip(1, 30),
        "protocol_count": np.random.randint(1, 8, half),
        "balance_stability": np.random.normal(28, 14, half).clip(0, 65),
        "failed_transactions": np.random.poisson(8, half).clip(0, 40),
        "large_tx_ratio": np.random.beta(5, 3, half),  # many large tx
        "historical_default": np.random.binomial(1, 0.55, half),
    }

    # Concatenate populations
    features = {}
    for key in safe:
        safe_arr = np.array(safe[key], dtype=float)
        risky_arr = np.array(risky[key], dtype=float)
        features[key] = np.concatenate([safe_arr, risky_arr])

    # ── Nonlinear Interaction Risk Labeling ──────────────────────────
    # Core signals (normalized 0–1)
    nr = features["repayment_ratio"]                               # high = good
    nt = (features["high_risk_tx_count"] / 15.0).clip(0, 1)       # high = bad
    na = (1 - features["wallet_age_days"] / 1500.0).clip(0, 1)    # new = bad
    ns = (1 - features["balance_stability"] / 100.0).clip(0, 1)   # unstable = bad
    nl = (features["liquidation_count"] / 10.0).clip(0, 1)        # liquidations = bad
    nf = (features["failed_transactions"] / 20.0).clip(0, 1)      # failures = bad
    nd = features["historical_default"]                            # prior default = bad

    # LINEAR component
    linear_risk = (
        0.25 * (1 - nr) +
        0.20 * nt +
        0.10 * na +
        0.15 * ns +
        0.10 * nl +
        0.05 * nf +
        0.15 * nd
    )

    # NONLINEAR interactions (key innovation)
    # Rule: high tx_risk + low repayment + new wallet → amplified risk
    interaction_1 = nt * (1 - nr) * na * 0.6
    # Rule: multiple liquidations + low repayment → very risky
    interaction_2 = nl * (1 - nr) * 0.4
    # Rule: prior default + still borrowing a lot → risky
    borrow_ratio = (features["borrow_count"] / 80.0).clip(0, 1)
    interaction_3 = nd * borrow_ratio * 0.3
    # Rule: many failures + low wallet age → inexperienced + risky
    interaction_4 = nf * na * 0.25

    latent_risk = (
        linear_risk +
        interaction_1 +
        interaction_2 +
        interaction_3 +
        interaction_4 +
        np.random.normal(0, 0.07, num_samples)
    ).clip(0, 1)

    labels = (latent_risk > 0.50).astype(int)

    df = pd.DataFrame({
        "wallet_address": addresses,
        "wallet_age_days": np.round(features["wallet_age_days"]).astype(int),
        "transaction_count": features["transaction_count"].astype(int),
        "avg_transaction_value": np.round(features["avg_transaction_value"], 4),
        "repayment_ratio": np.round(features["repayment_ratio"], 4),
        "liquidation_count": np.round(features["liquidation_count"]).astype(int),
        "borrow_count": np.round(features["borrow_count"]).astype(int),
        "high_risk_tx_count": np.round(features["high_risk_tx_count"]).astype(int),
        "protocol_count": features["protocol_count"].astype(int),
        "balance_stability": np.round(features["balance_stability"], 2),
        "failed_transactions": np.round(features["failed_transactions"]).astype(int),
        "large_tx_ratio": np.round(features["large_tx_ratio"], 4),
        "historical_default": features["historical_default"].astype(int),
        "label": labels,
    })

    df = df.sample(frac=1.0, random_state=random_state).reset_index(drop=True)
    return df


def ensure_dataset(output_path: str = "data/synthetic_wallets.csv") -> pd.DataFrame:
    """Load existing dataset or regenerate if stale (fewer than 12 feature columns)."""
    if os.path.exists(output_path):
        existing = pd.read_csv(output_path)
        # Regenerate if the dataset is missing the expanded feature set
        if all(col in existing.columns for col in FEATURE_NAMES):
            return existing
        print("Detected outdated dataset (old feature schema). Regenerating...")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df = generate_wallet_data()
    df.to_csv(output_path, index=False)
    print(f"Generated synthetic wallet dataset: {output_path} ({len(df)} wallets, {len(FEATURE_NAMES)} features).")
    return df


if __name__ == "__main__":
    df = ensure_dataset()
    print("Dataset Summary:")
    print(df.describe())
    print("\nLabel distribution:")
    print(df["label"].value_counts())
