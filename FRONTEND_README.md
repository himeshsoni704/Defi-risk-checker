# DeFi Risk Checker - Frontend Development Guide

This guide helps you build the frontend for the DeFi Risk Checker backend API. The backend combines Quantum Machine Learning, Explainable AI, and Blockchain Proof-of-Decision for DeFi credit risk scoring.

---

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
cd defi-risk-checker
source .venv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at **http://localhost:8000**

### 2. Test the API
Open **http://localhost:8000/docs** to explore all endpoints interactively using Swagger UI.

---

## 📡 API Endpoints

### Base URL
```
http://localhost:8000
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Check backend health and system status |
| `GET` | `/wallets?limit=10` | Get sample wallet addresses for demo dropdowns |
| `POST` | `/score` | Get quantum ML risk score (0-100) for a wallet |
| `GET` | `/explain/{wallet_id}` | Get SHAP feature contribution breakdown |
| `POST` | `/verify/{wallet_id}` | Anchor decision proof on-chain |
| `GET` | `/verify/{wallet_id}` | Verify on-chain decision proof |

---

## 🔧 API Usage Examples

### 1. Get Sample Wallets (for demo dropdown)
```javascript
const response = await fetch('http://localhost:8000/wallets?limit=10');
const wallets = await response.json();
// Returns array of wallet addresses with their features
```

### 2. Score a Wallet
```javascript
// Option A: Use wallet address from dataset
const response = await fetch('http://localhost:8000/score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet_address: '0xABA6055C4bAA05fbc0f7Bc699019fEf12Fc61d33'
  })
});

// Option B: Submit custom features
const response = await fetch('http://localhost:8000/score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet_address: '0x71C8363e3799173F35733365055170993001569B',
    features: {
      repayment_history_score: 85.0,
      high_risk_tx_count: 1,
      wallet_age_days: 450,
      balance_stability_score: 80.0
    }
  })
});

const result = await response.json();
// Returns: { risk_score, decision, decision_hash, features, quantum_model, timestamp }
```

### 3. Get Explanation (XAI)
```javascript
const response = await fetch('http://localhost:8000/explain/0x71C8363e3799173F35733365055170993001569B');
const explanation = await response.json();
// Returns: { risk_score, decision, base_risk_value, feature_contributions, input_features, cached }
```

### 4. Anchor Decision On-Chain
```javascript
const response = await fetch('http://localhost:8000/verify/0x71C8363e3799173F35733365055170993001569B', {
  method: 'POST'
});
const result = await response.json();
// Returns: { decision_hash, tx_hash, block_number, network, status, explorer_url, timestamp }
```

### 5. Verify On-Chain Decision
```javascript
const response = await fetch('http://localhost:8000/verify/0x71C8363e3799173F35733365055170993001569B');
const result = await response.json();
// Returns: { verified, on_chain_hash, expected_hash, tx_hash, network, explorer_url, timestamp }
```

---

## 📊 Data Models

### Wallet Features
```typescript
interface WalletFeatures {
  repayment_history_score: number;  // 0 to 100
  high_risk_tx_count: number;       // >= 0
  wallet_age_days: number;          // >= 0
  balance_stability_score: number;  // 0 to 100
}
```

### Score Response
```typescript
interface ScoreResponse {
  wallet_address: string;
  risk_score: number;              // 0.0 to 100.0
  decision: "approve" | "deny";    // < 50 = approve, >= 50 = deny
  decision_hash: string;           // 0x... 32-byte hex
  features: WalletFeatures;
  quantum_model: string;
  timestamp: number;
}
```

### Explanation Response
```typescript
interface ExplainResponse {
  wallet_address: string;
  risk_score: number;
  decision: "approve" | "deny";
  base_risk_value: number;                    // Base risk before features
  feature_contributions: {
    repayment_history: number;                 // Negative = reduces risk
    high_risk_tx: number;                      // Positive = increases risk
    wallet_age: number;
    balance_stability: number;
  };
  input_features: Record<string, number>;
  cached: boolean;
}
```

### Verify Response
```typescript
interface VerifyResponse {
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

## 🎨 UI/UX Suggestions

### Recommended Flow
1. **Wallet Input**: Text input for wallet address + dropdown with sample wallets
2. **Score Display**: Large risk score (0-100) with approve/deny badge
3. **Explanation Chart**: Waterfall or bar chart showing feature contributions
   - Green bars for negative contributions (risk-reducing)
   - Red bars for positive contributions (risk-increasing)
4. **Blockchain Verification**: Show on-chain status with link to block explorer
5. **Real-time Updates**: Call endpoints in sequence as user progresses

### Color Coding
- **Green**: Risk score < 50 (approve)
- **Red**: Risk score >= 50 (deny)
- **Feature contributions**: Green (negative), Red (positive)

### Demo Wallets (Pre-tested)
Use these for demo purposes:
- **Safe**: `0x9F243d157AFfD94744a0a866b3d02Fecc9D1BdB7` (score: 29.9)
- **High Risk**: `0x2691077D2b9CF140fde1c746bc4Bd5E66A8f29d8` (score: 85.3)
- **Borderline**: `0x505FeaBF8E6B7467845cC58fD1a01f4f6011B837` (score: 50.0)

---

## ⚠️ Important Notes

### Web3 Mode
The backend currently runs in **Simulated Provider Mode** (not real Sepolia testnet). This is perfect for development and demos since it doesn't require gas or testnet setup. The simulated provider behaves exactly like real blockchain for frontend purposes.

### Response Times
- `/score`: ~0.5-1.2 seconds (quantum ML inference)
- `/explain`: ~0.05 seconds (cached XAI)
- `/verify` (POST/GET): ~0.05 seconds (simulated blockchain)

### Error Handling
All endpoints return 200 OK with proper error messages in the response body. Handle errors by checking response structure.

---

## 🛠️ Tech Stack Suggestions

### Recommended Frontend Frameworks
- **React + TypeScript**: Most common, great ecosystem
- **Vue.js + TypeScript**: Simpler learning curve
- **Next.js**: If you want SSR capabilities
- **Vite**: Fast build tool for any framework

### UI Libraries
- **Chart.js** or **Recharts**: For feature contribution charts
- **Tailwind CSS**: For styling
- **shadcn/ui**: Modern React components

---

## 📞 Support

For backend questions or API issues, contact the backend developer. The complete API specification is available in `API_CONTRACT.md` in the backend repository.

---

## 🎯 Success Criteria

Your frontend should:
1. ✅ Allow wallet address input (manual or from dropdown)
2. ✅ Display risk score with approve/deny decision
3. ✅ Show feature contribution breakdown visually
4. ✅ Display blockchain verification status
5. ✅ Handle loading states and errors gracefully
6. ✅ Work with the simulated blockchain provider

Good luck with the frontend development! 🚀
