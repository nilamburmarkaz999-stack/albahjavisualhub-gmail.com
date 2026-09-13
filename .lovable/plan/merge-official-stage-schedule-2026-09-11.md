# Merge Official Stage Schedule

## Scope

- Preserve every existing festival and participant record.
- Replace the outdated “stage schedule unavailable” instruction with the uploaded official schedule status.
- Add all 44 stage programme entries from 26–27 September 2026, grouped by date and venue.
- Keep each programme’s category, start time, and source wording; record end times as unspecified.
- Add matching rules so schedule answers use exact official entries and never invent missing details.

## Validation

- Confirm the previous database content remains byte-for-byte unchanged outside the superseded stage-status text and insertion point.
- Check that every uploaded date, venue, programme, category, and time appears once.
- Scan the merged schedule for duplicate entries and verify the app still reads the same database file.

## Technical details

The schedule will be stored in `src/lib/thanafus-knowledge.txt`, which is already injected into the assistant’s official source-of-truth prompt.
