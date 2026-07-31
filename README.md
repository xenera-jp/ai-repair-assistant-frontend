# AI Repair Assistant Frontend

React diagnosis workbench for pre-departure and onsite repair analysis.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- Lucide icons

## Local start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:5173`.

The default setting uses contract-aligned fixtures. Set `VITE_USE_MOCKS=false`
when the backend `POST /api/v1/problem-understandings` endpoint is ready.

## Repository ownership

- This repository owns page layout, interaction state, loading/empty/error
  states, responsive behavior and API adaptation.
- Diagnosis rules, candidate scoring and stopping conditions stay in the
  backend.
- The authoritative API contract is
  `ai-repair-assistant-backend/docs/api/openapi.yaml`.
