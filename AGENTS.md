# Thanafus AI — Base44 Dev Environment

## Overview
Voice-first conversational AI assistant for Thanafus Art Fest 2026. Built with
TanStack Start (SSR) + Vite + React 19. Uses Bun for package management.

## Running the app
```bash
docker compose -f docker-compose.base44.yml up -d
```
- Web entry point: http://localhost:3000
- Dev server: `vite dev` (live reload via Vite HMR)
- Health check: `curl http://localhost:3000/`

## Architecture
- **Single-origin SSR**: TanStack Start handles both frontend and API routes
  (`/api/chat`, `/api/tts`) in one Vite dev server on port 3000.
- **No database in compose**: Supabase is an external managed service; credentials
  are delivered via `/run/base44/app.env`.
- **Lazy clients**: Supabase and Gemini clients are lazily initialized — the app
  renders the main page without any credentials. Credentials are only needed when
  the user interacts (chat → Gemini, TTS → ElevenLabs, auth → Supabase).

## External credentials (all optional for boot)
| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Core chat AI (Google Gemini) |
| `ELEVENLABS_API_KEY` | Malayalam/Arabic TTS |
| `MALAYALAM_VOICE_ID` | ElevenLabs voice ID |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Auth (managed Supabase) |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Auth |
| `FIRECRAWL_API_KEY` | Live web search for current-events questions |

Placeholders in `.env.base44-defaults` allow boot without credentials; real values
in `/run/base44/app.env` override them.

## Key files
- `src/routes/index.tsx` — main voice assistant UI
- `src/routes/api/chat.ts` — Gemini chat endpoint
- `src/routes/api/tts.ts` — ElevenLabs TTS endpoint
- `src/lib/gemini.server.ts` — Gemini client + system prompt
- `src/lib/thanafus-knowledge.txt` — festival knowledge base (injected into prompt)
- `src/integrations/supabase/` — Supabase auth integration
- `vite.config.ts` — uses `@lovable.dev/vite-tanstack-config` (handles port/host/plugins)

## Notes
- The `@lovable.dev/vite-tanstack-config` package manages Vite plugins, port, host,
  and sandbox detection — do not manually add those to `vite.config.ts`.
- `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` is passed bare in compose environment
  so Vite accepts the preview's external hostname.
