# DeFi Risk Checker — Frontend

A multi-page Next.js frontend for the DeFi Risk Checker backend.

## Pages

| Route | Description |
|---|---|
| `/` | Hero / landing page explaining the four-layer pipeline |
| `/score` | Pick a sample wallet or enter an address and run the pipeline |
| `/explain/[wallet]` | SHAP feature-contribution chart + explanation audit |
| `/audit/[wallet]` | Standalone explanation audit report |
| `/verify/[wallet]` | Anchor the decision hash on-chain and verify it |
| `/how-it-works` | Walkthrough of the full pipeline |

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
