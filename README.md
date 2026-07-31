# AI Repair Assistant Frontend

React diagnosis workbench for pre-departure and onsite repair analysis.

The current V1 connects only to the real Spring Boot API. It does not contain a
runtime mock-data path.

## Stack

- React 19
- TypeScript
- Vite
- Lucide icons

## Local start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Start the backend first, then open:

```text
http://localhost:5173/pre-departure
```

The Vite development server proxies `/api` to `http://localhost:8080`.

The implemented flow covers:

- natural-language problem input;
- A/B/C information completeness checks;
- blocking required-field feedback;
- a strong confirmation for missing recommended fields;
- a four-stage professional analysis overlay;
- zero to three ranked cause candidates;
- categorized traceable evidence;
- parts, tools and repair steps.

## Repository ownership

- This repository owns page layout, interaction state, loading/empty/error
  states, responsive behavior and API adaptation.
- Diagnosis rules, candidate scoring and stopping conditions stay in the
  backend.
- The authoritative API contract is
  `ai-repair-assistant-backend/docs/api/openapi.yaml`.
