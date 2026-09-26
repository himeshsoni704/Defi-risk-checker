# DeFi Risk Checker — Frontend

A multi-page Next.js frontend for the DeFi Risk Checker backend. All data comes
from the API; the typed client lives in `lib/api.ts` and `lib/types.ts`.

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

## Running

Start the backend first (from the repo root):

```bash
uvicorn api.main:app --port 8000
```

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The app runs at http://localhost:3000 and talks to the backend at
http://localhost:8000 by default. To point it elsewhere, copy
`.env.local.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE`.

> **Use `npm run dev` for local work.** It compiles on the fly and needs no
> build step. Everything the app does works in this mode.

## Production

The production server (`npm run start`) only works **after** a successful
build — it does not compile anything by itself. Running `npm run start`
before `npm run build` fails with
`Could not find a production build in the '.next' directory`.

```bash
npm run build   # must succeed first
npm run start
```
