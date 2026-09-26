# DeFi Risk Checker v2.0

**Quantum ML · Explainable AI · XAI Audit · Blockchain Proof-of-Decision**

> *QML makes the risk assessment. XAI makes it interpretable. Our XAI audit tests the explanation. Blockchain makes the resulting record independently verifiable.*

---

## Current Status & Known Issues

The backend is a working MVP, but a few things are deliberately left for later work:

- **Scoring is fast.** `/score` runs the full quantum → SHAP → audit pipeline in roughly **1–2 seconds** per wallet on CPU. It uses Qiskit's `FidelityStatevectorKernel`, which computes the same fidelity kernel as a circuit-based kernel but avoids re-transpiling on every call.
- **Model artifacts are included, but retrainable.** Trained model + dataset artifacts are committed. If you change the schema or want fresh training, run the setup steps below.
- **LLM explanations are optional.** The plain-English Gemini explanation stays disabled unless `GEMINI_API_KEY` is set.
- **Blockchain is simulated by default.** Without `SEPOLIA_RPC_URL` / `PRIVATE_KEY` / `CONTRACT_ADDRESS`, proofs are written to a local simulated ledger (`data/local_ledger.json`).
- **Windows notes.** `requirements.txt` now installs cleanly on Windows (uvloop is skipped there). If your console ever raises `UnicodeEncodeError`, run `set PYTHONUTF8=1` first.

---

## Architecture

```
WALLET
  │
  ▼
Feature Extraction (12 on-chain features)
  │
  ▼
┌──────────────────┐     ┌──────────────────┐
│   QSVC (Quantum) │     │ XGBoost / C-SVM  │
│  6-qubit circuit │     │ Classical Baseline│
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        ▼
      RISK SCORE          Comparison Table
         │
         ▼
┌──────────────────┐
│   SHAP           │
│   KernelExplainer│
└────────┬─────────┘
         │
         ▼
     EXPLANATION
         │
         ▼
┌──────────────────────────┐
│     XAI AUDITOR          │
│                          │
│  Faithfulness  (perturb) │
│  Stability  (rank-corr)  │
│  Sensitivity (monotonic) │
└──────────────┬───────────┘
               │
               ▼
         AUDIT REPORT
    (SUPPORTED / CAUTION / QUESTIONABLE)
               │
               ▼
  ┌────────────────────────────┐
  │  LLM Explainer (Gemini)    │
  │  RAG Knowledge Base        │
  │  Chain-of-Thought          │
  └─────────────┬──────────────┘
                │
                ▼
  ┌────────────────────────────┐
  │  Canonical JSON Record     │
  │  ─────────────────────     │
  │  wallet_id                 │
  │  model_id + version        │
  │  dataset_version           │
  │  feature_schema_version    │
  │  risk_score + decision     │
  │  features (12)             │
  │  SHAP explanation          │
  │  audit { faith · stab · sen│
  │  timestamp                 │
  └─────────────┬──────────────┘
                │
                ▼
           Keccak256
                │
                ▼
          BLOCKCHAIN
    (Sepolia / Simulated)
                │
                ▼
          VERIFY RECORD
```

---

## What's New in v2.0

### 1. XAI Audit Layer *(hackathon innovation)*

The system now independently tests every SHAP explanation before committing it to the blockchain.

| Dimension | Test | Pass Condition |
|---|---|---|
| **Faithfulness** | Perturb top-k SHAP features; measure actual Δ risk | Actual Δ ≥ 25% of SHAP attribution magnitude |
| **Stability** | Compute SHAP on N micro-perturbed clones; measure Spearman ρ | ρ ≥ 0.70 across 5 clones |
| **Sensitivity** | Move each feature in the risky direction; check risk increases | Risk Δ ≥ 2 pts for ≥ 80% of features |

**Output (not a fake "trust score"):**
```
EXPLANATION AUDIT
Faithfulness   ✓ High    (3/3 features verified)
Stability      ~ Medium  (ρ = 0.61 across 5 clones)
Sensitivity    ✓ High    (4/4 features directionally correct)
Overall: SUPPORTED WITH CAUTION
```

### 2. LLM RAG Explainer (Gemini)

The system now translates complex mathematical SHAP features and XAI audit results into plain English using a Large Language Model (Gemini 3.8 Flash). 

To prevent LLM hallucination, it uses **RAG (Retrieval-Augmented Generation)** combined with **Chain of Thought**:
1. It retrieves established DeFi risk principles from a local TF-IDF Knowledge Base (e.g., "Why does high transaction count matter?").
2. It combines this with the exact SHAP attribution numbers and the Audit verdict.
3. It outputs a structured, citable JSON explanation containing an executive summary, key drivers, audit context, and the underlying DeFi principle.

