# DeFi Risk Checker — API Contract (v2.0)

REST API for the DeFi Risk Checker backend. It scores a wallet with a quantum
ML model (QSVC), explains the score with SHAP, audits the explanation, and can
anchor the full record on-chain.

Base URL: `http://localhost:8000` — interactive docs at `/docs`.

## Pipeline

```
WALLET → 12 features → QSVC risk score → SHAP explanation
       → XAI audit (faithfulness · stability · sensitivity)
       → canonical JSON record → Keccak256 → blockchain
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Service info + endpoint map |
| `GET` | `/health` | System status, model metadata, provider, cache sizes |
| `GET` | `/wallets?limit=10` | Sample wallets from the dataset (safe + risky mix) |
| `POST` | `/score` | Full pipeline for one wallet |
| `GET` | `/explain/{wallet_id}` | SHAP attributions + audit report |
| `GET` | `/explain/llm/{wallet_id}` | Same, plus the optional Gemini explanation |
| `GET` | `/audit/{wallet_id}` | Standalone explanation audit report |
| `GET` | `/compare` | QSVC vs XGBoost vs classical SVM table |
| `POST` | `/verify/{wallet_id}` | Anchor the canonical hash on-chain |
| `GET` | `/verify/{wallet_id}` | Verify the on-chain hash against the record |

---

### `GET /health`

```json
{
  "status": "healthy",
  "quantum_model": {
    "model_id": "QSVC-ZZFeatureMap",
    "model_version": "2.0",
    "dataset_version": "2.0",
    "feature_schema_version": "2.0",
    "n_qubits": 6,
    "feature_map": "ZZFeatureMap (reps=1, entanglement=linear, 6 qubits)",
    "kernel": "FidelityStatevectorKernel (Statevector simulation)",
    "test_accuracy": 0.7,
    "test_auc": 0.86,
    "test_f1": 0.7
  },
  "web3": {
    "is_live_sepolia": false,
    "network": "Sepolia (Simulated Provider)",
    "explorer_base": "https://sepolia.etherscan.io"
  },
  "dataset_rows": 2000,
  "cached_explanations": 0,
  "cached_decisions": 0
}
```

---

### `GET /wallets?limit=10`

Returns up to `limit` wallets, alternating safe (label 0) and risky (label 1).

```json
[
  {
    "wallet_address": "0x7D69BD4E9429cEB8Fe21E78277372e93C0784092",
    "label": 0,
    "wallet_age_days": 269,
    "transaction_count": 351,
    "avg_transaction_value": 8.0996,
    "repayment_ratio": 0.5843,
    "liquidation_count": 1,
    "borrow_count": 5,
    "high_risk_tx_count": 1,
    "protocol_count": 11,
    "balance_stability": 85.88,
    "failed_transactions": 1,
    "large_tx_ratio": 0.2775,
    "historical_default": 0
  }
]
```

---

### `POST /score`

Body: `{ "wallet_address": "0x…", "features": { … } }`. `features` is optional
— if omitted, the address is looked up in the dataset (falling back to neutral
defaults for unknown addresses). You may pass a subset of the 12 features; the
rest are filled with defaults. Legacy names (`repayment_history_score`,
`balance_stability_score`) are accepted and mapped.

Only the 6 quantum features actually drive the score: `repayment_ratio`,
`high_risk_tx_count`, `wallet_age_days`, `balance_stability`,
`liquidation_count`, `historical_default`.

Response (abridged):

```json
{
  "wallet_address": "0x1111111111111111111111111111111111111111",
  "risk_score": 9.9,
  "decision": "APPROVED",
  "decision_hash": "0x03cf2dba744393c0fb47d84472b5f10aee743b5ca00a1ef47306fbf5edab6156",
  "features": { "wallet_age_days": 280, "repayment_ratio": 0.65, "…": 0 },
  "model_version": { "model_id": "QSVC-ZZFeatureMap", "n_qubits": 6, "…": "…" },
  "audit": {
    "faithfulness": { "score": 0.0, "verdict": "LOW" },
    "stability": { "score": 0.81, "verdict": "HIGH" },
    "sensitivity": { "score": 1.0, "verdict": "HIGH" },
    "overall_verdict": "SUPPORTED WITH CAUTION",
    "overall_description": "…",
    "summary_lines": ["…"]
  },
  "classical_baseline": { "XGBoost": { "accuracy": 0.9975 }, "…": {} },
  "canonical_record": { "…": "the exact hashed JSON" },
  "timestamp": 1790438355
}
```

- **Decision rule:** `risk_score >= 50` → `DENIED`, otherwise `APPROVED`.
- `decision_hash` = Keccak256 of `canonical_record`.

---

### `GET /explain/{wallet_id}`

Scores the wallet if needed, then returns SHAP attributions plus the audit.

```json
{
  "wallet_address": "0x7D69…4092",
  "risk_score": 46.0,
  "decision": "APPROVED",
  "base_risk_value": 49.8,
  "feature_contributions": {
    "repayment_ratio": -1.0,
    "high_risk_tx": -4.6,
    "liquidations": 2.6,
    "historical_default": 2.2,
    "tx_count": 0.0
  },
  "input_features": { "wallet_age": 269.0, "tx_count": 351.0 },
  "audit": { "…": "XAIAuditReport" },
  "llm_explanation": null,
  "cached": false
}
```

Contribution keys use human-friendly display names (see `DISPLAY_FEATURE_MAP`).
Positive contributions raise risk; negative contributions lower it.

---

### `GET /audit/{wallet_id}`

Returns the standalone `XAIAuditReport`:

```json
{
  "faithfulness": { "score": 0.0, "verdict": "LOW",  "display_level": "⚠ Low" },
  "stability":    { "score": 0.81, "verdict": "HIGH", "display_level": "✓ High" },
  "sensitivity":  { "score": 1.0,  "verdict": "HIGH", "display_level": "✓ High" },
  "overall_verdict": "SUPPORTED WITH CAUTION",
  "overall_description": "…",
  "summary_lines": [
    "Faithfulness   ⚠ Low         (0/3 features verified)",
    "Stability      ✓ High        (ρ = 0.812 across 5 clones)",
    "Sensitivity    ✓ High        (4/4 features directionally correct)",
    "Overall: SUPPORTED WITH CAUTION"
  ]
}
```

Verdicts: `SUPPORTED` · `SUPPORTED WITH CAUTION` · `QUESTIONABLE`.

---

### `POST /verify/{wallet_id}`

Anchors `decision_hash` on-chain (simulated by default).

```json
{
  "wallet_address": "0x7D69…4092",
  "decision_hash": "0x…",
  "tx_hash": "0x2548b72392…",
  "block_number": 6540006,
  "network": "Sepolia Testnet (Simulated Provider)",
  "status": "confirmed",
  "explorer_url": "https://sepolia.etherscan.io/tx/0x2548b72392…",
  "timestamp": 1790438410
}
```

### `GET /verify/{wallet_id}`

```json
{
  "wallet_address": "0x7D69…4092",
  "verified": true,
  "on_chain_hash": "0x2d5f…e13f1",
  "expected_hash": "0x2d5f…e13f1",
  "tx_hash": "0x2548b72392…",
  "network": "Sepolia Testnet (Simulated Provider)",
  "explorer_url": "https://sepolia.etherscan.io/tx/0x2548b72392…",
  "timestamp": 1790438410,
  "canonical_record": { "…": "…" },
  "message": null
}
```

`verified: true` means the on-chain hash matches the freshly computed canonical
record.

---

## Notes

- `/explain/llm/{wallet_id}` returns a plain-English explanation only when
  `GEMINI_API_KEY` is configured; otherwise `llm_explanation` explains that the
  LLM layer is disabled.
- CORS is open (`allow_origins=["*"]`) so a local frontend can call the API
  directly.
- Error responses from the API use FastAPI's standard `{"detail": "…"}` shape
  with a non-200 status code.
