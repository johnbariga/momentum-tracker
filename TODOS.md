# TODOS — Momentum

Deferred items with context. Source of truth for "later" — if it's not here, it doesn't exist.

## Shipped (2026-07-04, always-on-companion phase — client slice)

- [x] **E4** deficit streak + cheat budget on dashboard
- [x] **E1** standup draft generator on Work tab
- [x] **E2** measured-scale goal-weight projection
- [x] **C1** text quick-parse food logging (local FOOD_CATALOG matcher)

## Blocked on John's Supabase Edge Function setup (server spine C0)

These are fully specced in the CEO/eng-reviewed plan but need a deployed
`claude-proxy` + `push-send` Edge Function, pg_cron, VAPID keys, and an
Anthropic API key stored as Supabase secrets. Cannot be built from the static
GitHub Pages client alone.

- [ ] **C0** server spine: Supabase Edge Functions (claude-proxy + push-send),
  pg_cron schedule, `push_subscriptions` + `sent_log` tables, VAPID keys.
- [ ] **C3** web push notifications (morning brief, Sunday coach push, water
  nudges that fire with the app closed). Depends on C0.
- [ ] **C4a/C4b** AI food parsing (natural-language + photo) via claude-proxy —
  the fallback for C1's unrecognized foods. Depends on C0.
- [ ] **C2** weekly insight engine + Sunday coach note (template math over the
  star views; on-app-open version is pure client, the Sunday *push* needs C0).
- [ ] **E5** meeting-aware reminder suppression (server-side, evaluated in
  push-send against synced timeline). Depends on C0.
- [ ] **T2** extract shared `core.js` (eng decision 1A) — do this when C0 work
  starts so the Edge Functions reuse the client's parser/streak/suppression
  logic instead of duplicating it. Not needed for the pure-client slice above.
- [ ] **5 hardening items** from the eng review's outside voice (unresolved,
  each recommended "accept"): timezone auto-detect on app open; 1-minute cron
  with an "is it 7:50 local?" gate; sync-freshness guard on E5; late-brief
  "(late)" delivery instead of silent drop; **spike one real push to the iPhone
  before building the rest of C0** (OV7 — cheapest de-risk).

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
