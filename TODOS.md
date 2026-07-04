# TODOS — Momentum

Deferred items with context. Source of truth for "later" — if it's not here, it doesn't exist.

## Deferred from CEO review (2026-07-04, always-on-companion plan)

- [ ] **Meal photo diary (E3)** — persist meal photos (Supabase Storage, free
  tier) and show thumbnails in the log + weekly review. C4b already parses
  photos transiently (never stored); E3 adds persistence and display — an
  independent, later deliverable.

## Operational cleanup

- [ ] **Drop v1 tables** (`tracker_days`, `tracker_kv`) from Supabase once both
  devices have been confirmed running v4 sync for a full week. They are dead
  weight after migration; keep until then as a rollback safety net.
  SQL: `drop table tracker_days; drop table tracker_kv;`

- [ ] **Regenerate `phone-qr.png`** if the app URL ever changes (it encodes
  https://johnbariga.github.io/momentum-tracker/).

## Revisit conditions (not scheduled)

- **Voice logging** — skipped (iOS Web Speech support too patchy). Revisit only
  if Safari ships reliable SpeechRecognition on iOS.
