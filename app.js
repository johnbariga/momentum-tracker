/* ============ Momentum — Personal Life OS ============ */
"use strict";

const STORE_KEY = "lifetracker-v1";
const SYNC_KEY = "lifetracker-sync";

/* ================= Presets ================= */
const DEFAULT_ROUTINE = [
  { time: "06:00", text: "Wake up" },
  { time: "06:10", text: "Drink a glass of water" },
  { time: "06:30", text: "Morning exercise / workout" },
  { time: "07:30", text: "Bath & get ready" },
  { time: "08:15", text: "Breakfast" },
  { time: "09:00", text: "Office — start work" },
  { time: "13:00", text: "Lunch" },
  { time: "16:30", text: "Evening snack + water check" },
  { time: "18:00", text: "Office — wrap up work" },
  { time: "19:00", text: "Walk / evening exercise" },
  { time: "20:30", text: "Dinner" },
  { time: "21:30", text: "Plan tomorrow + log the day" },
  { time: "22:30", text: "Sleep" },
];

const PROTEIN_FOODS = [
  { name: "Egg (whole)", unit: "egg", protein: 6 },
  { name: "Egg white", unit: "egg white", protein: 3.6 },
  { name: "Chicken breast", unit: "100g", protein: 31 },
  { name: "Fish", unit: "100g", protein: 22 },
  { name: "Paneer", unit: "100g", protein: 18 },
  { name: "Whey protein", unit: "scoop", protein: 24 },
  { name: "Milk", unit: "glass (250ml)", protein: 8 },
  { name: "Curd", unit: "100g", protein: 4 },
  { name: "Dal (cooked)", unit: "100g", protein: 9 },
  { name: "Soya chunks", unit: "50g dry", protein: 26 },
  { name: "Peanuts", unit: "30g", protein: 7.5 },
  { name: "Buttermilk", unit: "glass (250ml)", protein: 2 },
];

const FIBER_FOODS = [
  { name: "Oats (dry)", unit: "40g", fiber: 4 },
  { name: "Apple", unit: "medium", fiber: 4.4 },
  { name: "Banana", unit: "medium", fiber: 3.1 },
  { name: "Orange", unit: "medium", fiber: 3 },
  { name: "Guava", unit: "medium", fiber: 5.4 },
  { name: "Dal (cooked)", unit: "100g", fiber: 8 },
  { name: "Rajma (cooked)", unit: "100g", fiber: 6.4 },
  { name: "Chana (cooked)", unit: "100g", fiber: 7.6 },
  { name: "Roti / chapati", unit: "roti", fiber: 2 },
  { name: "Brown rice (cooked)", unit: "100g", fiber: 1.8 },
  { name: "Broccoli", unit: "100g", fiber: 2.6 },
  { name: "Carrot", unit: "100g", fiber: 2.8 },
  { name: "Spinach (cooked)", unit: "100g", fiber: 2.4 },
  { name: "Sweet potato", unit: "100g", fiber: 3 },
  { name: "Chia seeds", unit: "tbsp", fiber: 4.1 },
  { name: "Flax seeds", unit: "tbsp", fiber: 2.8 },
  { name: "Almonds", unit: "30g", fiber: 3.5 },
  { name: "Peanuts", unit: "30g", fiber: 2.5 },
];

const EXERCISES = {
  abs:  ["Crunches", "Leg raises", "Plank (secs)", "Russian twists", "Bicycle crunches", "Mountain climbers"],
  legs: ["Squats", "Lunges", "Calf raises", "Glute bridges", "Jump squats", "Wall sit (secs)"],
  arms: ["Push-ups", "Diamond push-ups", "Tricep dips", "Bicep curls", "Shoulder press", "Pike push-ups"],
};
const CAT_META = {
  abs:  { label: "Abs",  emoji: "🔥" },
  legs: { label: "Legs", emoji: "🦵" },
  arms: { label: "Arms", emoji: "💪" },
};

const DEFAULT_EAT = ["Eggs", "Chicken breast", "Fish", "Paneer", "Dal / lentils", "Green vegetables", "Fruits", "Oats", "Brown rice (limited)", "Curd", "Buttermilk", "Nuts (small handful)"];
const DEFAULT_AVOID = ["Sugary drinks & sodas", "Deep fried food", "Maida / white bread", "Sweets & desserts", "Chips & packaged snacks", "Excess white rice", "Late night snacking", "Alcohol"];

const SETUP_SQL = `-- Momentum tracker — run this once in Supabase (SQL Editor)
create table if not exists tracker_days (
  date text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists tracker_kv (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table tracker_days enable row level security;
alter table tracker_kv enable row level security;
-- Personal single-user app: allow access with the anon key.
create policy "personal_days" on tracker_days for all using (true) with check (true);
create policy "personal_kv" on tracker_kv for all using (true) with check (true);`;

/* ================= State ================= */
let db = null;
let currentDate = todayStr();
let currentPage = "dashboard";
let exCat = "abs";
let exPreset = null;
let drinkType = "water";
let bfGender = "male";
let histMonth = currentDate.slice(0, 7); // "YYYY-MM"

const sync = {
  config: null,          // {url, key}
  client: null,
  status: "off",         // off | connecting | ok | error
  message: "",
  lastSync: null,
  dirty: new Set(),
  timer: null,
};

