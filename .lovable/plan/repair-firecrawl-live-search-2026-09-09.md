# Repair Firecrawl live search

## Changes

- Verify the linked Firecrawl connection exposes the required server environment names and uses gateway mode.
- Replace the Firecrawl helper with a strictly server-only implementation that logs `FIRECRAWL REQUEST`, `FIRECRAWL RESPONSE`, `SEARCH RESULTS COUNT`, and `FIRECRAWL ERRORS` without logging secrets.
- Expand reliable live-query detection for latest/current/today/recent/live news, government, weather, sports, events, prices, and videos in English, Malayalam, and Arabic.
- Normalize Firecrawl Search responses into title, URL, and relevant content; keep Scrape for explicit URLs.
- Update the chat endpoint so live questions cannot reach the AI without web results. On lookup failure, return the explicit live-information error instead of allowing static model knowledge.
- Pass retrieved web context and the user question to the AI with a strict web-only instruction, logging `AI REQUEST WITH WEB CONTEXT` first.
- Preserve the existing screen, voice mode, languages, database, and normal-question behavior.

## Verification

- Test `What is the latest news in Kerala today?` through the running `/api/chat` endpoint.
- Test `Who is the current Chief Minister of Kerala?` through the same endpoint.
- Confirm server logs prove Firecrawl completed and returned results before each AI request.
- Confirm no Firecrawl secret appears in browser-facing code or responses.

## Technical details

- Firecrawl remains behind the TanStack server route and connector gateway.
- `FIRECRAWL_API_KEY` and `LOVABLE_API_KEY` are read only inside server runtime functions.
- Failed live retrieval returns a non-success response with `I couldn't retrieve live web information right now.`
