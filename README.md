# 🚀 Momentum — Personal Life OS

Track your whole day in one place: routine, work, workouts, hydration, protein, food, and body composition.

## Run it

**Anywhere (permanent URL):** https://johnbariga.github.io/momentum-tracker/ — works on any device, including mobile data. Scan `phone-qr.png` with your phone camera to open it.

**On this PC (local):** double-click **`Start Tracker.bat`** — starts a local server at http://localhost:8317.

> Each address keeps its own browser data. Pick one address per device and stick to it — or connect the same Supabase project on all of them (Settings) so everything syncs to one database. Use Settings → Export/Import backup to move existing data between addresses.

## Pages

| Page | What it does |
|---|---|
| ⚡ Dashboard | Budget-first: calorie budget leads, then water/protein/fiber/routine rings. **Deficit streak 🔥, cheat budget 🍕, and water streak** strip; quick log; today's meetings; 7-day chart |
| ☀️ My Day | Your morning-to-sleep routine + that day's meetings in one timeline; mark the day as Work / Rest / Holiday |
| 💼 Work | **Standup draft** that writes itself from your logged milestone steps + today's meetings (one-tap copy); milestones with step-by-step progress logs; meetings: one-time, daily, Mon–Fri, weekly, or **custom weekdays** (e.g. Wed + Fri) |
| 💪 Fitness | Log abs / legs / arms exercises with sets × reps |
| 💧 Hydration | Waterllama-style cup, 3 L goal, water + buttermilk |
| 🥚 Protein | Tap foods (egg = 6g, chicken 100g = 31g, …) or custom entries; auto totals |
| 🌾 Fiber | Same quick-add system for fiber (oats, fruits, dals, seeds…), 30 g default goal |
| 🔥 Calories | **Quick log**: type "2 roti + dal + 100g chicken" and log it in one tap (grams convert to servings automatically). Calorie engine + a **goal-weight projection** ("74 kg by Sep 28") from your weigh-ins |
| 🥗 Nutrition | Eat/avoid guide, meal log with 🍕 cheat-meal marking + monthly green/yellow/red cheat meter, US Navy body-fat calculator, weight & fat trends |
| 📈 History | Calendar of every day (click any day to open it), rest/holiday markers, cheat-meal dots, 30-day trends, all-time stats |
| ⚙️ Settings | Name, goals (incl. goal weight), water reminders, Supabase cloud sync, JSON backup/restore |

### Cheat-meal zones (per month)
🟢 **Green** 0–2 · 🟡 **Yellow** 3–4 · 🔴 **Red** 5+ — the meter is on the Nutrition page and in History.

### Rest days & holidays
Mark them at the top of My Day. On those days a missing workout doesn't hurt your day score, and they show 😴 / 🎉 on the History calendar.

## Reminders & using it on your phone

**On this PC:** Settings → Water reminders → Turn on (allow notifications). You'll get a nudge if you haven't logged a drink in your chosen interval (works while the tab is open, even minimized), and it stops once you hit the goal.

**On your iPhone:**
1. Open the Camera and scan `phone-qr.png` (in this folder), or type **https://johnbariga.github.io/momentum-tracker/** in Safari. Works anywhere — Wi-Fi or mobile data, PC on or off.
2. In Safari tap **Share (□↑) → Add to Home Screen** → it installs as **Momentum** with the water-drop icon and opens full-screen like a real app (works offline after the first load).
3. **Important:** each device has its own separate data until you connect the **same Supabase project** in Settings on *both* devices — then everything syncs automatically.

Notes:
- **Reminders on iPhone:** iOS only allows web-app notifications for Home-Screen apps (iOS 16.4+) and support is limited — for reliable water nudges on the phone, use the built-in **Reminders** app (e.g. "every 90 minutes, 8:00–22:00") until push support is added here.
- True push notifications (app closed) would need a push service (OneSignal / Supabase Edge Functions) on top of the existing service worker — a possible future upgrade.

**Publishing updates:** the app is hosted from the `momentum-tracker` GitHub repo. After changing files here, run `git add -A && git commit -m "update" && git push` in this folder (or ask Claude) — the site updates in ~1 minute.

## Cloud sync with Supabase (v2 dimensional schema)

The database follows a Kimball dimensional design: normalized operational tables (`consumption_log`, `exercise_log`, `schedule_log`, `day_info`, `meetings`, `milestones`, `body_log`, `commute_log`, …) as the OLTP source of truth, plus star-schema **views** (`fact_daily_summary`, `fact_consumption`, `fact_exercise_set`, `fact_schedule_event`, `dim_date`, `dim_food`, …) for analytics — e.g. `select location, avg(protein_g) from fact_daily_summary group by location;`.

Setup / upgrade:
1. Create a free project at [supabase.com](https://supabase.com) (skip if you have one).
2. Open **SQL Editor**, paste the whole of **`supabase-migration-v2.sql`** (in this folder / repo), *Run*. It creates everything and migrates v1 data automatically. Safe to re-run.
3. In Momentum's **Settings**, paste your Project URL + anon key → **Connect & sync**. Use **📱 Copy phone connect link** for other devices.

## v4 features

- **🔥 Calories** — Mifflin-St Jeor BMR → TDEE → deficit target; one food entry updates calories, protein, fiber and water together; live deficit + weekly fat-loss projection; personal non-veg deficit meal plan.
- **⏰ Adaptive routine** — enter your real wake-up time and flexible items shift while anchored items (office, meetings, commute) stay put; conflicts resolve like a human would (workout won't be scheduled inside your standup).
- **🧭 Timezones** — meetings anchored to your home/company timezone convert automatically when you travel (8:30 CT standup shows as 6:30 PT in Seattle).
- **💼 Office days** — Tue/Thu (configurable) get commute blocks (40 min each way) in the timeline and the database.

## Backup

Settings → **Export backup (JSON)** any time. Import restores everything.