/* ================= Utils ================= */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function dateObj(dateStr) { const [y, m, d] = dateStr.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDate(dateStr) {
  return dateObj(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(dateStr) {
  return dateObj(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function shiftDate(dateStr, delta) {
  const d = dateObj(dateStr); d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}
function toast(msg, type = "ok") {
  const wrap = document.getElementById("toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ================= Persistence ================= */
function defaultDb() {
  return {
    days: {},
    work: { milestones: [], meetings: [] },
    settings: {
      userName: "John",
      waterGoal: 3000,
      proteinGoal: 120,
      fiberGoal: 30,
      reminders: { water: false, interval: 90, start: "08:00", end: "22:00" },
      routineTemplate: DEFAULT_ROUTINE.map(r => ({ ...r })),
      eatList: [...DEFAULT_EAT],
      avoidList: [...DEFAULT_AVOID],
    },
    body: [],
    meta: {}, // scope -> last-updated ms (for cloud sync LWW)
  };
}

function load() {
  db = defaultDb();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      db.days = saved.days || {};
      db.work = saved.work || db.work;
      db.work.milestones = db.work.milestones || [];
      db.work.meetings = (db.work.meetings || []).map(m => ({ repeat: "none", ...m }));
      db.settings = Object.assign(db.settings, saved.settings || {});
      db.body = saved.body || [];
      db.meta = saved.meta || {};
    }
  } catch (e) { console.error("load failed", e); }
  try { sync.config = JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); } catch (e) { sync.config = null; }
}

function persistLocal() { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }

/* save with a sync scope: "day" (current date), "day:YYYY-MM-DD", "work", "settings", "body" */
function save(scope = "day") {
  const key = scope === "day" ? `day:${currentDate}` : scope;
  db.meta[key] = Date.now();
  persistLocal();
  queuePush(key);
}

function getDay(dateStr) {
  if (!db.days[dateStr]) {
    db.days[dateStr] = {
      routine: db.settings.routineTemplate.map(r => ({ id: uid(), time: r.time, text: r.text, done: false })),
      water: [], protein: [], fiber: [], exercises: [], meals: [], dayType: "normal",
    };
  }
  const day = db.days[dateStr];
  ["routine", "water", "protein", "fiber", "exercises", "meals"].forEach(k => { day[k] = day[k] || []; });
  day.dayType = day.dayType || "normal";
  return day;
}
/* read-only peek — does NOT create the day (for history/stats) */
function peekDay(dateStr) { return db.days[dateStr] || null; }

/* ================= Domain calculations ================= */
function waterTotal(day) { return day ? day.water.reduce((s, w) => s + w.ml, 0) : 0; }
function proteinTotal(day) { return day ? Math.round(day.protein.reduce((s, p) => s + p.grams, 0) * 10) / 10 : 0; }
function fiberTotal(day) { return day && day.fiber ? Math.round(day.fiber.reduce((s, p) => s + p.grams, 0) * 10) / 10 : 0; }
function cheatCountForMonth(ym) {
  let n = 0;
  for (const [d, day] of Object.entries(db.days)) if (d.startsWith(ym)) n += (day.meals || []).filter(m => m.cheat).length;
  return n;
}
function cheatZone(n) {
  if (n <= 2) return { label: "Green zone", cls: "green", color: "var(--green)", msg: "Disciplined — cheat meals well under control." };
  if (n <= 4) return { label: "Yellow zone", cls: "amber", color: "var(--amber)", msg: "Careful — you're close to the monthly limit." };
  return { label: "Red zone", cls: "red", color: "var(--red)", msg: "Too many cheat meals this month — time to tighten up!" };
}
const DAY_TYPES = { normal: { label: "Work day", emoji: "🏢" }, rest: { label: "Rest day", emoji: "😴" }, holiday: { label: "Holiday", emoji: "🎉" } };
function routineProgress(day) {
  if (!day || !day.routine.length) return 0;
  return Math.round(day.routine.filter(r => r.done).length / day.routine.length * 100);
}
function dayScore(dateStr) {
  const day = peekDay(dateStr);
  if (!day) return null;
  const parts = [
    Math.min(1, waterTotal(day) / db.settings.waterGoal),
    Math.min(1, proteinTotal(day) / db.settings.proteinGoal),
    routineProgress(day) / 100,
  ];
  // rest days & holidays don't expect a workout
  if (!day.dayType || day.dayType === "normal") parts.push(day.exercises.length > 0 ? 1 : 0);
  return Math.round(parts.reduce((s, v) => s + v, 0) / parts.length * 100);
}
function waterStreak() {
  let streak = 0;
  let d = todayStr();
  // today counts if goal already met; otherwise streak is measured up to yesterday
  if (waterTotal(peekDay(d)) < db.settings.waterGoal) d = shiftDate(d, -1);
  while (waterTotal(peekDay(d)) >= db.settings.waterGoal) { streak++; d = shiftDate(d, -1); }
  return streak;
}

function meetingOccursOn(mt, dateStr) {
  if (mt.repeat === "custom") {
    if (dateStr < mt.date) return false;
    return (mt.days || []).includes(dateObj(dateStr).getDay());
  }
  if (mt.date === dateStr) return true;
  if (!mt.repeat || mt.repeat === "none") return false;
  if (dateStr < mt.date) return false;
  const dow = dateObj(dateStr).getDay();
  if (mt.repeat === "daily") return true;
  if (mt.repeat === "weekdays") return dow >= 1 && dow <= 5;
  if (mt.repeat === "weekly") return dow === dateObj(mt.date).getDay();
  return false;
}
function meetingsForDate(dateStr) {
  return db.work.meetings.filter(m => meetingOccursOn(m, dateStr))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function repeatLabel(mt) {
  if (!mt.repeat || mt.repeat === "none") return "";
  if (mt.repeat === "daily") return "Daily";
  if (mt.repeat === "weekdays") return "Mon–Fri";
  if (mt.repeat === "weekly") return "Weekly";
  if (mt.repeat === "custom") {
    return (mt.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DOW_SHORT[d]).join(", ");
  }
  return "";
}
function repeatOptionsHtml(id) {
  return `<select id="${id}" style="width:150px">
    <option value="none">One-time</option>
    <option value="daily">Daily</option>
    <option value="weekdays">Mon–Fri</option>
    <option value="weekly">Weekly</option>
    <option value="custom">Custom days…</option>
  </select>`;
}
function dayPickerHtml(id) {
  return `<div class="dow-row" id="${id}" style="display:none">
    ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="dow-chip"><input type="checkbox" value="${d}"><span>${DOW_SHORT[d]}</span></label>`).join("")}
  </div>`;
}
function pickedDays(pickerId) {
  return [...document.querySelectorAll(`#${pickerId} input:checked`)].map(i => +i.value);
}

/* Body fat — US Navy method (measurements in cm) */
function navyBodyFat(gender, heightCm, neckCm, waistCm, hipCm) {
  const log10 = Math.log10;
  let bf;
  if (gender === "male") {
    bf = 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450;
  } else {
    bf = 495 / (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.22100 * log10(heightCm)) - 450;
  }
  return Math.round(bf * 10) / 10;
}
function bfCategory(gender, bf) {
  const bands = gender === "male"
    ? [[6, "Essential fat", "essential"], [14, "Athlete", "athlete"], [18, "Fit", "fit"], [25, "Average", "average"], [Infinity, "High", "high"]]
    : [[14, "Essential fat", "essential"], [21, "Athlete", "athlete"], [25, "Fit", "fit"], [32, "Average", "average"], [Infinity, "High", "high"]];
  for (const [max, label, cls] of bands) if (bf < max) return { label, cls };
  return { label: "High", cls: "high" };
}

/* ================= Supabase sync ================= */
function loadSupabaseLib() {
  return new Promise((resolve, reject) => {
    if (window.supabase) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the Supabase library (check internet connection)."));
    document.head.appendChild(s);
  });
}

async function syncConnect(showToasts) {
  if (!sync.config || !sync.config.url || !sync.config.key) { sync.status = "off"; updateSyncBadge(); return; }
  sync.status = "connecting"; sync.message = "Connecting…"; updateSyncBadge();
  try {
    await loadSupabaseLib();
    sync.client = window.supabase.createClient(sync.config.url, sync.config.key);
    const { error } = await sync.client.from("tracker_kv").select("key").limit(1);
    if (error) throw new Error(error.message + (error.message.includes("does not exist") ? " — run the setup SQL in Supabase first." : ""));
    sync.status = "ok"; sync.message = "Connected";
    await pullAll();
    await flushPush();
    if (showToasts) toast("☁️ Connected to Supabase — data synced");
  } catch (e) {
    sync.status = "error"; sync.message = e.message || String(e);
    if (showToasts) toast("Sync error: " + sync.message, "err");
  }
  updateSyncBadge();
  if (currentPage === "settings") render();
}

async function pullAll() {
  if (!sync.client) return;
  const { data: dayRows, error: e1 } = await sync.client.from("tracker_days").select("*");
  if (e1) throw new Error(e1.message);
  const { data: kvRows, error: e2 } = await sync.client.from("tracker_kv").select("*");
  if (e2) throw new Error(e2.message);
  let changed = false;
  for (const row of dayRows || []) {
    const scope = `day:${row.date}`;
    const remote = Date.parse(row.updated_at);
    const local = db.meta[scope] || 0;
    if (!db.days[row.date] || remote > local) { db.days[row.date] = row.data; db.meta[scope] = remote; changed = true; }
    else if (local > remote) sync.dirty.add(scope);
  }
  const serverDates = new Set((dayRows || []).map(r => r.date));
  Object.keys(db.days).forEach(d => { if (!serverDates.has(d)) sync.dirty.add(`day:${d}`); });
  const kvMap = { work: "work", settings: "settings", body: "body" };
  const serverKeys = new Set();
  for (const row of kvRows || []) {
    if (!kvMap[row.key]) continue;
    serverKeys.add(row.key);
    const remote = Date.parse(row.updated_at);
    const local = db.meta[row.key] || 0;
    if (remote > local) { db[row.key] = row.data; db.meta[row.key] = remote; changed = true; }
    else if (local > remote) sync.dirty.add(row.key);
  }
  Object.keys(kvMap).forEach(k => { if (!serverKeys.has(k)) sync.dirty.add(k); });
  sync.lastSync = new Date();
  if (changed) {
    // re-apply migrations to pulled data
    db.work.meetings = (db.work.meetings || []).map(m => ({ repeat: "none", ...m }));
    persistLocal(); render();
  }
}

function queuePush(scope) {
  sync.dirty.add(scope);
  if (sync.status !== "ok") return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(flushPush, 1200);
}

async function flushPush() {
  if (!sync.client || sync.status !== "ok" || !sync.dirty.size) return;
  const scopes = [...sync.dirty];
  const now = new Date().toISOString();
  const dayRows = [], kvRows = [];
  for (const s of scopes) {
    if (s.startsWith("day:")) {
      const date = s.slice(4);
      if (db.days[date]) dayRows.push({ date, data: db.days[date], updated_at: now });
    } else if (["work", "settings", "body"].includes(s)) {
      kvRows.push({ key: s, data: db[s], updated_at: now });
    }
  }
  try {
    if (dayRows.length) {
      const { error } = await sync.client.from("tracker_days").upsert(dayRows);
      if (error) throw new Error(error.message);
    }
    if (kvRows.length) {
      const { error } = await sync.client.from("tracker_kv").upsert(kvRows);
      if (error) throw new Error(error.message);
    }
    scopes.forEach(s => { sync.dirty.delete(s); db.meta[s] = Date.parse(now); });
    persistLocal();
    sync.lastSync = new Date();
    updateSyncBadge();
  } catch (e) {
    sync.status = "error"; sync.message = e.message || String(e);
    updateSyncBadge();
  }
}

function updateSyncBadge() {
  const b = document.getElementById("syncBadge");
  if (!b) return;
  b.classList.remove("ok", "err");
  if (sync.status === "ok") {
    b.classList.add("ok");
    b.textContent = `☁️ Synced${sync.lastSync ? " · " + sync.lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}`;
  } else if (sync.status === "error") {
    b.classList.add("err"); b.textContent = "⚠️ Sync error — open Settings";
  } else if (sync.status === "connecting") {
    b.textContent = "⏳ Connecting…";
  } else {
    b.textContent = "💾 Local only — tap to set up cloud sync";
  }
}

/* ================= Reminders (browser notifications) ================= */
let reminderTimer = null;
let lastReminderAt = 0;

function startReminderLoop() {
  clearInterval(reminderTimer);
  reminderTimer = setInterval(checkWaterReminder, 60000);
}

function checkWaterReminder() {
  const r = db.settings.reminders;
  if (!r || !r.water) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const hm = nowTime();
  if (hm < r.start || hm > r.end) return;
  const today = peekDay(todayStr());
  const total = waterTotal(today);
  if (total >= db.settings.waterGoal) return; // goal met, no nagging
  const now = new Date();
  const minutesSince = t => { const [h, m] = t.split(":").map(Number); return now.getHours() * 60 + now.getMinutes() - (h * 60 + m); };
  const lastDrink = today && today.water.length ? today.water[today.water.length - 1].time : null;
  const sinceDrink = lastDrink ? minutesSince(lastDrink) : Infinity;
  if (sinceDrink < r.interval) return;
  if (Date.now() - lastReminderAt < r.interval * 60000) return; // don't repeat too often
  lastReminderAt = Date.now();
  const remaining = db.settings.waterGoal - total;
  try {
    new Notification("💧 Momentum — water time!", {
      body: lastDrink
        ? `Nothing logged since ${fmtTime12(lastDrink)}. ${remaining} ml to go today.`
        : `No drinks logged yet today. ${remaining} ml to go — start sipping!`,
      tag: "momentum-water",
    });
  } catch (e) { /* some browsers require a service worker; fail silently */ }
}

/* ================= SVG helpers ================= */
function ringSvg(pct, color, size = 108, stroke = 10) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, pct) / 100);
  return `<svg width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .5s"/>
  </svg>`;
}

function trendSvg(points, { color = "var(--accent)", goal = null, unit = "", height = 190 } = {}) {
  // points: [{label, value}]
  if (!points.length) return `<div class="empty">No data yet.</div>`;
  const W = 640, H = height, padL = 34, padR = 8, padT = 14, padB = 22;
  const vals = points.map(p => p.value);
  const max = Math.max(...vals, goal || 0) * 1.1 || 1;
  const bw = Math.min(26, (W - padL - padR) / points.length * 0.62);
  const x = i => padL + (i + 0.5) * (W - padL - padR) / points.length;
  const y = v => H - padB - v / max * (H - padT - padB);
  return `<svg class="trend-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${goal ? `<line x1="${padL}" x2="${W - padR}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="5,4" opacity=".7"/>
      <text x="${W - padR}" y="${y(goal) - 5}" fill="var(--green)" font-size="10" text-anchor="end">goal ${goal}${unit}</text>` : ""}
    ${points.map((p, i) => `
      <rect x="${x(i) - bw / 2}" y="${y(p.value)}" width="${bw}" height="${Math.max(1, H - padB - y(p.value))}" rx="4" fill="${color}" opacity="${p.value >= (goal || Infinity) ? 1 : .65}"/>
      ${i % Math.ceil(points.length / 10) === 0 ? `<text x="${x(i)}" y="${H - 6}" fill="var(--muted)" font-size="9.5" text-anchor="middle">${p.label}</text>` : ""}`).join("")}
    <text x="4" y="${padT}" fill="var(--muted)" font-size="10">${Math.round(max * 10) / 10}${unit}</text>
  </svg>`;
}

