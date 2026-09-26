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
| `/` | Hero / landing page |
| `/score` | Pick a sample wallet or enter an address |
| `/explain/[wallet]` | SHAP feature-contribution chart + audit |
| `/audit/[wallet]` | Standalone explanation audit report |
| `/verify/[wallet]` | Anchor + verify the decision on-chain |
| `/how-it-works` | Pipeline walkthrough |

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
