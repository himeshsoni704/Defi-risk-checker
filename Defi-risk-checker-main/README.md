# DeFi Risk Checker - Backend

An end-to-end decentralized credit risk-scoring backend combining **Quantum Machine Learning (QML)**, **Explainable AI (XAI)**, and **Blockchain Proof-of-Decision (Sepolia Testnet)**.

Exposes a clean, high-performance REST API with interactive Swagger documentation (`/docs`) designed for rapid frontend integration.

---

## Architecture Overview

```
                      +-----------------------------+
                      |       Frontend UI           |
                      +-----------------------------+
                                     |
                                     v
                       +---------------------------+
                       |    FastAPI REST Engine    |
                       +---------------------------+
                        /            |            \
                       v             v             v
        +-------------------+  +-----------+  +----------------------+
        | Quantum ML Model  |  | XAI Layer |  | Web3 Proof Anchor    |
        | (QSVC + ZZMap)    |  | (SHAP)    |  | (DecisionProof.sol)  |
        +-------------------+  +-----------+  +----------------------+
                 |                   |                   |
                 v                   v                   v
            Risk Score         Attributions         Keccak256
             (0 - 100)       Per Feature (+/-)      On-Chain Write
```

### Components
1. **Toy Dataset (`/quantum-ml/dataset.py`)**: 300 synthetic wallets with realistic DeFi features (`repayment_history_score`, `high_risk_tx_count`, `wallet_age_days`, `balance_stability_score`).
2. **Quantum ML Model (`/quantum-ml/qml_model.py`)**: Qiskit Machine Learning Quantum Support Vector Classifier (QSVC) with a 4-qubit `ZZFeatureMap` and `FidelityQuantumKernel` on Aer statevector simulation. Pretrained and serialized to disk for instant runtime inference.
3. **Explainable AI Layer (`/quantum-ml/xai_explainer.py`)**: `shap.KernelExplainer` wrapping the quantum model as a black box to quantify exact positive/negative risk score shifts per feature. Pre-cached for sub-millisecond responses.
4. **Smart Contract & Web3 Layer (`/contracts`)**: Solidity contract (`DecisionProof.sol`) implementing the Oracle pattern (`recordDecision(bytes32)` and `getDecision(address)`). Supports both live Ethereum Sepolia Testnet and zero-config local simulation.
5. **REST API (`/api/main.py`)**: FastAPI application serving `/score`, `/explain/{wallet_id}`, `/verify/{wallet_id}` (POST & GET), and interactive Swagger docs at `/docs`.

---

## Directory Structure

```
defi-risk-checker/
├── data/
│   ├── synthetic_wallets.csv       # 300 synthetic wallet risk profiles
│   ├── cached_explanations.json    # Precomputed warm cache for XAI
│   └── decisions_store.json        # Persisted scoring decisions
├── quantum-ml/
│   ├── __init__.py
│   ├── dataset.py                  # Synthetic data generator
│   ├── qml_model.py                # QSVC definition, training & inference
│   ├── xai_explainer.py            # SHAP KernelExplainer with caching
│   └── artifacts/
│       ├── qsvc_model.pkl          # Serialized Quantum Model
│       ├── scaler.pkl              # Feature MinMaxScaler
│       └── metadata.json           # Model specs and test metrics
├── contracts/
│   ├── DecisionProof.sol           # Solidity on-chain anchor contract
│   ├── deploy.py                   # Py-solc-x compiler & Sepolia deployer
│   ├── web3_service.py             # Keccak256 hashing & on-chain oracle service
│   └── artifacts/
│       └── DecisionProof.json      # Compiled ABI and bytecode
├── api/
│   ├── __init__.py
│   ├── models.py                   # Pydantic request/response schemas
│   ├── service.py                  # Core backend orchestrator
│   └── main.py                     # FastAPI application entrypoint
├── test_pipeline.py                # Comprehensive 7-step E2E test suite
├── API_CONTRACT.md                 # Teammate-ready frontend API contract
├── requirements.txt                # Python dependencies
├── .env.example                    # Environment variables template
└── README.md                       # System documentation
```

---

## Quickstart Guide

### 1. Prerequisites
- macOS or Linux
- Python 3.11 (tested on Python 3.11.14)

### 2. Environment Setup
```bash
# Clone or navigate to the directory
cd defi-risk-checker

# Create Python 3.11 virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Generate Data & Pretrained Model (Already Pre-Built)
The repository includes pre-generated synthetic datasets and trained quantum model artifacts. To re-generate or re-train at any time:
```bash
# Generate synthetic dataset (300 records)
python quantum-ml/dataset.py

# Train Quantum Support Vector Classifier (QSVC)
python quantum-ml/qml_model.py
```

### 4. Smart Contract Compilation & Deployment
The contract compiler uses `py-solc-x` (Solidity `0.8.20`):
```bash
# Compile DecisionProof.sol and generate ABI/Bytecode
python contracts/deploy.py
```

- **Out of the box**: Operates in **High-Fidelity Simulated On-Chain Provider** mode (no gas or testnet keys needed for local development).
- **To Deploy to Live Sepolia**:
  1. Open `.env` and fill in:
     ```env
     SEPOLIA_RPC_URL=https://rpc.sepolia.org
     PRIVATE_KEY=0xYOUR_SEPOLIA_PRIVATE_KEY
     ```
  2. Run `python contracts/deploy.py`.
  3. Copy the printed contract address to `CONTRACT_ADDRESS=` in `.env`.

### 5. Start the REST API
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
Open **[http://localhost:8000/docs](http://localhost:8000/docs)** to test all endpoints interactively via Swagger UI.

### 6. Run the End-to-End Test Suite
```bash
python test_pipeline.py
```
Runs all 7 integration steps across Quantum ML scoring, SHAP XAI attributions, and Web3 cryptographic proof anchoring.

---

## API Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend health, Quantum model status, Web3 network status |
| `GET` | `/wallets` | Sample wallets from toy dataset for demo dropdowns |
| `POST` | `/score` | Quantum ML risk scoring (0-100) and approve/deny decision |
| `GET` | `/explain/{wallet_id}` | SHAP feature contribution breakdown (+/- points per feature) |
| `POST` | `/verify/{wallet_id}` | Computes keccak256 proof and anchors decision on-chain |
| `GET` | `/verify/{wallet_id}` | Re-fetches on-chain decision hash and verifies proof |

See **[`API_CONTRACT.md`](./API_CONTRACT.md)** for complete request/response schemas and TypeScript interfaces for your frontend teammate.

---

## Environment Variables

Configured in `.env`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Port for FastAPI server |
| `HOST` | `0.0.0.0` | Bind host |
| `SEPOLIA_RPC_URL` | `https://rpc.sepolia.org` | Ethereum Sepolia testnet RPC endpoint |
| `PRIVATE_KEY` | *(empty)* | Hex private key for on-chain transactions |
| `CONTRACT_ADDRESS` | *(empty)* | Deployed `DecisionProof` contract address |
| `EXPLORER_BASE_URL` | `https://sepolia.etherscan.io` | Block explorer base URL |
