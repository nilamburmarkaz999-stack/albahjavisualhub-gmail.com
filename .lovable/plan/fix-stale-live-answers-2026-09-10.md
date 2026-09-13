# Fix stale live answers

## Changes

- Strengthen current office-holder detection in Malayalam and English.
- Rewrite live queries with the exact current date and an authoritative-source preference.
- Apply Firecrawl recency filtering and retain result publication dates when available.
- Instruct the AI to reject stale or conflicting results instead of guessing.
- Keep the existing voice-only interface unchanged.

## Verification

- Test the exact Kerala Chief Minister question through the live chat endpoint.
- Confirm Firecrawl runs before the AI and the answer uses fresh retrieved sources only.
