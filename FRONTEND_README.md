# DeFi Risk Checker — Frontend

A ready-to-run **Next.js** frontend lives in [`frontend/`](./frontend). See
`frontend/README.md` for details.

## Quick start

Start the backend first (from the repo root):

```bash
uvicorn api.main:app --port 8000
```

Then the frontend:

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

The frontend talks to `http://localhost:8000` by default. To change it, copy
`frontend/.env.local.example` to `frontend/.env.local` and set
`NEXT_PUBLIC_API_BASE`.

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard: quick analysis, system status (`/health`), sample wallets, recent analyses |
| `/assess?wallet=…` | Risk assessment: score, decision, all 12 features, model provenance, scenario mode |
| `/explain?wallet=…` | SHAP waterfall and contributions, key drivers, optional Gemini explanation |
| `/audit?wallet=…` | Explanation audit: faithfulness, stability, sensitivity and how the verdict is formed |
| `/verify?wallet=…` | Hash comparison, anchoring with confirmation, canonical record |
| `/models` | QSVC vs. classical baselines from `/compare` |

A guided tour starts on the first visit and can be reopened from the top bar.
Old links (`/explain/<wallet>`, `/audit/<wallet>`, `/verify/<wallet>`, `/score`,
`/how-it-works`) redirect to the new pages.

## For your own client

The full REST contract is in [`API_CONTRACT.md`](./API_CONTRACT.md). The
important endpoints:

- `GET /health` — model metadata and provider status
- `GET /wallets?limit=10` — sample wallets for a picker
- `POST /score` — score a wallet
- `GET /explain/{wallet}` — SHAP attributions + audit
- `GET /audit/{wallet}` — audit only
- `POST /verify/{wallet}` / `GET /verify/{wallet}` — anchor / verify on-chain

### Response-time guidance

- `/health`, `/wallets`: instant
- `/score`: ~1–2 seconds (quantum simulator + SHAP + audit)
- `/explain`, `/audit`: ~1 second first time, faster once cached
- `/verify`: instant (simulated provider)

Handle errors by checking the HTTP status and the `{ "detail": … }` body.