function lineSvg(series, { color = "var(--accent)", label = "" } = {}) {
  // series: [{label, value}]
  if (series.length < 2) return "";
  const W = 640, H = 170, pad = 30;
  const vals = series.map(s => s.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const x = i => pad + i * (W - 2 * pad) / (series.length - 1);
  const y = v => H - pad - (v - min) / range * (H - 2 * pad);
  const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return `<svg class="bf-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <text x="${pad}" y="13" fill="var(--muted)" font-size="10.5">${esc(label)} · ${min} → ${max}</text>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.4" fill="${color}"/>`).join("")}
    ${vals.map((v, i) => i % Math.ceil(series.length / 8) === 0 ? `<text x="${x(i)}" y="${H - 8}" fill="var(--muted)" font-size="9" text-anchor="middle">${series[i].label}</text>` : "").join("")}
  </svg>`;
}

/* ================= Render root ================= */
function render() {
  const h = new Date().getHours();
  const greet = h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const sub = h < 5 ? "Up late? Log the day, then get some sleep." : h < 12 ? "Let's make this morning count." : h < 17 ? "Let's make this afternoon count." : "Let's finish the day strong.";
  document.getElementById("greeting").innerHTML =
    `${greet}, ${esc(db.settings.userName)} <small>${sub}</small>`;
  document.getElementById("dateLabel").textContent = currentDate === todayStr() ? `Today · ${fmtDate(currentDate)}` : fmtDate(currentDate);
  document.getElementById("datePicker").value = currentDate;
  document.querySelectorAll(".nav-item").forEach(t => t.classList.toggle("active", t.dataset.page === currentPage));
  const pages = {
    dashboard: renderDashboard, day: renderDay, work: renderWork, fitness: renderFitness,
    water: renderWater, protein: renderProtein, fiber: renderFiber, food: renderFood, history: renderHistory, settings: renderSettings,
  };
  document.getElementById("pageContainer").innerHTML = pages[currentPage]();
  updateSyncBadge();
  bindPage();
}

/* ================= Page: Dashboard ================= */
function renderDashboard() {
  const day = getDay(currentDate);
  const w = waterTotal(day), p = proteinTotal(day);
  const wG = db.settings.waterGoal, pG = db.settings.proteinGoal;
  const wPct = Math.min(100, Math.round(w / wG * 100));
  const pPct = Math.min(100, Math.round(p / pG * 100));
  const fb = fiberTotal(day), fbG = db.settings.fiberGoal;
  const fbPct = Math.min(100, Math.round(fb / fbG * 100));
  const rPct = routineProgress(day);
  const streak = waterStreak();
  const meets = meetingsForDate(currentDate);
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = shiftDate(currentDate, -i);
    const dd = peekDay(d);
    last7.push({ d, w: Math.min(100, Math.round(waterTotal(dd) / wG * 100)), p: Math.min(100, Math.round(proteinTotal(dd) / pG * 100)) });
  }
  const body = [...db.body].sort((a, b) => a.date.localeCompare(b.date));
  const lastBody = body[body.length - 1];
  return `
  <div class="hero-grid">
    <div class="card ring-card" data-goto="water">
      <div class="ring-wrap">${ringSvg(wPct, "var(--cyan)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--cyan)">${(w / 1000).toFixed(1)}L</div><div class="ring-unit">of ${(wG / 1000).toFixed(1)}L</div></div></div>
      <div class="ring-label">💧 Hydration ${wPct}%</div>
    </div>
    <div class="card ring-card" data-goto="protein">
      <div class="ring-wrap">${ringSvg(pPct, "var(--green)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--green)">${p}g</div><div class="ring-unit">of ${pG}g</div></div></div>
      <div class="ring-label">🥚 Protein ${pPct}%</div>
    </div>
    <div class="card ring-card" data-goto="fiber">
      <div class="ring-wrap">${ringSvg(fbPct, "var(--amber)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--amber)">${fb}g</div><div class="ring-unit">of ${fbG}g</div></div></div>
      <div class="ring-label">🌾 Fiber ${fbPct}%</div>
    </div>
    <div class="card ring-card" data-goto="day">
      <div class="ring-wrap">${ringSvg(rPct, "var(--accent)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--accent)">${rPct}%</div><div class="ring-unit">${day.routine.filter(r => r.done).length}/${day.routine.length} done</div></div></div>
      <div class="ring-label">☀️ Routine</div>
    </div>
    <div class="card stat-card" data-goto="fitness">
      <div class="stat-num" style="color:var(--amber)">${day.exercises.length} <span class="streak-flame">💪</span></div>
      <div class="stat-label">exercises today</div>
      <div class="stat-num" style="font-size:1.15rem;color:var(--cyan)">${streak} <span class="streak-flame">🔥</span></div>
      <div class="stat-label">day water streak</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <h2>⚡ Quick log <span class="h-sub">one tap</span></h2>
      <div class="quick-row">
        <button class="chip-btn" data-act="quick-water" data-ml="250">💧 +250 ml</button>
        <button class="chip-btn" data-act="quick-water" data-ml="500">💧 +500 ml</button>
        <button class="chip-btn" data-act="quick-buttermilk" data-ml="250">🥛 Buttermilk 250ml</button>
        <button class="chip-btn" data-act="quick-egg">🥚 +1 egg (6g)</button>
        <button class="chip-btn" data-goto="fiber">🌾 Log fiber</button>
        <button class="chip-btn" data-goto="fitness">💪 Log workout</button>
        <button class="chip-btn" data-goto="food">🍽️ Log meal</button>
      </div>
      <h2 style="margin-top:20px">🗓️ Meetings — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)}</h2>
      <div class="timeline-peek">
        ${meets.length ? meets.map(m => `
          <div class="tl-row"><span class="tl-time">${fmtTime12(m.time)}</span><span style="flex:1">${esc(m.title)}</span>
          ${m.repeat !== "none" ? `<span class="tag repeat-chip">${repeatLabel(m)}</span>` : ""}</div>`).join("")
        : `<div class="empty">No meetings on this day.</div>`}
      </div>
    </div>
    <div class="card">
      <h2>📊 Last 7 days <span class="h-sub">💧 water · 🟩 protein (% of goal)</span></h2>
      <div class="mini-bars">
        ${last7.map(d => `
          <div class="mini-bar-col">
            <div class="mini-bar-pair">
              <div class="mini-bar" style="height:${Math.max(3, d.w)}%;background:var(--cyan)" title="Water ${d.w}%"></div>
              <div class="mini-bar" style="height:${Math.max(3, d.p)}%;background:var(--green)" title="Protein ${d.p}%"></div>
            </div>
            <div class="mini-bar-label">${fmtShort(d.d)}</div>
          </div>`).join("")}
      </div>
      <h2 style="margin-top:18px">⚖️ Body <span class="h-sub">latest entry</span></h2>
      ${lastBody
        ? `<div class="report-list"><b>${lastBody.weight ?? "—"} kg</b> · <b>${lastBody.bodyFat ?? "—"}% fat</b> on ${fmtDate(lastBody.date)} &nbsp;<button class="btn small ghost" data-goto="food">Update</button></div>`
        : `<div class="report-list">No body entries yet — <button class="btn small ghost" data-goto="food">add one</button> (there's a body-fat calculator too).</div>`}
    </div>
  </div>`;
}

/* ================= Page: My Day ================= */
function renderDay() {
  const day = getDay(currentDate);
  const meets = meetingsForDate(currentDate);
  const timeline = [
    ...day.routine.map(r => ({ kind: "routine", time: r.time, item: r })),
    ...meets.map(m => ({ kind: "meeting", time: m.time || "09:00", item: m })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const prog = routineProgress(day);
  return `
  <div class="card">
    <h2>☀️ Day timeline <span class="h-sub">${prog}% of routine done · ${meets.length} meeting${meets.length === 1 ? "" : "s"}</span></h2>
    <div class="quick-row" style="margin-bottom:12px">
      ${Object.entries(DAY_TYPES).map(([k, v]) => `
        <button class="chip-btn daytype ${(day.dayType || "normal") === k ? "active" : ""}" data-act="set-day-type" data-type="${k}">${v.emoji} ${v.label}</button>`).join("")}
    </div>
    ${day.dayType === "rest" ? `<div class="daytype-note">😴 Rest day — no workout expected today. Recovery is part of the plan.</div>` : ""}
    ${day.dayType === "holiday" ? `<div class="daytype-note">🎉 Holiday — enjoy! Hydration & food still count.</div>` : ""}
    <div class="progress-bar" style="margin-bottom:12px"><div style="width:${prog}%"></div></div>
    ${timeline.length ? timeline.map(t => t.kind === "routine" ? `
      <div class="tl-item ${t.item.done ? "done" : ""}">
        <button class="check ${t.item.done ? "on" : ""}" data-act="toggle-routine" data-id="${t.item.id}">✓</button>
        <span class="r-time">${esc(t.item.time)}</span>
        <span class="r-text">${esc(t.item.text)}</span>
        <button class="del-btn" data-act="del-routine" data-id="${t.item.id}" title="Remove">✕</button>
      </div>` : `
      <div class="tl-item meeting-row">
        <span style="width:25px;text-align:center">🗓️</span>
        <span class="r-time">${fmtTime12(t.item.time)}</span>
        <span class="r-text">${esc(t.item.title)}${t.item.notes ? `<div style="font-size:.78rem;color:var(--muted)">${esc(t.item.notes)}</div>` : ""}</span>
        <span class="tag meet-chip">Meeting</span>
        ${t.item.repeat !== "none" ? `<span class="tag repeat-chip">${repeatLabel(t.item)}</span>` : ""}
      </div>`).join("") : `<div class="empty">Nothing planned for this day.</div>`}
  </div>
  <div class="grid2">
    <div class="card">
      <h2>➕ Add routine item</h2>
      <div class="row">
        <input type="time" id="rtTime" value="09:00" style="width:118px">
        <input type="text" id="rtText" class="grow" placeholder="e.g. Team standup, gym, reading…">
        <button class="btn" data-act="add-routine">Add</button>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost small" data-act="save-template">💾 Save as my default routine</button>
        <button class="btn ghost small" data-act="reset-routine">↺ Reset to default</button>
      </div>
    </div>
    <div class="card">
      <h2>🗓️ Add meeting on this day</h2>
      <div class="row" style="margin-bottom:8px">
        <input type="time" id="dmTime" style="width:118px" value="10:30">
        <input type="text" id="dmTitle" class="grow" placeholder="Meeting title…">
      </div>
      <div class="row">
        ${repeatOptionsHtml("dmRepeat")}
        <button class="btn" data-act="add-day-meeting">Add meeting</button>
      </div>
      ${dayPickerHtml("dmDays")}
      <div style="color:var(--muted);font-size:.76rem;margin-top:8px">Recurring meetings appear automatically in your timeline every matching day — pick "Custom days…" for patterns like Wed + Fri. Manage them in the Work tab.</div>
    </div>
  </div>`;
}

/* ================= Page: Work ================= */
function renderWork() {
  const ms = db.work.milestones;
  const meetings = [...db.work.meetings].sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
  return `
  <div class="card">
    <h2>🎯 Milestones <span class="h-sub">${ms.filter(m => m.status === "done").length}/${ms.length} completed</span></h2>
    <div class="row" style="margin-bottom:14px">
      <input type="text" id="msTitle" class="grow" placeholder="New milestone e.g. Ship reporting module v1">
      <input type="date" id="msTarget" class="inline" style="width:160px" value="${currentDate}" title="Target date">
      <button class="btn" data-act="add-milestone">Add milestone</button>
    </div>
    ${ms.length ? ms.map(m => `
      <div class="milestone ${m.status}">
        <div class="milestone-head">
          <span class="m-title">${esc(m.title)}</span>
          <span class="tag status-${m.status}">${m.status.replace("-", " ")}</span>
          ${m.target ? `<span style="font-size:.74rem;color:var(--muted)">🎯 ${fmtDate(m.target)}</span>` : ""}
          <select data-act="ms-status" data-id="${m.id}" style="width:auto;padding:4px 8px;font-size:.77rem">
            <option value="planned" ${m.status === "planned" ? "selected" : ""}>Planned</option>
            <option value="in-progress" ${m.status === "in-progress" ? "selected" : ""}>In progress</option>
            <option value="done" ${m.status === "done" ? "selected" : ""}>Done</option>
          </select>
          <button class="del-btn" data-act="del-milestone" data-id="${m.id}">✕</button>
        </div>
        <div class="step-list">
          ${m.steps.map(s => `
            <div class="step-item">
              <span class="s-date">${fmtDate(s.date)}</span>
              <span style="flex:1">${esc(s.text)}</span>
              <button class="del-btn" data-act="del-step" data-mid="${m.id}" data-id="${s.id}">✕</button>
            </div>`).join("")}
          <div class="row" style="margin-top:6px">
            <input type="text" class="grow step-input" data-id="${m.id}" placeholder="Record a step / progress update…" style="font-size:.84rem;padding:6px 10px">
            <button class="btn small ghost" data-act="add-step" data-id="${m.id}">Log step</button>
          </div>
        </div>
      </div>`).join("") : `<div class="empty">No milestones yet — add your first one above.</div>`}
  </div>
  <div class="card">
    <h2>🗓️ Meetings <span class="h-sub">one-time & recurring</span></h2>
    <div class="row" style="margin-bottom:8px">
      <input type="date" id="mtDate" class="inline" style="width:150px" value="${currentDate}">
      <input type="time" id="mtTime" style="width:110px" value="10:00">
      <input type="text" id="mtTitle" class="grow" placeholder="Meeting title e.g. Sprint planning">
      ${repeatOptionsHtml("mtRepeat")}
    </div>
    ${dayPickerHtml("mtDays")}
    <div class="row" style="margin-bottom:14px">
      <textarea id="mtNotes" class="grow" rows="2" placeholder="Notes / agenda / outcome (optional)"></textarea>
      <button class="btn" data-act="add-meeting">Add meeting</button>
    </div>
    ${meetings.length ? meetings.map(mt => `
      <div class="meeting-item">
        <div class="meeting-when">
          <div class="m-date">${mt.repeat !== "none" ? "from " : ""}${fmtDate(mt.date)}</div>
          <div class="m-time">${fmtTime12(mt.time)}</div>
        </div>
        <div class="meeting-body">
          <div class="m-title">${esc(mt.title)} ${mt.repeat !== "none" ? `<span class="tag repeat-chip">${repeatLabel(mt)}</span>` : ""}</div>
          ${mt.notes ? `<div class="m-notes">${esc(mt.notes)}</div>` : ""}
        </div>
        <button class="del-btn" data-act="del-meeting" data-id="${mt.id}">✕</button>
      </div>`).join("") : `<div class="empty">No meetings recorded yet.</div>`}
  </div>`;
}

/* ================= Page: Fitness ================= */
function renderFitness() {
  const day = getDay(currentDate);
  const logs = day.exercises;
  const byCat = c => logs.filter(l => l.cat === c).length;
  return `
  <div class="card">
    <h2>💪 Log exercise</h2>
    <div class="ex-cats">
      ${Object.keys(EXERCISES).map(c => `
        <div class="ex-cat ${exCat === c ? "active" : ""}" data-act="ex-cat" data-cat="${c}">
          <span class="cat-emoji">${CAT_META[c].emoji}</span>${CAT_META[c].label}
          <div style="font-size:.7rem;color:var(--muted);font-weight:400">${byCat(c)} logged</div>
        </div>`).join("")}
    </div>
    <div class="ex-preset-grid">
      ${EXERCISES[exCat].map(name => `
        <button class="ex-preset ${exPreset === name ? "selected" : ""}" data-act="ex-preset" data-name="${esc(name)}">${esc(name)}</button>`).join("")}
    </div>
    <div class="row">
      <input type="text" id="exName" class="grow" placeholder="Exercise name" value="${esc(exPreset || "")}">
      <input type="number" id="exSets" min="1" value="3" style="width:88px" title="Sets">
      <span style="color:var(--muted)">sets ×</span>
      <input type="number" id="exReps" min="1" value="15" style="width:88px" title="Reps">
      <span style="color:var(--muted)">reps</span>
      <button class="btn" data-act="add-exercise">Log it</button>
    </div>
  </div>
  <div class="card">
    <h2>📋 Workout — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)} <span class="h-sub">${logs.length} exercise${logs.length === 1 ? "" : "s"}</span></h2>
    ${logs.length ? logs.map(l => `
      <div class="ex-log-item">
        <span style="font-size:1.1rem">${CAT_META[l.cat].emoji}</span>
        <span class="e-name">${esc(l.name)}<div class="e-cat">${CAT_META[l.cat].label} · ${esc(l.time)}</div></span>
        <span class="e-detail">${l.sets} × ${l.reps}</span>
        <button class="del-btn" data-act="del-exercise" data-id="${l.id}">✕</button>
      </div>`).join("") : `<div class="empty">Nothing logged yet — pick a category and exercise above.</div>`}
  </div>`;
}

/* ================= Page: Water ================= */
function renderWater() {
  const day = getDay(currentDate);
  const total = waterTotal(day);
  const goal = db.settings.waterGoal;
  const pct = Math.min(100, Math.round(total / goal * 100));
  const face = pct >= 100 ? "🦙🎉" : pct >= 60 ? "🦙😊" : pct >= 30 ? "🦙🙂" : "🦙🥺";
  const msg = pct >= 100 ? "Goal reached! Your llama is thrilled!" :
    pct >= 60 ? "Great going, keep sipping!" :
    pct >= 30 ? "Making progress — drink up!" : "Your llama is thirsty… drink some water!";
  return `
  <div class="card">
    <h2>💧 Hydration <span class="h-sub">Goal: ${(goal / 1000).toFixed(1)} L / day · streak ${waterStreak()}🔥</span></h2>
    <div class="water-layout">
      <div class="water-visual">
        <div class="llama-cup">
          <div class="llama-fill" style="height:${pct}%"></div>
          <div class="llama-face">${face}</div>
        </div>
        <div class="water-big">${(total / 1000).toFixed(2)} L <span>/ ${(goal / 1000).toFixed(1)} L (${pct}%)</span></div>
        <div class="water-msg">${msg}</div>
      </div>
      <div>
        <div class="drink-type-row">
          <button class="drink-type ${drinkType === "water" ? "active" : ""}" data-act="drink-type" data-type="water">💧 Water</button>
          <button class="drink-type ${drinkType === "buttermilk" ? "active" : ""}" data-act="drink-type" data-type="buttermilk">🥛 Buttermilk</button>
        </div>
        <div class="quick-adds">
          ${[100, 150, 200, 250, 300, 500].map(ml => `<button class="quick-add" data-act="add-water" data-ml="${ml}">+${ml} ml</button>`).join("")}
        </div>
        <div class="row" style="margin-bottom:14px">
          <input type="number" id="customMl" min="1" placeholder="Custom amount (ml)" class="grow">
          <button class="btn" data-act="add-water-custom">Add</button>
        </div>
        <div class="row">
          <span style="color:var(--muted);font-size:.84rem">Daily goal (ml):</span>
          <input type="number" id="waterGoalInput" min="500" step="100" value="${goal}" style="width:110px">
          <button class="btn ghost small" data-act="set-water-goal">Update goal</button>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <h2>📜 Drinks — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)} <span class="h-sub">${day.water.length} entries</span></h2>
    ${day.water.length ? [...day.water].reverse().map(w => `
      <div class="water-log-item">
        <span class="w-amt">+${w.ml} ml</span>
        <span class="w-type">${w.type === "buttermilk" ? "🥛 Buttermilk" : "💧 Water"}</span>
        <span class="w-time">${esc(w.time)}</span>
        <button class="del-btn" data-act="del-water" data-id="${w.id}">✕</button>
      </div>`).join("") : `<div class="empty">No drinks logged yet.</div>`}
  </div>`;
}

/* ================= Page: Protein ================= */
function renderProtein() {
  const day = getDay(currentDate);
  const total = proteinTotal(day);
  const goal = db.settings.proteinGoal;
  const pct = Math.min(100, Math.round(total / goal * 100));
  return `
  <div class="card protein-total-card">
    <div class="protein-big" style="color:var(--green)">${total} g <span>/ ${goal} g protein</span></div>
    <div class="progress-bar" style="margin:14px auto 6px;max-width:420px"><div style="width:${pct}%;background:linear-gradient(90deg,var(--green),#1fa863)"></div></div>
    <div style="color:var(--muted);font-size:.85rem">${pct >= 100 ? "🎉 Protein goal hit!" : `${Math.round((goal - total) * 10) / 10} g to go`}</div>
    <div class="row" style="justify-content:center;margin-top:14px">
      <span style="color:var(--muted);font-size:.84rem">Daily goal (g):</span>
      <input type="number" id="proteinGoalInput" min="10" value="${goal}" style="width:100px">
      <button class="btn ghost small" data-act="set-protein-goal">Update goal</button>
    </div>
  </div>
  <div class="card">
    <h2>🍳 Quick add <span class="h-sub">tap a food, set quantity</span></h2>
    <div class="food-preset-grid">
      ${PROTEIN_FOODS.map((f, i) => `
        <button class="food-preset" data-act="pick-food" data-idx="${i}">
          <div class="fp-name">${esc(f.name)}</div>
          <div class="fp-protein">${f.protein} g / ${esc(f.unit)}</div>
        </button>`).join("")}
    </div>
    <div class="row">
      <input type="text" id="pfName" class="grow" placeholder="Food name">
      <input type="number" id="pfQty" min="0.5" step="0.5" value="1" style="width:88px" title="Quantity">
      <span style="color:var(--muted)" id="pfUnit">× unit</span>
      <input type="number" id="pfPer" min="0" step="0.1" placeholder="protein g/unit" style="width:128px" title="Protein grams per unit">
      <button class="btn" data-act="add-protein">Add</button>
    </div>
    <div style="color:var(--muted);font-size:.76rem;margin-top:8px">Tip: for a custom entry like "20g protein", type the name, quantity 1 and protein 20.</div>
  </div>
  <div class="card">
    <h2>📜 Intake — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)} <span class="h-sub">${day.protein.length} entries</span></h2>
    ${day.protein.length ? [...day.protein].reverse().map(p => `
      <div class="protein-log-item">
        <span class="p-food">${esc(p.food)}<div class="p-qty">${p.qty} × ${esc(p.unit)} · ${esc(p.time)}</div></span>
        <span class="p-grams">${p.grams} g</span>
        <button class="del-btn" data-act="del-protein" data-id="${p.id}">✕</button>
      </div>`).join("") : `<div class="empty">Nothing added yet — tap a food above.</div>`}
  </div>`;
}

/* ================= Page: Fiber ================= */
function renderFiber() {
  const day = getDay(currentDate);
  const total = fiberTotal(day);
  const goal = db.settings.fiberGoal;
  const pct = Math.min(100, Math.round(total / goal * 100));
  return `
  <div class="card protein-total-card">
    <div class="protein-big" style="color:var(--amber)">${total} g <span>/ ${goal} g fiber</span></div>
    <div class="progress-bar" style="margin:14px auto 6px;max-width:420px"><div style="width:${pct}%;background:linear-gradient(90deg,var(--amber),#d99a2b)"></div></div>
    <div style="color:var(--muted);font-size:.85rem">${pct >= 100 ? "🎉 Fiber goal hit — your gut thanks you!" : `${Math.round((goal - total) * 10) / 10} g to go`}</div>
    <div class="row" style="justify-content:center;margin-top:14px">
      <span style="color:var(--muted);font-size:.84rem">Daily goal (g):</span>
      <input type="number" id="fiberGoalInput" min="5" value="${goal}" style="width:100px">
      <button class="btn ghost small" data-act="set-fiber-goal">Update goal</button>
    </div>
  </div>
  <div class="card">
    <h2>🌾 Quick add <span class="h-sub">tap a food, set quantity</span></h2>
    <div class="food-preset-grid">
      ${FIBER_FOODS.map((f, i) => `
        <button class="food-preset" data-act="pick-fiber" data-idx="${i}">
          <div class="fp-name">${esc(f.name)}</div>
          <div class="fp-protein" style="color:var(--amber)">${f.fiber} g / ${esc(f.unit)}</div>
        </button>`).join("")}
    </div>
    <div class="row">
      <input type="text" id="fbName" class="grow" placeholder="Food name">
      <input type="number" id="fbQty" min="0.5" step="0.5" value="1" style="width:88px" title="Quantity">
      <span style="color:var(--muted)" id="fbUnit">× unit</span>
      <input type="number" id="fbPer" min="0" step="0.1" placeholder="fiber g/unit" style="width:128px" title="Fiber grams per unit">
      <button class="btn" data-act="add-fiber">Add</button>
    </div>
    <div style="color:var(--muted);font-size:.76rem;margin-top:8px">Aim for 25–38 g/day. Tip: dals, fruits with skin, and whole grains are the easiest wins.</div>
  </div>
  <div class="card">
    <h2>📜 Intake — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)} <span class="h-sub">${day.fiber.length} entries</span></h2>
    ${day.fiber.length ? [...day.fiber].reverse().map(p => `
      <div class="protein-log-item">
        <span class="p-food">${esc(p.food)}<div class="p-qty">${p.qty} × ${esc(p.unit)} · ${esc(p.time)}</div></span>
        <span class="p-grams" style="color:var(--amber)">${p.grams} g</span>
        <button class="del-btn" data-act="del-fiber" data-id="${p.id}">✕</button>
      </div>`).join("") : `<div class="empty">Nothing added yet — tap a food above.</div>`}
  </div>`;
}

/* ================= Page: Nutrition ================= */
function renderFood() {
  const day = getDay(currentDate);
  const body = [...db.body].sort((a, b) => a.date.localeCompare(b.date));
  const bfSeries = body.filter(b => b.bodyFat != null).map(b => ({ label: fmtShort(b.date), value: b.bodyFat }));
  const wtSeries = body.filter(b => b.weight != null).map(b => ({ label: fmtShort(b.date), value: b.weight }));
  return `
  <div class="card">
    <h2>🥗 Eat this, not that</h2>
    <div class="food-guide-grid">
      <div class="guide-col eat">
        <h3>✅ EAT</h3>
        ${db.settings.eatList.map((f, i) => `<div class="guide-item"><span>${esc(f)}</span><button class="del-btn" data-act="del-eat" data-idx="${i}">✕</button></div>`).join("")}
        <div class="row" style="margin-top:8px">
          <input type="text" id="eatNew" class="grow" placeholder="Add good food…">
          <button class="btn small ghost" data-act="add-eat">Add</button>
        </div>
      </div>
      <div class="guide-col avoid">
        <h3>🚫 AVOID</h3>
        ${db.settings.avoidList.map((f, i) => `<div class="guide-item"><span>${esc(f)}</span><button class="del-btn" data-act="del-avoid" data-idx="${i}">✕</button></div>`).join("")}
        <div class="row" style="margin-top:8px">
          <input type="text" id="avoidNew" class="grow" placeholder="Add food to avoid…">
          <button class="btn small ghost" data-act="add-avoid">Add</button>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <h2>🍕 Cheat meter — ${dateObj(currentDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
      <span class="h-sub">green ≤ 2 · yellow 3–4 · red 5+</span></h2>
    ${(() => {
      const n = cheatCountForMonth(currentDate.slice(0, 7));
      const z = cheatZone(n);
      return `
      <div class="row" style="gap:16px">
        <div class="protein-big" style="color:${z.color};font-size:2rem">${n} <span style="font-size:.9rem">cheat meal${n === 1 ? "" : "s"}</span></div>
        <span class="tag" style="background:${z.color}22;color:${z.color}">${z.label}</span>
        <span style="color:var(--muted);font-size:.85rem;flex:1">${z.msg}</span>
      </div>
      <div class="zone-track">
        <div class="zone-seg" style="background:var(--green)"></div>
        <div class="zone-seg" style="background:var(--amber)"></div>
        <div class="zone-seg" style="background:var(--red)"></div>
        <div class="zone-marker" style="left:${Math.min(97, n / 6 * 100)}%"></div>
      </div>
      <div class="zone-labels"><span>0</span><span>2</span><span>4</span><span>6+</span></div>`;
    })()}
  </div>
  <div class="card">
    <h2>🍽️ Meal log <span class="h-sub">what I actually ate</span></h2>
    <div class="row" style="margin-bottom:12px">
      <select id="mealType" style="width:130px">
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="snack">Snack</option>
        <option value="dinner">Dinner</option>
      </select>
      <input type="text" id="mealText" class="grow" placeholder="e.g. 2 rotis + dal + salad">
      <label class="cheat-check"><input type="checkbox" id="mealCheat"><span>🍕 Cheat meal</span></label>
      <button class="btn" data-act="add-meal">Log meal</button>
    </div>
    ${day.meals.length ? day.meals.map(m => `
      <div class="meal-log-item">
        <span class="tag meal-tag meal-${m.type}">${m.type}</span>
        <span style="flex:1">${esc(m.text)} ${m.cheat ? `<span class="tag" style="background:rgba(255,107,122,.15);color:var(--red)">🍕 cheat</span>` : ""}</span>
        <span style="color:var(--muted);font-size:.76rem">${esc(m.time)}</span>
        <button class="del-btn" data-act="del-meal" data-id="${m.id}">✕</button>
      </div>`).join("") : `<div class="empty">No meals logged for this day.</div>`}
  </div>
  <div class="card">
    <h2>🧮 Body fat calculator <span class="h-sub">US Navy method — just a measuring tape needed</span></h2>
    <div class="gender-row">
      <button class="gender-btn ${bfGender === "male" ? "active" : ""}" data-act="bf-gender" data-g="male">👨 Male</button>
      <button class="gender-btn ${bfGender === "female" ? "active" : ""}" data-act="bf-gender" data-g="female">👩 Female</button>
    </div>
    <div class="row">
      <input type="number" id="bfHeight" step="0.5" min="100" placeholder="Height (cm)" style="width:140px">
      <input type="number" id="bfNeck" step="0.5" min="20" placeholder="Neck (cm)" style="width:130px">
      <input type="number" id="bfWaist" step="0.5" min="40" placeholder="Waist (cm)" style="width:130px">
      <input type="number" id="bfHip" step="0.5" min="40" placeholder="Hip (cm)" style="width:130px;display:${bfGender === "female" ? "block" : "none"}">
      <button class="btn" data-act="bf-calc">Calculate</button>
    </div>
    <div style="color:var(--muted);font-size:.76rem;margin-top:8px">
      Measure: <b>neck</b> just below the Adam's apple · <b>waist</b> at the navel, relaxed${bfGender === "female" ? " · <b>hip</b> at the widest point" : ""}. Morning measurements are most consistent.
    </div>
    <div class="bf-result" id="bfResult"></div>
  </div>
  <div class="card">
    <h2>📉 Body tracking <span class="h-sub">weight & body fat over time</span></h2>
    <div class="row" style="margin-bottom:10px">
      <input type="date" id="bodyDate" class="inline" style="width:150px" value="${currentDate}">
      <input type="number" id="bodyWeight" step="0.1" min="20" placeholder="Weight (kg)" style="width:130px">
      <input type="number" id="bodyPct" step="0.1" min="2" max="60" placeholder="Body fat %" style="width:130px">
      <button class="btn" data-act="add-body">Save entry</button>
    </div>
    ${bfSeries.length >= 2 ? lineSvg(bfSeries, { color: "var(--accent2)", label: "Body fat %" }) : ""}
    ${wtSeries.length >= 2 ? lineSvg(wtSeries, { color: "var(--cyan)", label: "Weight (kg)" }) : ""}
    ${body.length ? [...body].reverse().map(b => `
      <div class="bf-entry">
        <span class="bf-date">${fmtDate(b.date)}</span>
        <span style="min-width:90px">⚖️ ${b.weight ?? "—"} kg</span>
        <span style="flex:1">📊 ${b.bodyFat ?? "—"} % fat</span>
        <button class="del-btn" data-act="del-body" data-date="${b.date}">✕</button>
      </div>`).join("") : `<div class="empty">No body entries yet — use the calculator above, then save.</div>`}
  </div>`;
}

/* ================= Page: History ================= */
function renderHistory() {
  const [yy, mm] = histMonth.split("-").map(Number);
  const first = new Date(yy, mm - 1, 1);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const monthName = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const today = todayStr();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(`<div class="cal-cell blank"></div>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const future = ds > today;
    const score = future ? null : dayScore(ds);
    const day = peekDay(ds);
    const dots = day ? `
      <div class="cal-dots">
        ${waterTotal(day) >= db.settings.waterGoal ? `<div class="cal-dot" style="background:var(--cyan)"></div>` : ""}
        ${proteinTotal(day) >= db.settings.proteinGoal ? `<div class="cal-dot" style="background:var(--green)"></div>` : ""}
        ${day.exercises.length ? `<div class="cal-dot" style="background:var(--amber)"></div>` : ""}
        ${meetingsForDate(ds).length ? `<div class="cal-dot" style="background:var(--accent2)"></div>` : ""}
        ${(day.meals || []).some(m => m.cheat) ? `<div class="cal-dot" style="background:var(--red)"></div>` : ""}
      </div>` : "";
    const typeEmoji = day && day.dayType && day.dayType !== "normal" ? DAY_TYPES[day.dayType].emoji : "";
    cells.push(`
      <button class="cal-cell ${ds === today ? "today" : ""} ${future ? "future" : ""}" ${future ? "" : `data-act="goto-day" data-date="${ds}"`}>
        <span>${d} ${typeEmoji}</span>${dots}
        <div class="cal-score-bar">${score != null && score > 0 ? `<div style="width:${score}%;background:linear-gradient(90deg,var(--accent),var(--green))"></div>` : ""}</div>
      </button>`);
  }
  // 30-day trends
  const water30 = [], protein30 = [], fiber30 = [];
  for (let i = 29; i >= 0; i--) {
    const ds = shiftDate(today, -i);
    const day = peekDay(ds);
    water30.push({ label: fmtShort(ds), value: Math.round(waterTotal(day) / 100) / 10 });
    protein30.push({ label: fmtShort(ds), value: proteinTotal(day) });
    fiber30.push({ label: fmtShort(ds), value: fiberTotal(day) });
  }
  const trackedDays = Object.keys(db.days).filter(d => dayScore(d) > 0).length;
  const perfectDays = Object.keys(db.days).filter(d => dayScore(d) >= 90).length;
  const day = peekDay(currentDate);
  const meets = meetingsForDate(currentDate);
  return `
  <div class="card">
    <div class="cal-head">
      <button class="icon-btn" data-act="hist-month" data-delta="-1">‹</button>
      <div class="cal-title">📆 ${monthName}</div>
      <button class="icon-btn" data-act="hist-month" data-delta="1">›</button>
    </div>
    <div class="cal-grid">
      ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => `<div class="cal-dow">${d}</div>`).join("")}
      ${cells.join("")}
    </div>
    <div class="legend">
      <span><span class="cal-dot" style="background:var(--cyan)"></span>water goal</span>
      <span><span class="cal-dot" style="background:var(--green)"></span>protein goal</span>
      <span><span class="cal-dot" style="background:var(--amber)"></span>worked out</span>
      <span><span class="cal-dot" style="background:var(--accent2)"></span>meetings</span>
      <span style="margin-left:auto">bar = overall day score · click a day to open it</span>
    </div>
  </div>
  <div class="card">
    <h2>🔎 Day report — ${fmtDate(currentDate)} <span class="h-sub">pick any day from the calendar</span></h2>
    <div class="report-grid">
      <div class="report-stat"><div class="rs-num" style="color:var(--cyan)">${(waterTotal(day) / 1000).toFixed(2)} L</div><div class="rs-label">water</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--green)">${proteinTotal(day)} g</div><div class="rs-label">protein</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--amber)">${fiberTotal(day)} g</div><div class="rs-label">fiber</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--amber)">${day ? day.exercises.length : 0}</div><div class="rs-label">exercises</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--accent)">${routineProgress(day)}%</div><div class="rs-label">routine done</div></div>
    </div>
    <div class="report-list">
      ${day && day.dayType && day.dayType !== "normal" ? `<div>${DAY_TYPES[day.dayType].emoji} <b>${DAY_TYPES[day.dayType].label}</b> — workout not expected in the day score.</div>` : ""}
      ${day && day.exercises.length ? `<div>💪 <b>Workout:</b> ${day.exercises.map(e => `${esc(e.name)} ${e.sets}×${e.reps}`).join(", ")}</div>` : ""}
      ${day && day.meals.length ? `<div>🍽️ <b>Meals:</b> ${day.meals.map(m => `${m.type}${m.cheat ? " 🍕" : ""} — ${esc(m.text)}`).join(" · ")}</div>` : ""}
      ${meets.length ? `<div>🗓️ <b>Meetings:</b> ${meets.map(m => `${fmtTime12(m.time)} ${esc(m.title)}`).join(" · ")}</div>` : ""}
      ${!day || (!day.exercises.length && !day.meals.length && !meets.length) ? `<div class="empty">No detailed logs for this day.</div>` : ""}
    </div>
  </div>
  <div class="grid2">
    <div class="card"><h2>💧 Water — last 30 days (L)</h2>${trendSvg(water30, { color: "var(--cyan)", goal: db.settings.waterGoal / 1000, unit: "L" })}</div>
    <div class="card"><h2>🥚 Protein — last 30 days (g)</h2>${trendSvg(protein30, { color: "var(--green)", goal: db.settings.proteinGoal, unit: "g" })}</div>
    <div class="card"><h2>🌾 Fiber — last 30 days (g)</h2>${trendSvg(fiber30, { color: "var(--amber)", goal: db.settings.fiberGoal, unit: "g" })}</div>
    <div class="card"><h2>🍕 Cheat meals — this month</h2>
      ${(() => {
        const n = cheatCountForMonth(histMonth);
        const z = cheatZone(n);
        return `<div class="protein-big" style="color:${z.color};font-size:2rem;padding-top:20px">${n} <span style="font-size:.9rem">in ${dateObj(histMonth + "-01").toLocaleDateString("en-IN", { month: "long" })}</span></div>
        <div style="margin-top:8px"><span class="tag" style="background:${z.color}22;color:${z.color}">${z.label}</span></div>
        <div style="color:var(--muted);font-size:.84rem;margin-top:10px">${z.msg}</div>`;
      })()}
    </div>
  </div>
  <div class="card">
    <h2>🏆 All-time <span class="h-sub">since you started</span></h2>
    <div class="report-grid">
      <div class="report-stat"><div class="rs-num">${trackedDays}</div><div class="rs-label">days tracked</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--green)">${perfectDays}</div><div class="rs-label">perfect days (90%+)</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--cyan)">${waterStreak()}🔥</div><div class="rs-label">water streak</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--amber)">${Object.values(db.days).reduce((s, d) => s + (d.exercises ? d.exercises.length : 0), 0)}</div><div class="rs-label">total exercises</div></div>
    </div>
  </div>`;
}

