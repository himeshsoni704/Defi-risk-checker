# DeFi Risk Checker - Frontend API Contract

This document defines the REST API contract for the **DeFi Risk Checker** backend. 
Frontend developers can test all endpoints interactively at: **`http://localhost:8000/docs`** (Swagger UI).

---

## 1. Overview & Architecture Flow

```
+------------------+         +--------------------+         +-----------------------+
|  Frontend Client | ------> |  POST /score       | ------> |  Quantum ML Model     |
|  (Wallet UI)     |         |  (Wallet Features) |         |  (QSVC 0-100 Score)   |
+------------------+         +--------------------+         +-----------------------+
         |                             |                                |
         |                             v                                v
         |                   +--------------------+         +-----------------------+
         +-----------------> |  GET /explain/:id  | <------ |  XAI Layer            |
         |                   |  (Attributions)    |         |  (SHAP Feature Shifts)|
         |                   +--------------------+         +-----------------------+
         |                             |                                |
         v                             v                                v
+------------------+         +--------------------+         +-----------------------+
|  POST /verify/:id| ------> |  On-Chain Anchor   | ------> |  Smart Contract       |
|  GET /verify/:id | <------ |  (Keccak256 Proof) |         |  (Sepolia Testnet)    |
+------------------+         +--------------------+         +-----------------------+
```

---

## 2. Endpoints Specification

### 2.1 Get System Health & Quantum Status
Check whether the backend, quantum model, and blockchain provider are online.

- **Method**: `GET`
- **Path**: `/health`
- **Headers**: `Accept: application/json`
- **Response** (`200 OK`):
```json
{
  "status": "healthy",
  "quantum_model": {
    "type": "QSVC",
    "kernel": "FidelityQuantumKernel (Aer Statevector)",
    "feature_map": "ZZFeatureMap (reps=1, entanglement=linear, 4 qubits)",
    "test_accuracy": 0.611,
    "test_auc": 0.679
  },
  "web3": {
    "is_live_sepolia": false,
    "network": "Sepolia Testnet (Simulated Provider)",
    "explorer_base": "https://sepolia.etherscan.io"
  },
  "dataset_rows": 300,
  "cached_explanations": 24,
  "cached_decisions": 5
}
```

---

### 2.2 Get Sample Wallets (Dataset Helper)
Fetches pre-populated wallets from the toy dataset. Ideal for populating demo dropdowns so judges can click sample wallets without manually typing addresses.

- **Method**: `GET`
- **Path**: `/wallets?limit=10`
- **Query Params**:
  - `limit` (integer, optional, default: `10`): Number of sample wallets to return.
- **Response** (`200 OK`):
```json
[
  {
    "wallet_address": "0xABA6055C4bAA05fbc0f7Bc699019fEf12Fc61d33",
    "repayment_history_score": 83.2,
    "high_risk_tx_count": 0,
    "wallet_age_days": 810,
    "balance_stability_score": 89.4,
    "label": 0
  },
  {
    "wallet_address": "0x37aF6b1101968840d4212574A1A7D187d25eD208",
    "repayment_history_score": 28.5,
    "high_risk_tx_count": 9,
    "wallet_age_days": 42,
    "balance_stability_score": 24.1,
    "label": 1
  }
]
```

---

### 2.3 Score Wallet (Quantum ML Inference)
Evaluates credit risk using the Quantum Support Vector Classifier (QSVC) on Aer statevector simulation.

- **Method**: `POST`
- **Path**: `/score`
- **Headers**: `Content-Type: application/json`

#### Option A: Submit Custom Features
```json
{
  "wallet_address": "0x71C8363e3799173F35733365055170993001569B",
  "features": {
    "repayment_history_score": 85.0,
    "high_risk_tx_count": 1,
    "wallet_age_days": 450,
    "balance_stability_score": 80.0
  }
}
```

#### Option B: Look up Wallet Address from Toy Dataset
```json
{
  "wallet_address": "0xABA6055C4bAA05fbc0f7Bc699019fEf12Fc61d33"
}
```

- **Response** (`200 OK`):
```json
{
  "wallet_address": "0x71C8363e3799173F35733365055170993001569B",
  "risk_score": 48.2,
  "decision": "approve",
  "decision_hash": "0xe107584b2c85292bdbee61e8ccaf8ec1e0499dbb98840c0e42c04c1892940ce8",
  "features": {
    "repayment_history_score": 85.0,
    "high_risk_tx_count": 1,
    "wallet_age_days": 450,
    "balance_stability_score": 80.0
  },
  "quantum_model": "QSVC",
  "timestamp": 1790408500
}
```

> **Decision Rule**: `risk_score < 50.0` => `"approve"` | `risk_score >= 50.0` => `"deny"`.

---

### 2.4 Explain Wallet Decision (XAI Attributions)
Returns the SHAP KernelExplainer feature contribution breakdown. 
Positive contributions increase risk; negative contributions reduce risk.

