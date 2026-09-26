// Response types for the DeFi Risk Checker API (api/models.py, api/main.py).
// Field names and shapes mirror what the FastAPI service actually returns.

export type Decision = "APPROVED" | "DENIED";
export type DimensionVerdict = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type OverallVerdict =
  | "SUPPORTED"
  | "SUPPORTED WITH CAUTION"
  | "QUESTIONABLE"
  | "UNKNOWN";

/** The 12 raw wallet features (quantum-ml/dataset.py FEATURE_NAMES). */
export interface WalletFeatures {
  wallet_age_days: number;
  transaction_count: number;
  avg_transaction_value: number;
  repayment_ratio: number;
  liquidation_count: number;
  borrow_count: number;
  high_risk_tx_count: number;
  protocol_count: number;
  balance_stability: number;
  failed_transactions: number;
  large_tx_ratio: number;
  historical_default: number;
}

export type FeatureKey = keyof WalletFeatures;

/** GET /wallets — one row of the synthetic dataset. label: 0 = safe, 1 = risky. */
export interface SampleWallet extends WalletFeatures {
  wallet_address: string;
  label: 0 | 1;
}

/** GET /health */
export interface HealthResponse {
  status: string;
  quantum_model: {
    model_id: string;
    model_version: string;
    dataset_version: string;
    feature_schema_version: string;
    n_qubits: number;
    feature_map: string | null;
    test_accuracy: number | null;
    test_auc: number | null;
    test_f1: number | null;
    trained_at: number | string | null;
  };
  web3: {
    is_live_sepolia: boolean;
    network: string;
    explorer_base: string;
  };
  dataset_rows: number;
  cached_explanations: number;
  cached_decisions: number;
}

// ── XAI audit (quantum-ml/xai_auditor.py) ───────────────────────────────────

interface AuditDimensionBase {
  score: number;
  score_pct?: number;
  verdict: DimensionVerdict | string;
  display_level?: string;
  description?: string;
}

export interface FaithfulnessCase {
  feature: string;
  shap_attribution: number;
  original_value: number;
  perturbed_value: number;
  original_risk: number;
  new_risk: number;
  actual_delta: number;
  expected_direction_correct: boolean;
  magnitude_sufficient: boolean;
  faithful: boolean;
  verdict: string;
}

export interface FaithfulnessReport extends AuditDimensionBase {
  faithful_features?: number;
  tested_features?: number;
  perturb_results?: FaithfulnessCase[];
}

export interface StabilityClone {
  seed: number;
  rank_correlation: number;
  contributions: Record<string, number>;
}

export interface StabilityReport extends AuditDimensionBase {
  mean_rank_correlation?: number;
  n_clones_tested?: number;
  clone_details?: StabilityClone[];
}

export interface SensitivityCase {
  feature: string;
  shap_attribution: number;
  original_value: number;
  worsened_value: number;
  original_risk: number;
  new_risk: number;
  delta: number;
  sensitive: boolean;
  verdict: string;
}

export interface SensitivityReport extends AuditDimensionBase {
  sensitive_features?: number;
  tested_features?: number;
  feature_details?: SensitivityCase[];
}

export interface AuditReport {
  faithfulness: FaithfulnessReport;
  stability: StabilityReport;
  sensitivity: SensitivityReport;
  overall_verdict: OverallVerdict | string;
  overall_description: string;
  summary_lines: string[];
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface ModelVersionRecord {
  model_id: string;
  model_version: string;
  dataset_version: string;
  feature_schema_version: string;
  qml_features: string[];
  n_qubits: number;
  trained_at: number | string;
}

/** The exact JSON object whose Keccak256 is the decision hash (contracts/web3_service.py). */
export interface CanonicalRecord {
  wallet_id: string;
  model: ModelVersionRecord;
  risk_score: number;
  decision: string;
  features: Record<string, number>;
  explanation: {
    base_value: number;
    feature_contributions: Record<string, number>;
  };
  audit: {
    faithfulness: number;
    faithfulness_verdict: string;
    stability: number;
    stability_verdict: string;
    sensitivity: number;
    sensitivity_verdict: string;
    overall_verdict: string;
  };
  timestamp: number;
  schema_version: string;
}

export interface ModelMetrics {
  accuracy?: number;
  f1?: number;
  auc?: number;
  inference_ms_per_sample?: number | string;
  n_features?: number;
  notes?: string;
  [extra: string]: unknown;
}

/** GET /compare. Either a map of model name → metrics, or a fallback with a `note`. */
export type ModelComparison = Record<string, ModelMetrics | string>;

/** POST /score */
export interface ScoreResponse {
  wallet_address: string;
  risk_score: number;
  decision: Decision | string;
  decision_hash: string;
  features: WalletFeatures;
  model_version: ModelVersionRecord;
  audit: AuditReport;
  classical_baseline: ModelComparison;
  canonical_record: CanonicalRecord;
  timestamp: number;
}

export interface LLMExplanation {
  summary: string;
  key_drivers: string[];
  audit_context: string;
  defi_principle: string;
}

/** GET /explain/{wallet} and GET /explain/llm/{wallet} */
export interface ExplainResponse {
  wallet_address: string;
  risk_score: number;
  decision: Decision | string;
  base_risk_value: number;
  /** Keyed by SHAP display name (e.g. "wallet_age", "high_risk_tx"). */
  feature_contributions: Record<string, number>;
  input_features: Record<string, number>;
  audit: AuditReport;
  llm_explanation: LLMExplanation | null;
  cached: boolean;
}

/** POST /verify/{wallet} */
export interface AnchorResponse {
  wallet_address: string;
  decision_hash: string;
  tx_hash: string;
  block_number: number;
  network: string;
  status: string;
  explorer_url: string;
  timestamp: number;
}

/** GET /verify/{wallet} */
export interface VerifyResponse {
  wallet_address: string;
  verified: boolean;
  on_chain_hash: string | null;
  expected_hash: string | null;
  tx_hash: string | null;
  network: string;
  explorer_url: string | null;
  timestamp: number | null;
  canonical_record: CanonicalRecord | null;
  message: string | null;
}
