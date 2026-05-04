# CLAUDE.md — UDL Lens

Standalone UDL assessment tool for Curtin University, built as a prototype for an iSoLT grant collaboration with Luke (Teaching Support). See full design spec: `docs/superpowers/specs/2026-05-04-udl-lens-design.md`

## What this is

A three-screen web app where Curtin academics audit their unit assessments against UDL Guidelines 3.0, framed around the Assessment 2030 (A2030) initiative. AI (Claude) pre-fills checkpoint ratings from uploaded assignment briefs; the user verifies or overrides each one; the output is a radar chart + quick wins + PDF report.

## Stack

- **Next.js 14** (App Router) — framework + API routes
- **TypeScript** — throughout, strict
- **Tailwind CSS** — custom theme, no component library
- **Recharts** — radar/spider chart
- **@react-pdf/renderer** — client-side PDF generation
- **Claude API** (`claude-sonnet-4-6`) — server-side only via API routes
- **Fonts**: Fraunces (display) + Plus Jakarta Sans (UI) — loaded from Google Fonts

## Design direction

Warm cream background (`#FAF7F2`), deep teal primary (`#1B3A4B`), terracotta accent (`#C96B2F`). Editorial and approachable — not generic SaaS. See mockups in `.superpowers/brainstorm/` for the results screen and checkpoint review screen.

## Key decisions

- **No auth, no database** — session state only. One env var: `ANTHROPIC_API_KEY`.
- **A2030-specific** — Lane 1 (secure) / Lane 2 (non-secure) assessment structure. Curtin context only, not generic UDL.
- **Per-assessment input** — users add each assessment separately with optional brief upload (PDF/DOCX). Typically 3 assessments per unit.
- **AI pre-fills, human verifies** — Claude rates each checkpoint + gives reasoning; user confirms or overrides.
- **UDL data in JSON** — `/data/udl-checkpoints.json` maps assessment types → checkpoints → harmful/helpful practices. Extend here without touching app code.

## Running locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev
```

## Deployment

```bash
npm run build && npm start
```

Any Node.js host. No database, no migrations.

## Development rules

- TypeScript everywhere — no `.js` or `.jsx` files
- No `any` types without justification
- Tailwind for all styling — no inline styles except in Recharts/react-pdf where unavoidable
- All Claude API calls in `/app/api/` route handlers — never client-side
- Keep components small and focused