/* ================= Page: Settings ================= */
function renderSettings() {
  const cfg = sync.config || { url: "", key: "" };
  const statusDot = sync.status === "ok" ? "ok" : sync.status === "error" ? "err" : "off";
  const statusText = sync.status === "ok" ? `Connected — last sync ${sync.lastSync ? sync.lastSync.toLocaleTimeString() : "just now"}`
    : sync.status === "error" ? `Error: ${sync.message}`
    : sync.status === "connecting" ? "Connecting…"
    : "Not connected — data is stored in this browser only.";
  return `
  <div class="card">
    <h2>👤 Profile & goals</h2>
    <div class="setting-row">
      <span class="s-label">Your name</span>
      <input type="text" id="setName" value="${esc(db.settings.userName)}" style="width:200px">
      <button class="btn ghost small" data-act="set-name">Save</button>
    </div>
    <div class="setting-row">
      <span class="s-label">Daily water goal (ml)</span>
      <input type="number" id="waterGoalInput" min="500" step="100" value="${db.settings.waterGoal}" style="width:130px">
      <button class="btn ghost small" data-act="set-water-goal">Save</button>
    </div>
    <div class="setting-row">
      <span class="s-label">Daily protein goal (g)</span>
      <input type="number" id="proteinGoalInput" min="10" value="${db.settings.proteinGoal}" style="width:130px">
      <button class="btn ghost small" data-act="set-protein-goal">Save</button>
    </div>
    <div class="setting-row">
      <span class="s-label">Daily fiber goal (g)</span>
      <input type="number" id="fiberGoalInput" min="5" value="${db.settings.fiberGoal}" style="width:130px">
      <button class="btn ghost small" data-act="set-fiber-goal">Save</button>
    </div>
  </div>
  <div class="card">
    <h2>🔔 Water reminders <span class="h-sub">browser notifications</span></h2>
    ${(() => {
      const r = db.settings.reminders || { water: false, interval: 90, start: "08:00", end: "22:00" };
      const perm = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
      return `
      <div class="sync-status-line">
        <span class="dot ${r.water && perm === "granted" ? "ok" : "off"}"></span>
        ${r.water && perm === "granted" ? "On — you'll get a nudge when you haven't logged a drink for a while."
          : perm === "denied" ? "Notifications are blocked for this site — allow them in your browser's site settings, then try again."
          : perm === "unsupported" ? "This browser doesn't support notifications."
          : "Off"}
      </div>
      <div class="setting-row">
        <span class="s-label">Remind me every</span>
        <select id="remInterval" data-act="rem-update" style="width:130px">
          ${[45, 60, 90, 120].map(v => `<option value="${v}" ${r.interval === v ? "selected" : ""}>${v} min</option>`).join("")}
        </select>
        <span class="s-label" style="min-width:auto">between</span>
        <input type="time" id="remStart" data-act="rem-update" value="${r.start}" style="width:110px">
        <span style="color:var(--muted)">and</span>
        <input type="time" id="remEnd" data-act="rem-update" value="${r.end}" style="width:110px">
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn ${r.water ? "danger" : ""}" data-act="rem-toggle">${r.water ? "🔕 Turn off" : "🔔 Turn on reminders"}</button>
        <button class="btn ghost" data-act="rem-test">Send test notification</button>
      </div>
      <div style="font-size:.78rem;color:var(--muted);margin-top:10px">
        Reminders fire while the app is open in a browser tab (works minimized). They pause automatically once you hit your daily goal.
        To get reminders on your <b>phone</b>, see the README — the short version: deploy this app free (Netlify/Vercel), connect the same Supabase, open it on your phone and "Add to Home screen".
      </div>`;
    })()}
  </div>
  <div class="card">
    <h2>☁️ Supabase cloud sync</h2>
    <div class="sync-status-line"><span class="dot ${statusDot}"></span> ${esc(statusText)}</div>
    <div class="setting-row">
      <span class="s-label">Project URL</span>
      <input type="text" id="sbUrl" class="grow" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url)}">
    </div>
    <div class="setting-row">
      <span class="s-label">Anon (public) key</span>
      <input type="text" id="sbKey" class="grow" placeholder="eyJhbGciOi…" value="${esc(cfg.key)}">
      <span class="s-help">Find both in Supabase → Project Settings → API. The anon key is safe to store here for a personal app.</span>
    </div>
    <div class="row" style="margin:10px 0">
      <button class="btn" data-act="sb-connect">🔌 Connect & sync</button>
      ${sync.status === "ok" ? `
        <button class="btn ghost" data-act="sb-push">⬆️ Push all to cloud</button>
        <button class="btn ghost" data-act="sb-pull">⬇️ Pull from cloud</button>` : ""}
      ${sync.config ? `<button class="btn danger" data-act="sb-disconnect">Disconnect</button>` : ""}
    </div>
    <div style="font-size:.83rem;color:var(--muted);margin-top:6px">
      <b style="color:var(--text)">One-time setup (2 minutes):</b><br>
      1. Create a free project at supabase.com → 2. Open <b>SQL Editor</b>, paste & run this → 3. Paste your URL + anon key above and hit Connect.
    </div>
    <div class="sql-block" id="sqlBlock">${esc(SETUP_SQL)}</div>
    <button class="btn ghost small" data-act="copy-sql">📋 Copy SQL</button>
  </div>
  <div class="card">
    <h2>🗄️ Backup & data</h2>
    <div class="row">
      <button class="btn ghost" data-act="export-json">⬇️ Export backup (JSON)</button>
      <label class="btn ghost" style="display:inline-flex;align-items:center;cursor:pointer">⬆️ Import backup
        <input type="file" id="importFile" accept=".json" style="display:none">
      </label>
      <button class="btn danger" data-act="wipe-all">🗑️ Erase all local data</button>
    </div>
    <div style="font-size:.78rem;color:var(--muted);margin-top:10px">Your data lives in this browser (and in Supabase once connected). Export a backup any time.</div>
  </div>`;
}

