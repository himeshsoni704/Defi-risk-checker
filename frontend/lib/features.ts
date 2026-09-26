// Feature metadata taken from the backend source:
//   - names and order: quantum-ml/dataset.py FEATURE_NAMES
//   - SHAP display keys: quantum-ml/dataset.py DISPLAY_FEATURE_MAP
//   - quantum circuit inputs: quantum-ml/qml_model.py QML_FEATURES
//   - descriptions: api/models.py WalletFeatures field descriptions
//   - ranges: quantum-ml/dataset.py generate_wallet_data docstring

import type { FeatureKey, WalletFeatures } from "./types";

export type FeatureFormat = "int" | "ratio" | "eth" | "score" | "flag";

export interface FeatureMeta {
  key: FeatureKey;
  /** Name used in SHAP contributions and /explain responses. */
  shapKey: string;
  label: string;
  description: string;
  format: FeatureFormat;
  unit?: string;
  min: number;
  max: number;
  /** True when the feature is one of the 6 inputs to the QSVC circuit. */
  quantum: boolean;
}

export const FEATURES: FeatureMeta[] = [
  { key: "wallet_age_days", shapKey: "wallet_age", label: "Wallet age", description: "Days since the wallet was first active on-chain.", format: "int", unit: "days", min: 7, max: 1500, quantum: true },
  { key: "transaction_count", shapKey: "tx_count", label: "Transactions", description: "Total number of on-chain transactions.", format: "int", min: 5, max: 2000, quantum: false },
  { key: "avg_transaction_value", shapKey: "avg_tx_value", label: "Avg. transaction value", description: "Average transaction size.", format: "eth", unit: "ETH", min: 0.01, max: 200, quantum: false },
  { key: "repayment_ratio", shapKey: "repayment_ratio", label: "Repayment ratio", description: "Fraction of borrows repaid on time.", format: "ratio", min: 0, max: 1, quantum: true },
  { key: "liquidation_count", shapKey: "liquidations", label: "Liquidations", description: "Count of past liquidation events.", format: "int", min: 0, max: 20, quantum: true },
  { key: "borrow_count", shapKey: "borrow_count", label: "Borrow events", description: "Number of DeFi borrow events.", format: "int", min: 0, max: 150, quantum: false },
  { key: "high_risk_tx_count", shapKey: "high_risk_tx", label: "High-risk interactions", description: "Interactions with mixers or high-risk protocols.", format: "int", min: 0, max: 30, quantum: true },
  { key: "protocol_count", shapKey: "protocol_diversity", label: "Protocol diversity", description: "Distinct DeFi protocols interacted with.", format: "int", min: 1, max: 25, quantum: false },
  { key: "balance_stability", shapKey: "balance_stability", label: "Balance stability", description: "Balance stability score (coefficient-of-variation based).", format: "score", unit: "/ 100", min: 0, max: 100, quantum: true },
  { key: "failed_transactions", shapKey: "failed_tx", label: "Failed transactions", description: "Count of failed transactions.", format: "int", min: 0, max: 40, quantum: false },
  { key: "large_tx_ratio", shapKey: "large_tx_ratio", label: "Large-tx ratio", description: "Fraction of transactions larger than 5 ETH.", format: "ratio", min: 0, max: 1, quantum: false },
  { key: "historical_default", shapKey: "historical_default", label: "Prior default", description: "Whether the wallet has a prior DeFi default event.", format: "flag", min: 0, max: 1, quantum: true },
];

export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<FeatureKey, FeatureMeta>;
export const FEATURE_BY_SHAP_KEY = Object.fromEntries(FEATURES.map((f) => [f.shapKey, f])) as Record<string, FeatureMeta>;

export const QUANTUM_FEATURES = FEATURES.filter((f) => f.quantum);
export const RECORDED_ONLY_FEATURES = FEATURES.filter((f) => !f.quantum);

/** Label for a key that may be a raw feature name or a SHAP display name. */
export function featureLabel(key: string): string {
  return (
    FEATURE_BY_SHAP_KEY[key]?.label ??
    (FEATURE_BY_KEY as Record<string, FeatureMeta | undefined>)[key]?.label ??
    key.replace(/_/g, " ")
  );
}

export function featureMeta(key: string): FeatureMeta | undefined {
  return FEATURE_BY_SHAP_KEY[key] ?? (FEATURE_BY_KEY as Record<string, FeatureMeta | undefined>)[key];
}

export function formatFeatureValue(meta: FeatureMeta | undefined, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (!meta) return String(value);
  switch (meta.format) {
    case "int":
      return Math.round(value).toLocaleString("en-US");
    case "ratio":
      return `${(value * 100).toFixed(1)}%`;
    case "eth":
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 3 })} ETH`;
    case "score":
      return value.toFixed(1);
    case "flag":
      return value >= 1 ? "Yes" : "No";
  }
}

/**
 * Profile the backend falls back to when an address is not in the dataset and
 * no features are supplied (api/service.py _DEFAULTS).
 */
export const DEFAULT_PROFILE: WalletFeatures = {
  wallet_age_days: 280,
  transaction_count: 85,
  avg_transaction_value: 2.0,
  repayment_ratio: 0.65,
  liquidation_count: 0,
  borrow_count: 10,
  high_risk_tx_count: 2,
  protocol_count: 4,
  balance_stability: 60.0,
  failed_transactions: 1,
  large_tx_ratio: 0.08,
  historical_default: 0,
};

export function isDefaultProfile(features: Partial<WalletFeatures> | undefined): boolean {
  if (!features) return false;
  return FEATURES.every((f) => Number(features[f.key]) === DEFAULT_PROFILE[f.key]);
}

/** Decision rule: risk_score ≥ 50 → DENIED (quantum-ml/qml_model.py evaluate_decision). */
export const RISK_THRESHOLD = 50;

/** Audit thresholds (quantum-ml/xai_auditor.py). */
export const AUDIT_RULES = {
  faithfulnessTopK: 3,
  faithfulnessMinDelta: 5.0,
  faithfulnessMinShare: 0.25,
  stabilityHigh: 0.7,
  stabilityMedium: 0.45,
  stabilityClones: 5,
  stabilityNoiseStd: 0.005,
  sensitivityMinAttribution: 3.0,
  sensitivityMinDelta: 2.0,
  ratioHigh: 0.8,
  ratioMedium: 0.5,
};
