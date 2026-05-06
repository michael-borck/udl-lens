# UDL Lens

A web tool for Curtin University academics to audit unit assessments against the [UDL Guidelines 3.0](https://udlguidelines.cast.org/), framed around the Assessment 2030 (A2030) initiative.

Built as a prototype for an iSoLT grant collaboration with Luke (Teaching Support, Curtin University).

## What it does

1. **Add assessments** - describe your unit's assessments (Written Report, Portfolio, Interactive Oral, etc.) with optional brief upload (PDF or DOCX)
2. **Review checkpoints** - AI pre-fills a UDL rating for each checkpoint based on your brief; you verify or override each rating
3. **See results** - radar chart across 6 UDL dimensions, quick wins, longer-term improvements, and a downloadable PDF report

No login. No database. Session state only.

## Stack

- [Next.js 14](https://nextjs.org/) (App Router)
- TypeScript
- Tailwind CSS
- [Recharts](https://recharts.org/) - radar/spider chart
- [@react-pdf/renderer](https://react-pdf.org/) - client-side PDF generation
- [Claude API](https://www.anthropic.com/api) (`claude-sonnet-4-6`) - server-side only

## Getting started

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key - get one at console.anthropic.com |
| `ANTHROPIC_MODEL` | No | Default model for all routes (default: `claude-sonnet-4-6`) |
| `EXTRACT_MODEL` | No | Model for brief extraction - Haiku is fine and cheaper |
| `PREFILL_MODEL` | No | Model for checkpoint pre-fill - test Haiku vs Sonnet |
| `SUGGESTIONS_MODEL` | No | Model for suggestions - Sonnet recommended |

Per-route vars take precedence over `ANTHROPIC_MODEL`. Omit them to use the default.

## Deployment

**Node.js** (any VPS, Railway, Render, etc.):

```bash
npm run build
npm start
```

**Docker (VPS or any host):**

```bash
# 1. Grab the two files you need
curl -O https://raw.githubusercontent.com/michael-borck/udl-lens/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/michael-borck/udl-lens/main/.env.example

# 2. Add your API key
mv .env.example .env.local
nano .env.local   # set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run (pulls image automatically)
docker compose up -d
```

Open [http://your-server:3000](http://localhost:3000).

To update to the latest image: `docker compose pull && docker compose up -d`

No database, no migrations, no user accounts.

## License

MIT - see [LICENSE](LICENSE).