/* ================= Body-fat result ================= */
function showBfResult(bf, gender) {
  const el = document.getElementById("bfResult");
  if (!el) return;
  if (bf == null || !isFinite(bf) || bf <= 2 || bf >= 60) {
    el.className = "bf-result show";
    el.innerHTML = `<div style="color:var(--red);font-weight:600">Those measurements don't look right — double-check waist vs neck (waist must be bigger) and try again.</div>`;
    return;
  }
  const cat = bfCategory(gender, bf);
  el.className = "bf-result show";
  el.dataset.bf = bf;
  el.innerHTML = `
    <div class="bf-big bf-cat-${cat.cls}">${bf}% <span style="font-size:.95rem">body fat</span></div>
    <div style="margin:4px 0 12px;font-size:.88rem">Category: <b class="bf-cat-${cat.cls}">${cat.label}</b> (${gender === "male" ? "men" : "women"}'s bands)</div>
    <div class="row">
      <input type="number" id="bfSaveWeight" step="0.1" placeholder="Weight (kg) — optional" style="width:190px">
      <button class="btn small" data-act="bf-save">💾 Save to body log (${fmtShort(currentDate)})</button>
    </div>`;
}

/* ================= Actions ================= */
/* Each action returns undefined (re-render + save with its scope) or "no-render" */
const ACTION_SCOPES = {
  "add-milestone": "work", "del-milestone": "work", "ms-status": "work", "add-step": "work", "del-step": "work",
  "add-meeting": "work", "del-meeting": "work", "add-day-meeting": "work",
  "set-water-goal": "settings", "set-protein-goal": "settings", "set-fiber-goal": "settings", "set-name": "settings", "save-template": "settings",
  "rem-toggle": "settings", "rem-update": "settings",
  "add-eat": "settings", "del-eat": "settings", "add-avoid": "settings", "del-avoid": "settings",
  "add-body": "body", "del-body": "body", "bf-save": "body",
};

