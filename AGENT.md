# AGENT.md

Guidance for AI coding agents working in this repository.

## Project

น้องโน้ต — Work Log AI: vanilla JS PWA (no build step) for logging daily work and summarising it with Gemini. Auth and data live in Supabase; `api/*.js` are Vercel Functions.

## Layout

- `public/` — the app (`index.html`, `app.js`, `styles.css`, `sw.js`)
- `api/summarize.js` — Gemini prompt per output format (`report`, `speech`, `chat`, `bullet`, `progress`)
- `supabase/migrations/` — schema changes
- `dist/` — ignored build output, don't edit

## Commands

- Run locally: `GEMINI_API_KEY=... npm start` → http://localhost:4173
- Check: `npm test` (syntax check only)

## Conventions

- Match the existing compact style in `app.js` and `styles.css`; UI text is Thai.
- Escape user text with `escapeHtml` before putting it in `innerHTML`.
- A new output format must be added in three places: the `#outputMode` select, the history filter buttons, and `formatGuide`/`instructions` in `api/summarize.js`.
- `sw.js` serves cached assets first, so hard-reload when testing changes.