- **Method**: `GET`
- **Path**: `/explain/{wallet_id}`
- **Response** (`200 OK`):
```json
{
  "wallet_address": "0x71C8363e3799173F35733365055170993001569B",
  "risk_score": 48.2,
  "decision": "approve",
  "base_risk_value": 65.0,
  "feature_contributions": {
    "repayment_history": -8.5,
    "high_risk_tx": -5.2,
    "wallet_age": -4.1,
    "balance_stability": +1.0
  },
  "input_features": {
    "repayment_history": 85.0,
    "high_risk_tx": 1.0,
    "wallet_age": 450.0,
    "balance_stability": 80.0
  },
  "cached": true
}
```

#### Frontend Visualization Guide:
- Render a waterfall or horizontal bar chart showing each feature contribution.
- Green bars for risk-reducing factors (negative points, e.g. `repayment_history: -8.5`).
- Red bars for risk-increasing factors (positive points, e.g. `high_risk_tx: +18.0`).
- Formula: `base_risk_value + sum(feature_contributions) == risk_score`.

---

### 2.5 Anchor Decision Proof On-Chain
Computes `keccak256(wallet_address + risk_score + canonical_explanation)` and calls `recordDecision(bytes32 decisionHash)` on the smart contract.

- **Method**: `POST`
- **Path**: `/verify/{wallet_id}`
- **Response** (`200 OK`):
```json
{
  "wallet_address": "0x71C8363e3799173F35733365055170993001569B",
  "decision_hash": "0xe107584b2c85292bdbee61e8ccaf8ec1e0499dbb98840c0e42c04c1892940ce8",
  "tx_hash": "0xe3c7049142a6c65a51b85dc4932d99b469d3acef7529b26a7b45db1de29542c7",
  "block_number": 6540002,
  "network": "Sepolia Testnet",
  "status": "confirmed",
  "explorer_url": "https://sepolia.etherscan.io/tx/0xe3c7049142a6c65a51b85dc4932d99b469d3acef7529b26a7b45db1de29542c7",
  "timestamp": 1790408512
}
```

---

### 2.6 Verify Decision Proof On-Chain
Queries the smart contract `getDecision(address)` and checks if the on-chain hash matches the computed decision hash.

- **Method**: `GET`
- **Path**: `/verify/{wallet_id}`
- **Response** (`200 OK`):
```json
{
  "wallet_address": "0x71C8363e3799173F35733365055170993001569B",
  "verified": true,
  "on_chain_hash": "0xe107584b2c85292bdbee61e8ccaf8ec1e0499dbb98840c0e42c04c1892940ce8",
  "expected_hash": "0xe107584b2c85292bdbee61e8ccaf8ec1e0499dbb98840c0e42c04c1892940ce8",
  "tx_hash": "0xe3c7049142a6c65a51b85dc4932d99b469d3acef7529b26a7b45db1de29542c7",
  "network": "Sepolia Testnet",
  "explorer_url": "https://sepolia.etherscan.io/tx/0xe3c7049142a6c65a51b85dc4932d99b469d3acef7529b26a7b45db1de29542c7",
  "timestamp": 1790408512,
  "message": null
}
```

---

## 3. TypeScript Interfaces for Frontend

```typescript
export interface WalletFeatures {
  repayment_history_score: number; // 0 to 100
  high_risk_tx_count: number;      // >= 0
  wallet_age_days: number;         // >= 0
  balance_stability_score: number; // 0 to 100
}

export interface ScoreResponse {
  wallet_address: string;
  risk_score: number;             // 0.0 to 100.0
  decision: "approve" | "deny";
  decision_hash: string;          // 0x... 32-byte hex
  features: WalletFeatures;
  quantum_model: string;
  timestamp: number;
}

export interface ExplainResponse {
  wallet_address: string;
  risk_score: number;
  decision: "approve" | "deny";
  base_risk_value: number;
  feature_contributions: {
    repayment_history: number;
    high_risk_tx: number;
    wallet_age: number;
    balance_stability: number;
  };
  input_features: Record<string, number>;
  cached: boolean;
}

export interface VerifyWriteResponse {
  wallet_address: string;
  decision_hash: string;
  tx_hash: string;
  block_number: number;
  network: string;
  status: "confirmed" | "failed";
  explorer_url: string;
  timestamp: number;
}

export interface VerifyReadResponse {
  wallet_address: string;
  verified: boolean;
  on_chain_hash: string | null;
  expected_hash: string | null;
  tx_hash?: string;
  network: string;
  explorer_url?: string;
  timestamp?: number;
}
```

---

## 4. Frontend Example Calls (JavaScript)

```javascript
const API_BASE = "http://localhost:8000";

// 1. Score a wallet
async function scoreWallet(walletAddress, features = null) {
  const body = { wallet_address: walletAddress };
  if (features) body.features = features;

  const res = await fetch(`${API_BASE}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return await res.json();
}

// 2. Fetch explanation
async function getExplanation(walletAddress) {
  const res = await fetch(`${API_BASE}/explain/${walletAddress}`);
  return await res.json();
}

// 3. Anchor proof on-chain
async function anchorOnChain(walletAddress) {
  const res = await fetch(`${API_BASE}/verify/${walletAddress}`, {
    method: "POST"
  });
  return await res.json();
}

// 4. Verify on-chain proof
async function verifyProof(walletAddress) {
  const res = await fetch(`${API_BASE}/verify/${walletAddress}`);
  return await res.json();
}
```