### 3. Blockchain commits to the entire record

Previously: `hash(wallet + score)`  
Now: `Keccak256(canonical JSON)` where the JSON includes:

```json
{
  "wallet_id": "0x...",
  "model": { "model_id": "QSVC-ZZFeatureMap", "model_version": "2.0", "dataset_version": "2.0", ... },
  "risk_score": 82.0,
  "decision": "DENIED",
  "features": { ... all 12 ... },
  "explanation": { "base_value": 51.2, "feature_contributions": { ... } },
  "audit": {
    "faithfulness": 0.91, "faithfulness_verdict": "HIGH",
    "stability": 0.61,    "stability_verdict": "MEDIUM",
    "sensitivity": 0.94,  "sensitivity_verdict": "HIGH",
    "overall_verdict": "SUPPORTED WITH CAUTION"
  },
  "timestamp": 1727348400
}
```

### 4. Model versioning

Every decision record carries `model_id`, `model_version`, `dataset_version`, and `feature_schema_version`. Historical blockchain records remain verifiable even after model retraining.

### 5. Classical ML baseline

```
Model              Accuracy      F1      AUC    Inference
─────────────────────────────────────────────────────────
Classical SVM        X.XX      X.XX    X.XX    X.XXX ms/s
XGBoost              X.XX      X.XX    X.XX    X.XXX ms/s
QSVC (Quantum)       X.XX      X.XX    X.XX    sim only
```
Run `python quantum-ml/classical_baseline.py` to populate with your hardware numbers.

### 6. Expanded dataset

- **2,000 synthetic wallets** (up from 300)  
- **12 features** (up from 4): wallet age, tx count, avg tx value, repayment ratio, liquidations, borrow count, high-risk tx, protocol diversity, balance stability, failed tx, large tx ratio, historical default
- **Nonlinear interactions**: high tx-risk alone ≠ bad; high tx-risk + low repayment + new wallet → strongly risky

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/score` | Full pipeline: QSVC → SHAP → Audit → Canonical Hash |
| `GET` | `/explain/{wallet_id}` | SHAP attributions + audit report |
| `GET` | `/explain/llm/{wallet_id}` | SHAP + Audit + Gemini LLM RAG Explanation |
| `GET` | `/audit/{wallet_id}` | Standalone XAI audit report |
| `GET` | `/compare` | Model comparison table (QSVC vs XGBoost vs SVM) |
| `POST` | `/verify/{wallet_id}` | Anchor canonical hash on-chain |
| `GET` | `/verify/{wallet_id}` | Verify on-chain hash matches canonical record |
| `GET` | `/wallets` | Sample wallets from dataset |
| `GET` | `/health` | System status + model metadata |

---

## Frontend Demo Flow (Judge Walk-Through)

```
Screen 1  →  Connect Wallet: 0x72...A91
Screen 2  →  QML Risk Assessment: 82/100 HIGH RISK — Loan: DENIED
Screen 3  →  Why? (SHAP attributions for all 12 features)
Screen 4  →  Can we trust this explanation?
              Faithfulness ✓ 91%  |  Stability ⚠ 61%  |  Sensitivity ✓ 94%
              EXPLANATION SUPPORTED WITH CAUTION
Screen 5  →  On-chain proof: Decision hash 0x8f4c...91ae [VERIFY ON CHAIN]
Screen 6  →  ✓ VERIFIED — The displayed decision, explanation, and audit record
              match the blockchain commitment.
```

---

## Setup

```bash
pip install -r requirements.txt

# Generate expanded dataset + train QSVC (takes ~5 min on CPU)
python quantum-ml/dataset.py
python quantum-ml/qml_model.py

# Train classical baseline for comparison table
python quantum-ml/classical_baseline.py

# Start API
uvicorn api.main:app --reload --port 8000
```

Copy `.env.example` → `.env` and fill in `SEPOLIA_RPC_URL` / `PRIVATE_KEY` / `CONTRACT_ADDRESS` for live Sepolia mode. Without those, the system runs in a fully simulated local provider.

**Frontend (Next.js):**

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000 (backend must be on :8000)
```

See `frontend/README.md` for the page map and configuration.

---

## Pitch Framing

> **Blockchain does not prove the AI decision is trustworthy.**  
> Blockchain provides an **immutable commitment** to what the AI decided and what explanation was recorded.

**The full story:**
- QML makes the risk assessment.
- XAI makes it interpretable.
- Our XAI audit independently tests the explanation.
- Blockchain makes the complete record (prediction + explanation + audit) independently verifiable.