const actions = {
  /* routine */
  "toggle-routine": el => {
    const it = getDay(currentDate).routine.find(r => r.id === el.dataset.id);
    if (it) it.done = !it.done;
  },
  "del-routine": el => {
    const day = getDay(currentDate);
    day.routine = day.routine.filter(r => r.id !== el.dataset.id);
  },
  "add-routine": () => {
    const time = document.getElementById("rtTime").value || "09:00";
    const text = document.getElementById("rtText").value.trim();
    if (!text) { toast("Type what you want to do first", "err"); return "no-render"; }
    getDay(currentDate).routine.push({ id: uid(), time, text, done: false });
    toast("Routine item added");
  },
  "save-template": () => {
    const day = getDay(currentDate);
    db.settings.routineTemplate = [...day.routine].sort((a, b) => a.time.localeCompare(b.time)).map(r => ({ time: r.time, text: r.text }));
    toast("💾 Saved — new days will start with this routine");
  },
  "reset-routine": () => {
    if (!confirm("Replace this day's routine with your default template?")) return "no-render";
    getDay(currentDate).routine = db.settings.routineTemplate.map(r => ({ id: uid(), time: r.time, text: r.text, done: false }));
  },

  /* meetings (day page quick-add) */
  "add-day-meeting": () => {
    const title = document.getElementById("dmTitle").value.trim();
    if (!title) { toast("Give the meeting a title", "err"); return "no-render"; }
    const repeat = document.getElementById("dmRepeat").value;
    const days = repeat === "custom" ? pickedDays("dmDays") : [];
    if (repeat === "custom" && !days.length) { toast("Pick at least one weekday", "err"); return "no-render"; }
    db.work.meetings.push({
      id: uid(), date: currentDate, time: document.getElementById("dmTime").value || "09:00",
      title, notes: "", repeat, days,
    });
    toast("🗓️ Meeting added to " + fmtShort(currentDate));
  },
  "set-day-type": el => {
    getDay(currentDate).dayType = el.dataset.type;
    toast(`${DAY_TYPES[el.dataset.type].emoji} Marked as ${DAY_TYPES[el.dataset.type].label.toLowerCase()}`);
  },

  /* work */
  "add-milestone": () => {
    const title = document.getElementById("msTitle").value.trim();
    if (!title) { toast("Give the milestone a name", "err"); return "no-render"; }
    db.work.milestones.unshift({ id: uid(), title, target: document.getElementById("msTarget").value || null, status: "planned", steps: [] });
    toast("🎯 Milestone added");
  },
  "del-milestone": el => {
    if (!confirm("Delete this milestone and all its steps?")) return "no-render";
    db.work.milestones = db.work.milestones.filter(m => m.id !== el.dataset.id);
  },
  "ms-status": el => {
    const m = db.work.milestones.find(m => m.id === el.dataset.id);
    if (m) m.status = el.value;
  },
  "add-step": el => {
    const input = document.querySelector(`.step-input[data-id="${el.dataset.id}"]`);
    const text = input ? input.value.trim() : "";
    if (!text) { toast("Describe the step first", "err"); return "no-render"; }
    const m = db.work.milestones.find(m => m.id === el.dataset.id);
    if (m) m.steps.push({ id: uid(), date: todayStr(), text });
  },
  "del-step": el => {
    const m = db.work.milestones.find(m => m.id === el.dataset.mid);
    if (m) m.steps = m.steps.filter(s => s.id !== el.dataset.id);
  },
  "add-meeting": () => {
    const title = document.getElementById("mtTitle").value.trim();
    if (!title) { toast("Give the meeting a title", "err"); return "no-render"; }
    const repeat = document.getElementById("mtRepeat").value;
    const days = repeat === "custom" ? pickedDays("mtDays") : [];
    if (repeat === "custom" && !days.length) { toast("Pick at least one weekday (e.g. Wed + Fri)", "err"); return "no-render"; }
    db.work.meetings.push({
      id: uid(),
      date: document.getElementById("mtDate").value || todayStr(),
      time: document.getElementById("mtTime").value || "",
      title,
      notes: document.getElementById("mtNotes").value.trim(),
      repeat, days,
    });
    toast("🗓️ Meeting added");
  },
  "del-meeting": el => {
    db.work.meetings = db.work.meetings.filter(m => m.id !== el.dataset.id);
  },

  /* fitness */
  "ex-cat": el => { exCat = el.dataset.cat; exPreset = null; },
  "ex-preset": el => { exPreset = el.dataset.name; },
  "add-exercise": () => {
    const name = document.getElementById("exName").value.trim();
    const sets = parseInt(document.getElementById("exSets").value, 10);
    const reps = parseInt(document.getElementById("exReps").value, 10);
    if (!name) { toast("Pick or type an exercise name", "err"); return "no-render"; }
    if (!(sets > 0) || !(reps > 0)) { toast("Sets and reps must be positive", "err"); return "no-render"; }
    getDay(currentDate).exercises.push({ id: uid(), cat: exCat, name, sets, reps, time: nowTime() });
    exPreset = null;
    toast(`💪 ${name} ${sets}×${reps} logged`);
  },
  "del-exercise": el => {
    const day = getDay(currentDate);
    day.exercises = day.exercises.filter(e => e.id !== el.dataset.id);
  },

  /* water */
  "drink-type": el => { drinkType = el.dataset.type; },
  "add-water": el => {
    const ml = parseInt(el.dataset.ml, 10);
    getDay(currentDate).water.push({ id: uid(), ml, type: drinkType, time: nowTime() });
  },
  "add-water-custom": () => {
    const ml = parseInt(document.getElementById("customMl").value, 10);
    if (!(ml > 0)) { toast("Enter a valid amount in ml", "err"); return "no-render"; }
    getDay(currentDate).water.push({ id: uid(), ml, type: drinkType, time: nowTime() });
  },
  "del-water": el => {
    const day = getDay(currentDate);
    day.water = day.water.filter(w => w.id !== el.dataset.id);
  },
  "quick-water": el => {
    getDay(currentDate).water.push({ id: uid(), ml: parseInt(el.dataset.ml, 10), type: "water", time: nowTime() });
    toast(`💧 +${el.dataset.ml} ml`);
  },
  "quick-buttermilk": el => {
    getDay(currentDate).water.push({ id: uid(), ml: parseInt(el.dataset.ml, 10), type: "buttermilk", time: nowTime() });
    toast(`🥛 Buttermilk +${el.dataset.ml} ml`);
  },
  "quick-egg": () => {
    getDay(currentDate).protein.push({ id: uid(), food: "Egg (whole)", qty: 1, unit: "egg", grams: 6, time: nowTime() });
    toast("🥚 +6 g protein");
  },
  "set-water-goal": () => {
    const g = parseInt(document.getElementById("waterGoalInput").value, 10);
    if (!(g >= 500)) { toast("Goal must be at least 500 ml", "err"); return "no-render"; }
    db.settings.waterGoal = g;
    toast("Water goal updated");
  },

  /* protein */
  "pick-food": el => {
    const f = PROTEIN_FOODS[+el.dataset.idx];
    document.getElementById("pfName").value = f.name;
    document.getElementById("pfPer").value = f.protein;
    document.getElementById("pfUnit").textContent = `× ${f.unit}`;
    document.getElementById("pfName").dataset.unit = f.unit;
    document.getElementById("pfQty").focus();
    return "no-render";
  },
  "add-protein": () => {
    const nameEl = document.getElementById("pfName");
    const food = nameEl.value.trim();
    const qty = parseFloat(document.getElementById("pfQty").value);
    const per = parseFloat(document.getElementById("pfPer").value);
    if (!food) { toast("Enter a food name (or tap a preset)", "err"); return "no-render"; }
    if (!(qty > 0)) { toast("Quantity must be positive", "err"); return "no-render"; }
    if (isNaN(per) || per < 0) { toast("Enter protein grams per unit", "err"); return "no-render"; }
    const grams = Math.round(qty * per * 10) / 10;
    getDay(currentDate).protein.push({ id: uid(), food, qty, unit: nameEl.dataset.unit || "unit", grams, time: nowTime() });
    toast(`🥚 +${grams} g protein`);
  },
  "del-protein": el => {
    const day = getDay(currentDate);
    day.protein = day.protein.filter(p => p.id !== el.dataset.id);
  },
  "set-protein-goal": () => {
    const g = parseInt(document.getElementById("proteinGoalInput").value, 10);
    if (!(g >= 10)) { toast("Goal must be at least 10 g", "err"); return "no-render"; }
    db.settings.proteinGoal = g;
    toast("Protein goal updated");
  },

  /* fiber */
  "pick-fiber": el => {
    const f = FIBER_FOODS[+el.dataset.idx];
    document.getElementById("fbName").value = f.name;
    document.getElementById("fbPer").value = f.fiber;
    document.getElementById("fbUnit").textContent = `× ${f.unit}`;
    document.getElementById("fbName").dataset.unit = f.unit;
    document.getElementById("fbQty").focus();
    return "no-render";
  },
  "add-fiber": () => {
    const nameEl = document.getElementById("fbName");
    const food = nameEl.value.trim();
    const qty = parseFloat(document.getElementById("fbQty").value);
    const per = parseFloat(document.getElementById("fbPer").value);
    if (!food) { toast("Enter a food name (or tap a preset)", "err"); return "no-render"; }
    if (!(qty > 0)) { toast("Quantity must be positive", "err"); return "no-render"; }
    if (isNaN(per) || per < 0) { toast("Enter fiber grams per unit", "err"); return "no-render"; }
    const grams = Math.round(qty * per * 10) / 10;
    getDay(currentDate).fiber.push({ id: uid(), food, qty, unit: nameEl.dataset.unit || "unit", grams, time: nowTime() });
    toast(`🌾 +${grams} g fiber`);
  },
  "del-fiber": el => {
    const day = getDay(currentDate);
    day.fiber = day.fiber.filter(p => p.id !== el.dataset.id);
  },
  "set-fiber-goal": () => {
    const g = parseInt(document.getElementById("fiberGoalInput").value, 10);
    if (!(g >= 5)) { toast("Goal must be at least 5 g", "err"); return "no-render"; }
    db.settings.fiberGoal = g;
    toast("Fiber goal updated");
  },

  /* nutrition page */
  "add-eat": () => {
    const v = document.getElementById("eatNew").value.trim();
    if (v) db.settings.eatList.push(v); else return "no-render";
  },
  "del-eat": el => { db.settings.eatList.splice(+el.dataset.idx, 1); },
  "add-avoid": () => {
    const v = document.getElementById("avoidNew").value.trim();
    if (v) db.settings.avoidList.push(v); else return "no-render";
  },
  "del-avoid": el => { db.settings.avoidList.splice(+el.dataset.idx, 1); },
  "add-meal": () => {
    const text = document.getElementById("mealText").value.trim();
    if (!text) { toast("Describe what you ate", "err"); return "no-render"; }
    const cheat = document.getElementById("mealCheat").checked;
    getDay(currentDate).meals.push({ id: uid(), type: document.getElementById("mealType").value, text, time: nowTime(), cheat });
    if (cheat) {
      const n = cheatCountForMonth(currentDate.slice(0, 7));
      const z = cheatZone(n);
      toast(`🍕 Cheat meal #${n} this month — ${z.label}`, n > 4 ? "err" : "ok");
    } else toast("🍽️ Meal logged");
  },
  "del-meal": el => {
    const day = getDay(currentDate);
    day.meals = day.meals.filter(m => m.id !== el.dataset.id);
  },
  "add-body": () => {
    const date = document.getElementById("bodyDate").value || todayStr();
    const weight = parseFloat(document.getElementById("bodyWeight").value);
    const bodyFat = parseFloat(document.getElementById("bodyPct").value);
    if (isNaN(weight) && isNaN(bodyFat)) { toast("Enter weight, body fat %, or both", "err"); return "no-render"; }
    db.body = db.body.filter(b => b.date !== date);
    db.body.push({ date, weight: isNaN(weight) ? null : weight, bodyFat: isNaN(bodyFat) ? null : bodyFat });
    toast("⚖️ Body entry saved");
  },
  "del-body": el => { db.body = db.body.filter(b => b.date !== el.dataset.date); },

  /* body-fat calculator */
  "bf-gender": el => { bfGender = el.dataset.g; },
  "bf-calc": () => {
    const h = parseFloat(document.getElementById("bfHeight").value);
    const n = parseFloat(document.getElementById("bfNeck").value);
    const w = parseFloat(document.getElementById("bfWaist").value);
    const hip = parseFloat(document.getElementById("bfHip").value);
    if (isNaN(h) || isNaN(n) || isNaN(w) || (bfGender === "female" && isNaN(hip))) {
      toast("Fill in all measurements (cm)", "err"); return "no-render";
    }
    if (bfGender === "male" && w <= n) { showBfResult(null, bfGender); return "no-render"; }
    showBfResult(navyBodyFat(bfGender, h, n, w, hip), bfGender);
    return "no-render";
  },
  "bf-save": () => {
    const bf = parseFloat(document.getElementById("bfResult").dataset.bf);
    if (isNaN(bf)) return "no-render";
    const weight = parseFloat(document.getElementById("bfSaveWeight").value);
    const existing = db.body.find(b => b.date === currentDate);
    db.body = db.body.filter(b => b.date !== currentDate);
    db.body.push({ date: currentDate, weight: isNaN(weight) ? (existing ? existing.weight : null) : weight, bodyFat: bf });
    toast(`💾 ${bf}% body fat saved to ${fmtShort(currentDate)}`);
  },

  /* history */
  "goto-day": el => { currentDate = el.dataset.date; currentPage = "day"; },
  "hist-month": el => {
    const [y, m] = histMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + parseInt(el.dataset.delta, 10), 1);
    histMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return "render-only";
  },

  /* settings */
  "set-name": () => {
    const v = document.getElementById("setName").value.trim();
    if (!v) { toast("Enter a name", "err"); return "no-render"; }
    db.settings.userName = v;
    toast("Saved 👋");
  },
  "rem-toggle": () => {
    const r = db.settings.reminders;
    if (r.water) {
      r.water = false;
      toast("🔕 Water reminders off");
      return;
    }
    // read the interval/window inputs as part of enabling
    r.interval = parseInt(document.getElementById("remInterval").value, 10) || 90;
    r.start = document.getElementById("remStart").value || "08:00";
    r.end = document.getElementById("remEnd").value || "22:00";
    if (typeof Notification === "undefined") { toast("This browser doesn't support notifications", "err"); return "no-render"; }
    Notification.requestPermission().then(perm => {
      if (perm === "granted") {
        db.settings.reminders.water = true;
        save("settings");
        toast(`🔔 On — every ${db.settings.reminders.interval} min, ${fmtTime12(db.settings.reminders.start)}–${fmtTime12(db.settings.reminders.end)}`);
      } else {
        toast("Permission not granted — reminders stay off", "err");
      }
      render();
    });
    return "no-render";
  },
  "rem-update": () => {
    const r = db.settings.reminders;
    r.interval = parseInt(document.getElementById("remInterval").value, 10) || 90;
    r.start = document.getElementById("remStart").value || "08:00";
    r.end = document.getElementById("remEnd").value || "22:00";
    toast("Reminder schedule updated");
  },
  "rem-test": () => {
    if (typeof Notification === "undefined") { toast("This browser doesn't support notifications", "err"); return "no-render"; }
    if (Notification.permission !== "granted") { toast("Turn on reminders first (grants permission)", "err"); return "no-render"; }
    new Notification("💧 Momentum — test", { body: "Reminders are working! Stay hydrated 🦙" });
    return "no-render";
  },
  "sb-connect": () => {
    const url = document.getElementById("sbUrl").value.trim();
    const key = document.getElementById("sbKey").value.trim();
    if (!url || !key) { toast("Enter both the project URL and anon key", "err"); return "no-render"; }
    sync.config = { url, key };
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync.config));
    syncConnect(true);
    return "render-only";
  },
  "sb-push": () => {
    Object.keys(db.days).forEach(d => sync.dirty.add(`day:${d}`));
    ["work", "settings", "body"].forEach(k => sync.dirty.add(k));
    flushPush().then(() => { toast("⬆️ Everything pushed to Supabase"); if (currentPage === "settings") render(); });
    return "no-render";
  },
  "sb-pull": () => {
    pullAll().then(() => { toast("⬇️ Pulled latest from Supabase"); render(); })
      .catch(e => toast("Pull failed: " + e.message, "err"));
    return "no-render";
  },
  "sb-disconnect": () => {
    if (!confirm("Disconnect Supabase? Your local data stays; cloud data stays too.")) return "no-render";
    sync.config = null; sync.client = null; sync.status = "off"; sync.dirty.clear();
    localStorage.removeItem(SYNC_KEY);
    toast("Disconnected — running local-only");
  },
  "copy-sql": () => {
    navigator.clipboard.writeText(SETUP_SQL).then(() => toast("📋 SQL copied — paste it in Supabase SQL Editor"));
    return "no-render";
  },
  "export-json": () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `momentum-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("⬇️ Backup downloaded");
    return "no-render";
  },
  "wipe-all": () => {
    if (!confirm("Erase ALL local data? (Cloud data is not touched.) Export a backup first if unsure.")) return "no-render";
    if (!confirm("Really sure? This cannot be undone locally.")) return "no-render";
    localStorage.removeItem(STORE_KEY);
    load();
    toast("All local data erased");
  },
};

/* ================= Event wiring ================= */
function runAction(act, el) {
  const fn = actions[act];
  if (!fn) return;
  const result = fn(el);
  if (result === "no-render") return;
  if (result === "render-only") { render(); return; }
  save(ACTION_SCOPES[act] || "day");
  render();
}

function bindPage() {
  const container = document.getElementById("pageContainer");
  container.onclick = e => {
    const nav = e.target.closest("[data-goto]");
    if (nav) { currentPage = nav.dataset.goto; render(); return; }
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "SELECT") return;
    runAction(el.dataset.act, el);
  };
  container.onchange = e => {
    if (e.target.id === "importFile" && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.days || !data.settings) throw new Error("not a Momentum backup");
          if (!confirm("Import this backup? It will replace your current local data.")) return;
          localStorage.setItem(STORE_KEY, JSON.stringify(data));
          load();
          Object.keys(db.days).forEach(d => queuePush(`day:${d}`));
          ["work", "settings", "body"].forEach(k => queuePush(k));
          render();
          toast("⬆️ Backup imported");
        } catch (err) { toast("Import failed: " + err.message, "err"); }
      };
      reader.readAsText(e.target.files[0]);
      return;
    }
    const el = e.target.closest("select[data-act], input[data-act]");
    if (el) runAction(el.dataset.act, el);
  };
  // "Custom days…" repeat option reveals the weekday picker
  ["dm", "mt"].forEach(p => {
    const sel = document.getElementById(p + "Repeat");
    const row = document.getElementById(p + "Days");
    if (sel && row) sel.addEventListener("change", () => { row.style.display = sel.value === "custom" ? "flex" : "none"; });
  });
  const enterMap = {
    rtText: "add-routine", msTitle: "add-milestone", mtTitle: "add-meeting", dmTitle: "add-day-meeting",
    customMl: "add-water-custom", eatNew: "add-eat", avoidNew: "add-avoid",
    mealText: "add-meal", exName: "add-exercise",
  };
  Object.entries(enterMap).forEach(([id, act]) => {
    const inp = document.getElementById(id);
    if (inp) inp.addEventListener("keydown", ev => { if (ev.key === "Enter") runAction(act, inp); });
  });
}

function init() {
  load();
  document.querySelectorAll(".nav-item").forEach(t => t.addEventListener("click", () => { currentPage = t.dataset.page; render(); }));
  document.getElementById("syncBadge").addEventListener("click", () => { currentPage = "settings"; render(); });
  document.getElementById("prevDay").addEventListener("click", () => { currentDate = shiftDate(currentDate, -1); render(); });
  document.getElementById("nextDay").addEventListener("click", () => { currentDate = shiftDate(currentDate, 1); render(); });
  document.getElementById("todayBtn").addEventListener("click", () => { currentDate = todayStr(); histMonth = currentDate.slice(0, 7); render(); });
  document.getElementById("datePicker").addEventListener("change", e => { if (e.target.value) { currentDate = e.target.value; render(); } });
  render();
  if (sync.config) syncConnect(false);
  startReminderLoop();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

document.addEventListener("DOMContentLoaded", init);
