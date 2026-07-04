/* ============ Momentum — Personal Life OS (v4) ============
   Unified food log (kcal/protein/fiber/water = one event),
   calorie deficit engine, adaptive routine with wake-shift +
   conflict resolution, timezone awareness, office/commute days,
   normalized-table Supabase sync (see supabase-migration-v2.sql).
*/
"use strict";

const STORE_KEY = "lifetracker-v1";   // key kept for continuity; payload carries v:2
const SYNC_KEY = "lifetracker-sync";
const APP_URL = "https://johnbariga.github.io/momentum-tracker/";

/* ================= Presets ================= */
/* One catalog: every food knows kcal + protein + fiber (+ml for beverages). */
const FOOD_CATALOG = [
  { name: "Water",               cat: "beverage", unit: "100 ml",        kcal: 0,   protein: 0,   fiber: 0,   ml: 100 },
  { name: "Buttermilk",          cat: "beverage", unit: "glass (250ml)", kcal: 35,  protein: 2,   fiber: 0,   ml: 250 },
  { name: "Milk",                cat: "beverage", unit: "glass (250ml)", kcal: 150, protein: 8,   fiber: 0,   ml: 250 },
  { name: "Egg (whole)",         cat: "food", unit: "egg",        kcal: 78,  protein: 6,   fiber: 0 },
  { name: "Egg white",           cat: "food", unit: "egg white",  kcal: 17,  protein: 3.6, fiber: 0 },
  { name: "Chicken breast",      cat: "food", unit: "100g",       kcal: 165, protein: 31,  fiber: 0 },
  { name: "Fish",                cat: "food", unit: "100g",       kcal: 130, protein: 22,  fiber: 0 },
  { name: "Paneer",              cat: "food", unit: "100g",       kcal: 265, protein: 18,  fiber: 0 },
  { name: "Whey protein",        cat: "food", unit: "scoop",      kcal: 120, protein: 24,  fiber: 0 },
  { name: "Curd",                cat: "food", unit: "100g",       kcal: 60,  protein: 4,   fiber: 0 },
  { name: "Dal (cooked)",        cat: "food", unit: "100g",       kcal: 115, protein: 9,   fiber: 8 },
  { name: "Soya chunks",         cat: "food", unit: "50g dry",    kcal: 170, protein: 26,  fiber: 6.5 },
  { name: "Peanuts",             cat: "food", unit: "30g",        kcal: 170, protein: 7.5, fiber: 2.5 },
  { name: "Oats (dry)",          cat: "food", unit: "40g",        kcal: 150, protein: 5,   fiber: 4 },
  { name: "Apple",               cat: "food", unit: "medium",     kcal: 95,  protein: 0.5, fiber: 4.4 },
  { name: "Banana",              cat: "food", unit: "medium",     kcal: 105, protein: 1.3, fiber: 3.1 },
  { name: "Orange",              cat: "food", unit: "medium",     kcal: 62,  protein: 1.2, fiber: 3 },
  { name: "Guava",               cat: "food", unit: "medium",     kcal: 68,  protein: 2.6, fiber: 5.4 },
  { name: "Rajma (cooked)",      cat: "food", unit: "100g",       kcal: 127, protein: 8.7, fiber: 6.4 },
  { name: "Chana (cooked)",      cat: "food", unit: "100g",       kcal: 164, protein: 8.9, fiber: 7.6 },
  { name: "Roti / chapati",      cat: "food", unit: "roti",       kcal: 104, protein: 3,   fiber: 2 },
  { name: "Rice (cooked)",       cat: "food", unit: "100g",       kcal: 130, protein: 2.7, fiber: 0.4 },
  { name: "Brown rice (cooked)", cat: "food", unit: "100g",       kcal: 111, protein: 2.6, fiber: 1.8 },
  { name: "Broccoli",            cat: "food", unit: "100g",       kcal: 34,  protein: 2.8, fiber: 2.6 },
  { name: "Carrot",              cat: "food", unit: "100g",       kcal: 41,  protein: 0.9, fiber: 2.8 },
  { name: "Spinach (cooked)",    cat: "food", unit: "100g",       kcal: 23,  protein: 3,   fiber: 2.4 },
  { name: "Sweet potato",        cat: "food", unit: "100g",       kcal: 86,  protein: 1.6, fiber: 3 },
  { name: "Chia seeds",          cat: "food", unit: "tbsp",       kcal: 58,  protein: 2,   fiber: 4.1 },
  { name: "Flax seeds",          cat: "food", unit: "tbsp",       kcal: 55,  protein: 1.9, fiber: 2.8 },
  { name: "Almonds",             cat: "food", unit: "30g",        kcal: 174, protein: 6.3, fiber: 3.5 },
  { name: "Mixed salad",         cat: "food", unit: "bowl",       kcal: 50,  protein: 2,   fiber: 3 },
  { name: "Mixed veg (cooked)",  cat: "food", unit: "100g",       kcal: 60,  protein: 2,   fiber: 3 },
];

const DEFAULT_ROUTINE = [
  { time: "06:00", text: "Wake up", anchored: false },
  { time: "06:10", text: "Drink a glass of water", anchored: false },
  { time: "06:30", text: "Morning workout", anchored: false },
  { time: "07:30", text: "Bath & get ready", anchored: false },
  { time: "08:15", text: "Breakfast", anchored: false },
  { time: "13:00", text: "Lunch", anchored: false },
  { time: "16:30", text: "Evening snack + water check", anchored: false },
  { time: "19:00", text: "Walk / evening exercise", anchored: false },
  { time: "20:30", text: "Dinner", anchored: false },
  { time: "21:30", text: "Plan tomorrow + log the day", anchored: false },
  { time: "22:30", text: "Sleep", anchored: false },
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

const TZ_PICKS = [
  { label: "CT — Austin/Chicago", tz: "America/Chicago" },
  { label: "PT — Seattle/LA", tz: "America/Los_Angeles" },
  { label: "MT — Denver", tz: "America/Denver" },
  { label: "ET — New York", tz: "America/New_York" },
  { label: "IST — India", tz: "Asia/Kolkata" },
];

/* John's non-veg calorie-deficit plan (~2,280 kcal / ~160g protein / ~31g fiber) */
const MEAL_PLAN = [
  { meal: "Breakfast", target: "~540 kcal · 38g protein", items: "3 whole eggs + 2 egg whites scramble · 40g oats cooked in 250ml milk" },
  { meal: "Lunch", target: "~630 kcal · 50g protein", items: "150g chicken breast · 150g rice · mixed veg/salad · 1 tsp oil" },
  { meal: "Snack", target: "~370 kcal · 32g protein", items: "Whey scoop in water · 30g peanuts · 1 apple" },
  { meal: "Dinner", target: "~600 kcal · 45g protein", items: "150g chicken or fish · 2 rotis · 100g dal · salad" },
  { meal: "Anytime", target: "~35 kcal · 2g protein", items: "1 glass buttermilk (counts toward your 3L hydration too)" },
];

const SETUP_SQL_NOTE = "Run supabase-migration-v2.sql (in the app folder / GitHub repo) in the Supabase SQL Editor.";

/* ================= State ================= */
let db = null;
let currentDate = todayStr();
let currentPage = "dashboard";
let exCat = "abs";
let exPreset = null;
let histMonth = currentDate.slice(0, 7);
let logMealType = "";       // selected meal tag on calorie quick-add

const sync = {
  config: null, client: null,
  status: "off", message: "", lastSync: null,
  dirty: new Set(), timer: null,
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
function fmtDate(dateStr) { return dateObj(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
function fmtShort(dateStr) { return dateObj(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
function shiftDate(dateStr, delta) {
  const d = dateObj(dateStr); d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toMin(t) { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function toHM(mins) {
  mins = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
function fmtTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function round1(n) { return Math.round(n * 10) / 10; }
function toast(msg, type = "ok") {
  const wrap = document.getElementById("toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ---------- timezone math (IANA, DST-safe, via Intl) ---------- */
function tzOffsetMin(tz, dateStr) {
  try {
    const probe = new Date(dateStr + "T12:00:00Z");
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(probe).map(p => [p.type, p.value]));
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
    return (asUTC - probe.getTime()) / 60000;
  } catch (e) { return 0; }
}
/* convert wall-clock HH:MM anchored in fromTz to what the clock shows in toTz on that date */
function convertTime(timeStr, fromTz, toTz, dateStr) {
  if (!timeStr || fromTz === toTz) return timeStr;
  return toHM(toMin(timeStr) + tzOffsetMin(toTz, dateStr) - tzOffsetMin(fromTz, dateStr));
}
function tzShort(tz) { const p = TZ_PICKS.find(p => p.tz === tz); return p ? p.label.split(" ")[0] : tz.split("/").pop(); }

/* ================= Persistence & migration ================= */
function defaultDb() {
  return {
    v: 2,
    days: {},
    work: { milestones: [], meetings: [] },
    settings: {
      userName: "John",
      waterGoal: 3000, proteinGoal: 160, fiberGoal: 32,
      physio: { weightKg: 80, heightCm: 180, age: 27, sex: "male", activity: 1.55, deficit: 500 },
      homeTz: "America/Chicago", currentTz: "America/Chicago",
      office: { days: [2, 4], start: "09:00", end: "18:00", commuteMin: 40 }, // JS getDay: 2=Tue 4=Thu
      meetingDurationMin: 30,
      routineTemplate: DEFAULT_ROUTINE.map(r => ({ ...r })),
      eatList: [...DEFAULT_EAT], avoidList: [...DEFAULT_AVOID],
      reminders: { water: false, interval: 90, start: "08:00", end: "22:00" },
    },
    body: [],
    meta: {},
  };
}

function catalogByName(name) { return FOOD_CATALOG.find(f => f.name === name); }

/* v1 day shape (water/protein/fiber/meals arrays) -> v2 unified foods[] */
function migrateDayV1(old) {
  const foods = [];
  (old.water || []).forEach(w => {
    const isBm = w.type === "buttermilk";
    foods.push({
      id: w.id, food: isBm ? "Buttermilk" : "Water", qty: 1, unit: "entry",
      ml: w.ml, kcal: isBm ? Math.round(w.ml * 35 / 250) : 0,
      protein: isBm ? round1(w.ml * 2 / 250) : 0, fiber: 0, time: w.time,
    });
  });
  (old.protein || []).forEach(p => foods.push({
    id: p.id, food: p.food, qty: p.qty, unit: p.unit, ml: 0,
    kcal: 0, protein: p.grams, fiber: 0, time: p.time,   // historical kcal unknown
  }));
  (old.fiber || []).forEach(f => foods.push({
    id: f.id, food: f.food, qty: f.qty, unit: f.unit, ml: 0,
    kcal: 0, protein: 0, fiber: f.grams, time: f.time,
  }));
  (old.meals || []).forEach(m => foods.push({
    id: m.id, food: m.text, qty: 1, unit: "meal", ml: 0,
    kcal: 0, protein: 0, fiber: 0, time: m.time, mealType: m.type, cheat: !!m.cheat,
  }));
  return {
    routine: (old.routine || []).map(r => ({ anchored: /office/i.test(r.text), ...r })),
    foods,
    exercises: old.exercises || [],
    dayType: old.dayType || "normal",
    actualWake: old.actualWake || null,
  };
}

function load() {
  db = defaultDb();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const isV1 = !saved.v;
      db.days = {};
      for (const [date, day] of Object.entries(saved.days || {})) {
        db.days[date] = (isV1 || !day.foods) ? migrateDayV1(day) : day;
      }
      db.work = saved.work || db.work;
      db.work.milestones = db.work.milestones || [];
      db.work.meetings = (db.work.meetings || []).map(m => ({ repeat: "none", days: [], durationMin: db.settings.meetingDurationMin, ...m }));
      const d = defaultDb();
      db.settings = Object.assign(d.settings, saved.settings || {});
      db.settings.physio = Object.assign(d.settings.physio, (saved.settings || {}).physio || {});
      db.settings.office = Object.assign(d.settings.office, (saved.settings || {}).office || {});
      db.settings.reminders = Object.assign(d.settings.reminders, (saved.settings || {}).reminders || {});
      db.settings.routineTemplate = (db.settings.routineTemplate || []).map(r => ({ anchored: /office/i.test(r.text), ...r }));
      if (isV1 && db.settings.proteinGoal < 160) db.settings.proteinGoal = 160; // cut targets
      const bodyByDate = new Map();
      (saved.body || []).forEach(b => bodyByDate.set(b.date, b));
      db.body = [...bodyByDate.values()];
      db.meta = saved.meta || {};
    }
  } catch (e) { console.error("load failed", e); }
  try { sync.config = JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); } catch (e) { sync.config = null; }
}

function persistLocal() { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }

function save(scope = "day") {
  const key = scope === "day" ? `day:${currentDate}` : scope;
  db.meta[key] = Date.now();
  persistLocal();
  queuePush(key);
}

function getDay(dateStr) {
  if (!db.days[dateStr]) {
    db.days[dateStr] = {
      routine: db.settings.routineTemplate.map(r => ({ id: uid(), time: r.time, text: r.text, anchored: !!r.anchored, done: false })),
      foods: [], exercises: [], dayType: "normal", actualWake: null,
    };
  }
  const day = db.days[dateStr];
  day.routine = day.routine || []; day.foods = day.foods || []; day.exercises = day.exercises || [];
  day.dayType = day.dayType || "normal";
  return day;
}
function peekDay(dateStr) { return db.days[dateStr] || null; }

/* ================= Nutrition math ================= */
function waterTotal(day) { return day ? day.foods.reduce((s, f) => s + (f.ml || 0), 0) : 0; }
function kcalTotal(day) { return day ? Math.round(day.foods.reduce((s, f) => s + (f.kcal || 0), 0)) : 0; }
function proteinTotal(day) { return day ? round1(day.foods.reduce((s, f) => s + (f.protein || 0), 0)) : 0; }
function fiberTotal(day) { return day ? round1(day.foods.reduce((s, f) => s + (f.fiber || 0), 0)) : 0; }
function routineProgress(day) {
  if (!day || !day.routine.length) return 0;
  return Math.round(day.routine.filter(r => r.done).length / day.routine.length * 100);
}
function cheatCountForMonth(ym) {
  let n = 0;
  for (const [d, day] of Object.entries(db.days)) if (d.startsWith(ym)) n += (day.foods || []).filter(f => f.cheat).length;
  return n;
}
function cheatZone(n) {
  if (n <= 2) return { label: "Green zone", color: "var(--green)", msg: "Disciplined — cheat meals well under control." };
  if (n <= 4) return { label: "Yellow zone", color: "var(--amber)", msg: "Careful — you're close to the monthly limit." };
  return { label: "Red zone", color: "var(--red)", msg: "Too many cheat meals this month — time to tighten up!" };
}
const DAY_TYPES = { normal: { label: "Work day", emoji: "🏢" }, rest: { label: "Rest day", emoji: "😴" }, holiday: { label: "Holiday", emoji: "🎉" } };

/* Mifflin-St Jeor */
function calorieEngine() {
  const p = db.settings.physio;
  const bmr = p.sex === "male"
    ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;
  const tdee = Math.round(bmr * p.activity);
  return { bmr: Math.round(bmr), tdee, target: tdee - p.deficit, deficit: p.deficit };
}
function dayScore(dateStr) {
  const day = peekDay(dateStr);
  if (!day) return null;
  const eng = calorieEngine();
  const kc = kcalTotal(day);
  const parts = [
    Math.min(1, waterTotal(day) / db.settings.waterGoal),
    Math.min(1, proteinTotal(day) / db.settings.proteinGoal),
    routineProgress(day) / 100,
  ];
  if (kc > 0) parts.push(kc <= eng.target ? 1 : Math.max(0, 1 - (kc - eng.target) / 500));
  if (!day.dayType || day.dayType === "normal") parts.push(day.exercises.length > 0 ? 1 : 0);
  return Math.round(parts.reduce((s, v) => s + v, 0) / parts.length * 100);
}
function waterStreak() {
  let streak = 0, d = todayStr();
  if (waterTotal(peekDay(d)) < db.settings.waterGoal) d = shiftDate(d, -1);
  while (waterTotal(peekDay(d)) >= db.settings.waterGoal) { streak++; d = shiftDate(d, -1); }
  return streak;
}

/* ================= Meetings & recurrence ================= */
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
    .map(m => ({ ...m, localTime: convertTime(m.time, db.settings.homeTz, db.settings.currentTz, dateStr) }))
    .sort((a, b) => (a.localTime || "").localeCompare(b.localTime || ""));
}
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function repeatLabel(mt) {
  if (!mt.repeat || mt.repeat === "none") return "";
  if (mt.repeat === "daily") return "Daily";
  if (mt.repeat === "weekdays") return "Mon–Fri";
  if (mt.repeat === "weekly") return "Weekly";
  if (mt.repeat === "custom")
    return (mt.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DOW_SHORT[d]).join(", ");
  return "";
}
function repeatOptionsHtml(id) {
  return `<select id="${id}" style="width:150px">
    <option value="none">One-time</option><option value="daily">Daily</option>
    <option value="weekdays">Mon–Fri</option><option value="weekly">Weekly</option>
    <option value="custom">Custom days…</option>
  </select>`;
}
function dayPickerHtml(id, checked = []) {
  return `<div class="dow-row" id="${id}" style="display:none">
    ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="dow-chip"><input type="checkbox" value="${d}" ${checked.includes(d) ? "checked" : ""}><span>${DOW_SHORT[d]}</span></label>`).join("")}
  </div>`;
}
function pickedDays(pickerId) {
  return [...document.querySelectorAll(`#${pickerId} input:checked`)].map(i => +i.value);
}

/* ================= Day timeline engine (wake shift + conflicts + tz) ================= */
function isOfficeDay(dateStr) {
  const day = peekDay(dateStr);
  if (day && day.dayType !== "normal") return false;   // no office on rest days/holidays
  return db.settings.office.days.includes(dateObj(dateStr).getDay());
}
function officeBlocksLocal(dateStr) {
  // office hours + commute, anchored to home/company tz, shown in current tz
  const o = db.settings.office;
  const start = convertTime(o.start, db.settings.homeTz, db.settings.currentTz, dateStr);
  const end = convertTime(o.end, db.settings.homeTz, db.settings.currentTz, dateStr);
  const blocks = [{ kind: "office", title: "Office hours", start: toMin(start), end: toMin(end) }];
  if (isOfficeDay(dateStr)) {
    blocks.push({ kind: "commute", title: "🚗 Drive to office", start: toMin(start) - o.commuteMin, end: toMin(start), dir: "to_office" });
    blocks.push({ kind: "commute", title: "🚗 Drive home", start: toMin(end), end: toMin(end) + o.commuteMin, dir: "to_home" });
  }
  return blocks;
}
function templateWakeMin(day) {
  const wake = day.routine.find(r => /wake/i.test(r.text));
  if (wake) return toMin(wake.time);
  const times = day.routine.filter(r => !r.anchored).map(r => toMin(r.time));
  return times.length ? Math.min(...times) : 360;
}
const WORKOUT_RE = /workout|exercise|gym|walk|run|jog/i;
const LATE_CUTOFF = 23.75 * 60; // items pushed past 23:45 are skipped

/* Build the day's plan: routine (shifted if late wake) + meetings + office/commute,
   flexible items are slid out of anchored windows like a human would. */
function buildTimeline(dateStr) {
  const day = getDay(dateStr);
  const meets = meetingsForDate(dateStr);
  const anchoredWindows = []; // {start, end, label}
  const items = [];

  meets.forEach(m => {
    const start = toMin(m.localTime || "09:00");
    const dur = m.durationMin || db.settings.meetingDurationMin || 30;
    anchoredWindows.push({ start, end: start + dur });
    items.push({ kind: "meeting", time: toHM(start), sort: start, item: m });
  });

  const isWorkDay = day.dayType === "normal" && dateObj(dateStr).getDay() >= 1 && dateObj(dateStr).getDay() <= 5;
  if (isWorkDay) {
    officeBlocksLocal(dateStr).forEach(b => {
      if (b.kind === "commute") {
        anchoredWindows.push({ start: b.start, end: b.end });
        items.push({ kind: "commute", time: toHM(b.start), sort: b.start, item: { title: b.title, dir: b.dir, minutes: db.settings.office.commuteMin } });
      } else {
        items.push({ kind: "office", time: toHM(b.start), sort: b.start, item: { title: `Office — start (${fmtTime12(toHM(b.end))} end)`, endMin: b.end } });
      }
    });
  }
  const office = isWorkDay ? officeBlocksLocal(dateStr).find(b => b.kind === "office") : null;

  // wake shift
  const tmplWake = templateWakeMin(day);
  const delta = day.actualWake ? toMin(day.actualWake) - tmplWake : 0;

  const inWindow = t => anchoredWindows.find(w => t >= w.start && t < w.end);
  const routine = [...day.routine].sort((a, b) => toMin(a.time) - toMin(b.time));
  routine.forEach(r => {
    let t = toMin(r.time);
    let note = "";
    let skipped = false;
    if (!r.anchored && delta !== 0) {
      t += delta;
      note = `was ${fmtTime12(r.time)}`;
    }
    if (!r.anchored) {
      // human rule: workout landing inside office hours -> propose after office end
      if (office && WORKOUT_RE.test(r.text) && t >= office.start && t < office.end) {
        t = office.end + 15;
        note = `moved after office (${note || "conflict"})`;
      }
      // slide out of meetings/commute windows
      let guard = 0, w;
      while ((w = inWindow(t)) && guard < 10) { t = w.end + 5; note = note ? note + " · shifted for meeting" : "shifted for meeting"; guard++; }
      if (t >= LATE_CUTOFF && !/sleep/i.test(r.text)) { skipped = true; note = "too late today — skipped"; }
      if (/sleep/i.test(r.text)) t = Math.min(Math.max(t, toMin(r.time)), 1439);
    }
    items.push({ kind: "routine", time: toHM(t), sort: skipped ? 100000 : t, item: r, note, skipped, shifted: t !== toMin(r.time) });
  });

  items.sort((a, b) => a.sort - b.sort);
  return { items, delta, meets };
}

/* ================= Supabase sync (normalized tables) ================= */
function loadSupabaseLib() {
  return new Promise((resolve, reject) => {
    if (window.supabase) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the Supabase library (check internet)."));
    document.head.appendChild(s);
  });
}

async function syncConnect(showToasts) {
  if (!sync.config || !sync.config.url || !sync.config.key) { sync.status = "off"; updateSyncBadge(); return; }
  sync.status = "connecting"; sync.message = "Connecting…"; updateSyncBadge();
  try {
    await loadSupabaseLib();
    sync.client = window.supabase.createClient(sync.config.url, sync.config.key);
    const { error } = await sync.client.from("day_info").select("date").limit(1);
    if (error) throw new Error(error.message + (error.message.includes("does not exist") ? ` — ${SETUP_SQL_NOTE}` : ""));
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

const hm = t => (t ? String(t).slice(0, 5) : null); // 'HH:MM:SS' -> 'HH:MM'

async function pullAll() {
  if (!sync.client) return;
  const q = async (table, sel = "*") => {
    const { data, error } = await sync.client.from(table).select(sel);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data || [];
  };
  const [dayInfos, foods, exercises, schedules, meetings, milestones, steps, bodies, settingsRows, workMeta] =
    await Promise.all([q("day_info"), q("consumption_log"), q("exercise_log"), q("schedule_log"),
      q("meetings"), q("milestones"), q("milestone_steps"), q("body_log"), q("app_settings"), q("work_meta")]);

  let changed = false;
  // ----- days (LWW per date via day_info.updated_at) -----
  const byDate = {};
  dayInfos.forEach(di => { byDate[di.date] = { di, foods: [], exercises: [], routine: [] }; });
  const ensure = d => byDate[d] || (byDate[d] = { di: null, foods: [], exercises: [], routine: [] });
  foods.forEach(r => ensure(r.date).foods.push(r));
  exercises.forEach(r => ensure(r.date).exercises.push(r));
  schedules.filter(r => r.kind === "routine").forEach(r => ensure(r.date).routine.push(r));

  for (const [date, g] of Object.entries(byDate)) {
    const scope = `day:${date}`;
    const remote = g.di ? Date.parse(g.di.updated_at) : 1;
    const local = db.meta[scope] || 0;
    if (remote > local || !db.days[date]) {
      db.days[date] = {
        dayType: g.di ? g.di.day_type : "normal",
        actualWake: g.di ? hm(g.di.actual_wake) : null,
        foods: g.foods.map(r => ({
          id: r.id, food: r.food_name, qty: +r.qty, unit: r.unit, ml: r.ml || 0,
          kcal: +r.kcal, protein: +r.protein_g, fiber: +r.fiber_g, time: hm(r.time_of_day) || "",
          mealType: r.meal_type || undefined, cheat: r.is_cheat || undefined,
        })),
        exercises: g.exercises.map(r => ({ id: r.id, cat: r.muscle_group, name: r.exercise, sets: r.sets, reps: r.reps, time: hm(r.time_of_day) || "" })),
        routine: g.routine.sort((a, b) => String(a.planned_time).localeCompare(String(b.planned_time)))
          .map(r => ({ id: r.id, time: hm(r.planned_time) || "09:00", text: r.title, anchored: r.anchored, done: r.completed })),
      };
      db.meta[scope] = remote;
      changed = true;
    } else if (local > remote) sync.dirty.add(scope);
  }
  Object.keys(db.days).forEach(d => { if (!byDate[d]) sync.dirty.add(`day:${d}`); });

  // ----- work -----
  const workRemote = workMeta.length ? Date.parse(workMeta[0].updated_at) : 0;
  const workLocal = db.meta.work || 0;
  if (workRemote > workLocal) {
    db.work.meetings = meetings.map(m => ({
      id: m.id, title: m.title, date: m.start_date, time: hm(m.time_of_day) || "",
      repeat: m.repeat, days: m.custom_days || [], notes: m.notes || "", durationMin: m.duration_min,
    }));
    db.work.milestones = milestones.map(ms => ({
      id: ms.id, title: ms.title, target: ms.target_date, status: ms.status,
      steps: steps.filter(s => s.milestone_id === ms.id).map(s => ({ id: s.id, date: s.step_date, text: s.note })),
    }));
    db.meta.work = workRemote; changed = true;
  } else if (workLocal > workRemote) sync.dirty.add("work");

  // ----- body -----
  const bodyRemote = bodies.reduce((mx, b) => Math.max(mx, Date.parse(b.updated_at || 0)), 0);
  const bodyLocal = db.meta.body || 0;
  if (bodyRemote > bodyLocal || (bodies.length && !db.body.length)) {
    db.body = bodies.map(b => ({ date: b.date, weight: b.weight_kg != null ? +b.weight_kg : null, bodyFat: b.body_fat_pct != null ? +b.body_fat_pct : null }));
    db.meta.body = bodyRemote || Date.now(); changed = true;
  } else if (bodyLocal > bodyRemote) sync.dirty.add("body");

  // ----- settings -----
  const sRow = settingsRows.find(r => r.key === "main");
  const sRemote = sRow ? Date.parse(sRow.updated_at) : 0;
  const sLocal = db.meta.settings || 0;
  if (sRow && sRemote > sLocal && sRow.data && sRow.data.physio) {
    const d = defaultDb();
    db.settings = Object.assign(d.settings, sRow.data);
    db.meta.settings = sRemote; changed = true;
  } else if (sLocal > sRemote) sync.dirty.add("settings");

  sync.lastSync = new Date();
  if (changed) { persistLocal(); render(); }
}

async function pushDay(date) {
  const day = db.days[date];
  if (!day) return;
  const now = new Date().toISOString();
  const del = async (table) => {
    const { error } = await sync.client.from(table).delete().eq("date", date);
    if (error) throw new Error(`${table}: ${error.message}`);
  };
  const ins = async (table, rows) => {
    if (!rows.length) return;
    // upsert (not insert) so overlapping pushes / retries can't hit duplicate-key errors
    const { error } = await sync.client.from(table).upsert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  };
  await del("consumption_log");
  await ins("consumption_log", day.foods.map(f => ({
    id: f.id, date, time_of_day: f.time || null, food_name: f.food, qty: f.qty || 1, unit: f.unit || null,
    ml: f.ml || 0, kcal: f.kcal || 0, protein_g: f.protein || 0, fiber_g: f.fiber || 0,
    meal_type: f.mealType || null, is_cheat: !!f.cheat,
  })));
  await del("exercise_log");
  await ins("exercise_log", day.exercises.map(e => ({
    id: e.id, date, time_of_day: e.time || null, exercise: e.name, muscle_group: e.cat, sets: e.sets, reps: e.reps,
  })));
  await del("schedule_log");
  const tl = buildTimeline(date);
  const schedRows = day.routine.map(r => {
    const shifted = tl.items.find(t => t.kind === "routine" && t.item.id === r.id);
    return {
      id: r.id, date, kind: "routine", title: r.text, planned_time: r.time,
      shifted_time: shifted && shifted.shifted ? shifted.time : null,
      anchored: !!r.anchored, completed: !!r.done, skipped: !!(shifted && shifted.skipped),
    };
  });
  await ins("schedule_log", schedRows);
  await del("commute_log");
  if (isOfficeDay(date)) {
    await ins("commute_log", [
      { id: `${date}-to`, date, direction: "to_office", minutes: db.settings.office.commuteMin },
      { id: `${date}-back`, date, direction: "to_home", minutes: db.settings.office.commuteMin },
    ]);
  }
  const { error } = await sync.client.from("day_info").upsert({
    date, day_type: day.dayType || "normal", location: isOfficeDay(date) ? "office" : "home",
    actual_wake: day.actualWake || null, timezone: db.settings.currentTz, updated_at: now,
  });
  if (error) throw new Error(`day_info: ${error.message}`);
  db.meta[`day:${date}`] = Date.parse(now);
}

async function pushWork() {
  const now = new Date().toISOString();
  const wipe = async t => { const { error } = await sync.client.from(t).delete().neq("id", ""); if (error) throw new Error(`${t}: ${error.message}`); };
  await wipe("milestone_steps"); await wipe("milestones"); await wipe("meetings");
  if (db.work.meetings.length) {
    const { error } = await sync.client.from("meetings").upsert(db.work.meetings.map(m => ({
      id: m.id, title: m.title, start_date: m.date, time_of_day: m.time || null,
      duration_min: m.durationMin || db.settings.meetingDurationMin, repeat: m.repeat || "none",
      custom_days: m.days || [], notes: m.notes || "", timezone: db.settings.homeTz,
    })));
    if (error) throw new Error("meetings: " + error.message);
  }
  if (db.work.milestones.length) {
    const { error } = await sync.client.from("milestones").upsert(db.work.milestones.map(ms => ({
      id: ms.id, title: ms.title, target_date: ms.target || null, status: ms.status,
    })));
    if (error) throw new Error("milestones: " + error.message);
    const stepRows = db.work.milestones.flatMap(ms => ms.steps.map(s => ({ id: s.id, milestone_id: ms.id, step_date: s.date, note: s.text })));
    if (stepRows.length) {
      const { error: e2 } = await sync.client.from("milestone_steps").upsert(stepRows);
      if (e2) throw new Error("milestone_steps: " + e2.message);
    }
  }
  const { error } = await sync.client.from("work_meta").upsert({ key: "work", updated_at: now });
  if (error) throw new Error("work_meta: " + error.message);
  db.meta.work = Date.parse(now);
}

async function pushBody() {
  const now = new Date().toISOString();
  // one entry per date (last wins) — duplicate dates in one upsert are a Postgres error
  const byDate = new Map();
  db.body.forEach(b => byDate.set(b.date, b));
  db.body = [...byDate.values()];
  const { error: e1 } = await sync.client.from("body_log").delete().gte("date", "1900-01-01");
  if (e1) throw new Error("body_log: " + e1.message);
  if (db.body.length) {
    const { error } = await sync.client.from("body_log").upsert(db.body.map(b => ({
      date: b.date, weight_kg: b.weight, body_fat_pct: b.bodyFat, updated_at: now,
    })));
    if (error) throw new Error("body_log: " + error.message);
  }
  db.meta.body = Date.parse(now);
}

async function pushSettings() {
  const now = new Date().toISOString();
  const { error } = await sync.client.from("app_settings").upsert({ key: "main", data: db.settings, updated_at: now });
  if (error) throw new Error("app_settings: " + error.message);
  db.meta.settings = Date.parse(now);
}

function queuePush(scope) {
  sync.dirty.add(scope);
  if (sync.status !== "ok") return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(flushPush, 1200);
}

let flushing = false;
async function flushPush() {
  if (!sync.client || sync.status !== "ok" || !sync.dirty.size) return;
  if (flushing) return;   // never run two pushes concurrently (delete+insert must not interleave)
  flushing = true;
  try {
    const scopes = [...sync.dirty];
    for (const s of scopes) {
      if (s.startsWith("day:")) await pushDay(s.slice(4));
      else if (s === "work") await pushWork();
      else if (s === "body") await pushBody();
      else if (s === "settings") await pushSettings();
      sync.dirty.delete(s);
    }
    persistLocal();
    sync.lastSync = new Date();
  } catch (e) {
    sync.status = "error"; sync.message = e.message || String(e);
  } finally {
    flushing = false;
  }
  updateSyncBadge();
  // anything queued while we were pushing goes out next
  if (sync.status === "ok" && sync.dirty.size) { clearTimeout(sync.timer); sync.timer = setTimeout(flushPush, 400); }
}

function updateSyncBadge() {
  const b = document.getElementById("syncBadge");
  if (!b) return;
  b.classList.remove("ok", "err");
  if (sync.status === "ok") {
    b.classList.add("ok");
    b.textContent = `☁️ Synced${sync.lastSync ? " · " + sync.lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}`;
  } else if (sync.status === "error") { b.classList.add("err"); b.textContent = "⚠️ Sync error — open Settings"; }
  else if (sync.status === "connecting") b.textContent = "⏳ Connecting…";
  else b.textContent = "💾 Local only — tap to set up cloud sync";
}

/* ================= Reminders ================= */
let reminderTimer = null;
let lastReminderAt = 0;
function startReminderLoop() { clearInterval(reminderTimer); reminderTimer = setInterval(checkWaterReminder, 60000); }
function checkWaterReminder() {
  const r = db.settings.reminders;
  if (!r || !r.water) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const t = nowTime();
  if (t < r.start || t > r.end) return;
  const today = peekDay(todayStr());
  const total = waterTotal(today);
  if (total >= db.settings.waterGoal) return;
  const drinks = today ? today.foods.filter(f => f.ml > 0) : [];
  const last = drinks.length ? drinks[drinks.length - 1].time : null;
  const now = new Date();
  const since = last ? (now.getHours() * 60 + now.getMinutes()) - toMin(last) : Infinity;
  if (since < r.interval) return;
  if (Date.now() - lastReminderAt < r.interval * 60000) return;
  lastReminderAt = Date.now();
  try {
    new Notification("💧 Momentum — water time!", {
      body: last ? `Nothing logged since ${fmtTime12(last)}. ${db.settings.waterGoal - total} ml to go today.` :
        `No drinks logged yet today. ${db.settings.waterGoal - total} ml to go — start sipping!`,
      tag: "momentum-water",
    });
  } catch (e) { /* iOS Safari tab context */ }
}

/* ================= SVG helpers ================= */
function ringSvg(pct, color, size = 104, stroke = 10) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, pct) / 100);
  return `<svg width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .5s"/>
  </svg>`;
}
function trendSvg(points, { color = "var(--accent)", goal = null, unit = "", height = 190 } = {}) {
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

/* shared quick-add grid for the unified food log */
function foodGridHtml(filter) {
  const foods = FOOD_CATALOG.filter(f => f.name !== "Water" && (!filter || filter(f)));
  return `<div class="food-preset-grid">
    ${foods.map(f => `
      <button class="food-preset" data-act="pick-food" data-name="${esc(f.name)}">
        <div class="fp-name">${esc(f.name)}</div>
        <div class="fp-protein">${f.kcal} kcal · ${f.protein}p · ${f.fiber}f / ${esc(f.unit)}</div>
      </button>`).join("")}
  </div>
  <div class="row">
    <input type="text" id="pfName" class="grow" placeholder="Food name">
    <input type="number" id="pfQty" min="0.25" step="0.25" value="1" style="width:84px" title="Quantity">
    <span style="color:var(--muted)" id="pfUnit">× unit</span>
    <input type="number" id="pfKcal" min="0" placeholder="kcal" style="width:90px" title="Calories per unit">
    <input type="number" id="pfProt" min="0" step="0.1" placeholder="protein g" style="width:100px" title="Protein g per unit">
    <input type="number" id="pfFib" min="0" step="0.1" placeholder="fiber g" style="width:92px" title="Fiber g per unit">
  </div>
  <div class="row" style="margin-top:8px">
    <select id="pfMeal" style="width:150px">
      <option value="">No meal tag</option>
      <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
      <option value="snack">Snack</option><option value="dinner">Dinner</option>
    </select>
    <label class="cheat-check"><input type="checkbox" id="pfCheat"><span>🍕 Cheat</span></label>
    <button class="btn" data-act="add-food">Add to log</button>
  </div>
  <div style="color:var(--muted);font-size:.76rem;margin-top:8px">One entry updates calories, protein, fiber (and water for drinks) everywhere at once.</div>`;
}

function foodLogListHtml(day, filter, valueFn, color) {
  const rows = day.foods.filter(filter);
  if (!rows.length) return `<div class="empty">Nothing logged yet.</div>`;
  return [...rows].reverse().map(f => `
    <div class="protein-log-item">
      <span class="p-food">${esc(f.food)} ${f.cheat ? `<span class="tag" style="background:rgba(255,107,122,.15);color:var(--red)">🍕</span>` : ""}${f.mealType ? `<span class="tag meal-tag meal-${f.mealType}" style="margin-left:6px">${f.mealType}</span>` : ""}
        <div class="p-qty">${f.qty} × ${esc(f.unit || "unit")} · ${esc(f.time || "")}</div></span>
      <span class="p-grams" style="color:${color}">${valueFn(f)}</span>
      <button class="del-btn" data-act="del-food" data-id="${f.id}">✕</button>
    </div>`).join("");
}

/* ================= Render root ================= */
function render() {
  const h = new Date().getHours();
  const greet = h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const sub = h < 5 ? "Up late? Log the day, then get some sleep." : h < 12 ? "Let's make this morning count." : h < 17 ? "Let's make this afternoon count." : "Let's finish the day strong.";
  document.getElementById("greeting").innerHTML = `${greet}, ${esc(db.settings.userName)} <small>${sub}${db.settings.currentTz !== db.settings.homeTz ? ` · 🧭 in ${esc(tzShort(db.settings.currentTz))}` : ""}</small>`;
  document.getElementById("dateLabel").textContent = currentDate === todayStr() ? `Today · ${fmtDate(currentDate)}` : fmtDate(currentDate);
  document.getElementById("datePicker").value = currentDate;
  document.querySelectorAll(".nav-item").forEach(t => t.classList.toggle("active", t.dataset.page === currentPage));
  const pages = {
    dashboard: renderDashboard, day: renderDay, work: renderWork, fitness: renderFitness,
    calories: renderCalories, water: renderWater, protein: renderProtein, fiber: renderFiber,
    food: renderFood, history: renderHistory, settings: renderSettings,
  };
  document.getElementById("pageContainer").innerHTML = (pages[currentPage] || pages.dashboard)();
  updateSyncBadge();
  bindPage();
}

/* ================= Page: Dashboard ================= */
function renderDashboard() {
  const day = getDay(currentDate);
  const eng = calorieEngine();
  const w = waterTotal(day), p = proteinTotal(day), fb = fiberTotal(day), kc = kcalTotal(day);
  const wG = db.settings.waterGoal, pG = db.settings.proteinGoal, fbG = db.settings.fiberGoal;
  const pctOf = (v, g) => Math.min(100, Math.round(v / g * 100));
  const rPct = routineProgress(day);
  const meets = meetingsForDate(currentDate);
  const streak = waterStreak();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = shiftDate(currentDate, -i);
    const dd = peekDay(d);
    last7.push({ d, w: pctOf(waterTotal(dd), wG), p: pctOf(proteinTotal(dd), pG) });
  }
  const body = [...db.body].sort((a, b) => a.date.localeCompare(b.date));
  const lastBody = body[body.length - 1];
  return `
  <div class="grid2">
    <div class="card hero-card">
      <h2>🔥 Calorie budget <span class="h-sub">target ${eng.target} · TDEE ${eng.tdee}</span></h2>
      ${kc > 0 ? (() => {
        // Guidance framing: never praise a "deficit" that's really under-eating.
        const left = eng.target - kc;
        const def = eng.tdee - kc;
        if (kc < 1000) return `
        <div class="protein-big" style="font-size:1.9rem;color:var(--cyan)">${left} kcal to go</div>
        <div style="color:var(--muted);font-size:.82rem;margin-top:4px">Keep fueling — the deficit is judged at day's end, not at ${kc} kcal in.</div>`;
        if (left >= 0) return `
        <div class="protein-big" style="font-size:1.9rem;color:var(--green)">${left} kcal left</div>
        <div style="color:var(--muted);font-size:.82rem;margin-top:4px">${def >= eng.deficit ? `🎯 On plan for the −${eng.deficit} deficit` : `On track — finish under ${eng.target} to hold the deficit`}</div>`;
        if (def > 0) return `
        <div class="protein-big" style="font-size:1.9rem;color:var(--amber)">${-left} kcal over target</div>
        <div style="color:var(--muted);font-size:.82rem;margin-top:4px">Still ${def} kcal under maintenance — a lighter dinner keeps the plan alive.</div>`;
        return `
        <div class="protein-big" style="font-size:1.9rem;color:var(--red)">+${-def} kcal over maintenance</div>
        <div style="color:var(--muted);font-size:.82rem;margin-top:4px">Over maintenance — tomorrow is a new day.</div>`;
      })() : `<div class="empty">Log food to see your calorie budget.</div>`}
      <h2 style="margin-top:16px">📊 Last 7 days <span class="h-sub">💧 water · 🟩 protein</span></h2>
      <div class="mini-bars">
        ${last7.map(d => `
          <div class="mini-bar-col">
            <div class="mini-bar-pair">
              <div class="mini-bar" style="height:${Math.max(3, d.w)}%;background:var(--cyan)"></div>
              <div class="mini-bar" style="height:${Math.max(3, d.p)}%;background:var(--green)"></div>
            </div>
            <div class="mini-bar-label">${fmtShort(d.d)}</div>
          </div>`).join("")}
      </div>
      ${lastBody ? `<div class="report-list" style="margin-top:12px">⚖️ <b>${lastBody.weight ?? "—"} kg</b> · <b>${lastBody.bodyFat ?? "—"}% fat</b> (${fmtShort(lastBody.date)}) <button class="btn small ghost" data-goto="food">Update</button></div>` : ""}
    </div>
    <div class="card">
      <h2>⚡ Quick log</h2>
      <div class="quick-row">
        <button class="chip-btn" data-act="quick-water" data-ml="250">💧 +250 ml</button>
        <button class="chip-btn" data-act="quick-water" data-ml="500">💧 +500 ml</button>
        <button class="chip-btn" data-act="quick-food" data-name="Buttermilk">🥛 Buttermilk</button>
        <button class="chip-btn" data-act="quick-food" data-name="Egg (whole)">🥚 +1 egg</button>
        <button class="chip-btn" data-goto="calories">🔥 Log food</button>
        <button class="chip-btn" data-goto="fitness">💪 Log workout</button>
      </div>
      <h2 style="margin-top:20px">🗓️ Meetings — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)}
        ${db.settings.currentTz !== db.settings.homeTz ? `<span class="h-sub">shown in ${esc(tzShort(db.settings.currentTz))}</span>` : ""}</h2>
      <div class="timeline-peek">
        ${meets.length ? meets.map(m => `
          <div class="tl-row"><span class="tl-time">${fmtTime12(m.localTime)}</span><span style="flex:1">${esc(m.title)}</span>
          ${m.repeat !== "none" ? `<span class="tag repeat-chip">${repeatLabel(m)}</span>` : ""}</div>`).join("")
        : `<div class="empty">No meetings on this day.</div>`}
        ${isOfficeDay(currentDate) ? `<div class="tl-row"><span class="tl-time">🚗</span><span style="flex:1;color:var(--muted)">Office day — ${db.settings.office.commuteMin} min drive each way</span></div>` : ""}
      </div>
    </div>
  </div>

  <div class="hero-grid">
    <div class="card ring-card" data-goto="calories">
      <div class="ring-wrap">${ringSvg(pctOf(kc, eng.target), kc > eng.target ? "var(--red)" : "var(--accent2)")}
        <div class="ring-center"><div class="ring-num" style="color:${kc > eng.target ? "var(--red)" : "var(--accent2)"}">${kc}</div><div class="ring-unit">of ${eng.target} kcal</div></div></div>
      <div class="ring-label">🔥 Calories</div>
    </div>
    <div class="card ring-card" data-goto="water">
      <div class="ring-wrap">${ringSvg(pctOf(w, wG), "var(--cyan)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--cyan)">${(w / 1000).toFixed(1)}L</div><div class="ring-unit">of ${(wG / 1000).toFixed(1)}L</div></div></div>
      <div class="ring-label">💧 Water</div>
    </div>
    <div class="card ring-card" data-goto="protein">
      <div class="ring-wrap">${ringSvg(pctOf(p, pG), "var(--green)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--green)">${p}g</div><div class="ring-unit">of ${pG}g</div></div></div>
      <div class="ring-label">🥚 Protein</div>
    </div>
    <div class="card ring-card" data-goto="fiber">
      <div class="ring-wrap">${ringSvg(pctOf(fb, fbG), "var(--amber)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--amber)">${fb}g</div><div class="ring-unit">of ${fbG}g</div></div></div>
      <div class="ring-label">🌾 Fiber</div>
    </div>
    <div class="card ring-card" data-goto="day">
      <div class="ring-wrap">${ringSvg(rPct, "var(--accent)")}
        <div class="ring-center"><div class="ring-num" style="color:var(--accent)">${rPct}%</div><div class="ring-unit">${day.routine.filter(r => r.done).length}/${day.routine.length}</div></div></div>
      <div class="ring-label">☀️ Routine</div>
    </div>
    <div class="card stat-card" data-goto="fitness">
      <div class="stat-num" style="color:var(--amber)">${day.exercises.length} <span class="streak-flame">💪</span></div>
      <div class="stat-label">exercises</div>
      <div class="stat-num" style="font-size:1.1rem;color:var(--cyan)">${streak} <span class="streak-flame">🔥</span></div>
      <div class="stat-label">water streak</div>
    </div>
  </div>`;
}

/* ================= Page: My Day ================= */
function renderDay() {
  const day = getDay(currentDate);
  const tl = buildTimeline(currentDate);
  const prog = routineProgress(day);
  const tmplWake = toHM(templateWakeMin(day));
  return `
  <div class="card">
    <h2>☀️ Day timeline
      <span class="h-sub">${prog}% routine done · ${tl.meets.length} meeting${tl.meets.length === 1 ? "" : "s"}${db.settings.currentTz !== db.settings.homeTz ? ` · times in ${esc(tzShort(db.settings.currentTz))}` : ""}</span></h2>
    <div class="quick-row" style="margin-bottom:10px">
      ${Object.entries(DAY_TYPES).map(([k, v]) => `
        <button class="chip-btn daytype ${(day.dayType || "normal") === k ? "active" : ""}" data-act="set-day-type" data-type="${k}">${v.emoji} ${v.label}</button>`).join("")}
    </div>
    <div class="row" style="margin-bottom:12px;background:var(--bg2);border-radius:11px;padding:10px 12px">
      <span style="font-size:.86rem">⏰ Actually woke up at</span>
      <input type="time" id="actualWake" value="${day.actualWake || tmplWake}" style="width:110px">
      <button class="btn small" data-act="apply-wake">Apply</button>
      ${day.actualWake ? `<button class="btn small ghost" data-act="reset-wake">Reset to plan</button>
        <span style="color:var(--amber);font-size:.78rem">routine shifted ${tl.delta > 0 ? "+" : ""}${Math.round(tl.delta / 6) / 10}h — anchored items stay put</span>` : ""}
    </div>
    ${day.dayType === "rest" ? `<div class="daytype-note">😴 Rest day — no workout expected, no office blocks.</div>` : ""}
    ${day.dayType === "holiday" ? `<div class="daytype-note">🎉 Holiday — enjoy! Hydration & food still count.</div>` : ""}
    <div class="progress-bar" style="margin-bottom:12px"><div style="width:${prog}%"></div></div>
    ${tl.items.length ? tl.items.map(t => {
      if (t.kind === "routine") {
        const r = t.item;
        return `
        <div class="tl-item ${r.done ? "done" : ""} ${t.skipped ? "skipped" : ""}">
          <button class="check ${r.done ? "on" : ""}" data-act="toggle-routine" data-id="${r.id}">✓</button>
          <span class="r-time">${t.skipped ? "—" : esc(t.time)}</span>
          <span class="r-text">${esc(r.text)}
            ${t.note ? `<span class="shift-note">${esc(t.note)}</span>` : ""}
            ${r.anchored ? `<span class="tag anchor-chip">anchored</span>` : ""}</span>
          <button class="del-btn" data-act="del-routine" data-id="${r.id}">✕</button>
        </div>`;
      }
      if (t.kind === "meeting") {
        return `
        <div class="tl-item meeting-row">
          <span style="width:25px;text-align:center">🗓️</span>
          <span class="r-time">${fmtTime12(t.time)}</span>
          <span class="r-text">${esc(t.item.title)}${db.settings.currentTz !== db.settings.homeTz ? `<span class="shift-note">${fmtTime12(t.item.time)} ${esc(tzShort(db.settings.homeTz))}</span>` : ""}</span>
          <span class="tag meet-chip">Meeting</span>
          ${t.item.repeat !== "none" ? `<span class="tag repeat-chip">${repeatLabel(t.item)}</span>` : ""}
        </div>`;
      }
      if (t.kind === "commute") {
        return `
        <div class="tl-item commute-row">
          <span style="width:25px;text-align:center">🚗</span>
          <span class="r-time">${fmtTime12(t.time)}</span>
          <span class="r-text">${esc(t.item.title)} <span class="shift-note">${t.item.minutes} min</span></span>
          <span class="tag anchor-chip">anchored</span>
        </div>`;
      }
      return `
      <div class="tl-item office-row">
        <span style="width:25px;text-align:center">💼</span>
        <span class="r-time">${fmtTime12(t.time)}</span>
        <span class="r-text">${esc(t.item.title)}</span>
        <span class="tag anchor-chip">anchored</span>
      </div>`;
    }).join("") : `<div class="empty">Nothing planned for this day.</div>`}
  </div>
  <div class="grid2">
    <div class="card">
      <h2>➕ Add routine item</h2>
      <div class="row">
        <input type="time" id="rtTime" value="09:00" style="width:112px">
        <input type="text" id="rtText" class="grow" placeholder="e.g. Team standup, gym, reading…">
        <label class="cheat-check" title="Anchored items never shift (external clock)"><input type="checkbox" id="rtAnchored"><span>⚓ anchored</span></label>
        <button class="btn" data-act="add-routine">Add</button>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost small" data-act="save-template">💾 Save as my default routine</button>
        <button class="btn ghost small" data-act="reset-routine">↺ Reset to default</button>
      </div>
    </div>
    <div class="card">
      <h2>🗓️ Add meeting on this day <span class="h-sub">time in ${esc(tzShort(db.settings.homeTz))} (home)</span></h2>
      <div class="row" style="margin-bottom:8px">
        <input type="time" id="dmTime" style="width:112px" value="10:30">
        <input type="text" id="dmTitle" class="grow" placeholder="Meeting title…">
      </div>
      <div class="row">
        ${repeatOptionsHtml("dmRepeat")}
        <button class="btn" data-act="add-day-meeting">Add meeting</button>
      </div>
      ${dayPickerHtml("dmDays")}
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
      <input type="date" id="msTarget" class="inline" style="width:160px" value="${currentDate}">
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
    <h2>🗓️ Meetings <span class="h-sub">times anchored to ${esc(tzShort(db.settings.homeTz))} — they convert automatically when you travel</span></h2>
    <div class="row" style="margin-bottom:8px">
      <input type="date" id="mtDate" class="inline" style="width:150px" value="${currentDate}">
      <input type="time" id="mtTime" style="width:106px" value="10:00">
      <input type="number" id="mtDur" style="width:88px" value="${db.settings.meetingDurationMin}" min="5" step="5" title="Duration (minutes)">
      <span style="color:var(--muted);font-size:.8rem">min</span>
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
          <div class="m-time">${fmtTime12(mt.time)} <span style="font-size:.68rem;color:var(--muted)">${esc(tzShort(db.settings.homeTz))} · ${mt.durationMin || db.settings.meetingDurationMin}m</span></div>
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
      <input type="number" id="exSets" min="1" value="3" style="width:84px">
      <span style="color:var(--muted)">sets ×</span>
      <input type="number" id="exReps" min="1" value="15" style="width:84px">
      <span style="color:var(--muted)">reps</span>
      <button class="btn" data-act="add-exercise">Log it</button>
    </div>
    <div style="color:var(--muted);font-size:.78rem;margin-top:10px">💡 Belly-fat truth: abs exercises build the muscle, but the calorie deficit (see 🔥 Calories) is what removes the fat covering it. Do both.</div>
  </div>
  <div class="card">
    <h2>📋 Workout — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)} <span class="h-sub">${logs.length} exercise${logs.length === 1 ? "" : "s"}</span></h2>
    ${logs.length ? logs.map(l => `
      <div class="ex-log-item">
        <span style="font-size:1.1rem">${CAT_META[l.cat] ? CAT_META[l.cat].emoji : "💪"}</span>
        <span class="e-name">${esc(l.name)}<div class="e-cat">${CAT_META[l.cat] ? CAT_META[l.cat].label : ""} · ${esc(l.time)}</div></span>
        <span class="e-detail">${l.sets} × ${l.reps}</span>
        <button class="del-btn" data-act="del-exercise" data-id="${l.id}">✕</button>
      </div>`).join("") : `<div class="empty">Nothing logged yet — pick a category and exercise above.</div>`}
  </div>`;
}

/* ================= Page: Calories ================= */
function renderCalories() {
  const day = getDay(currentDate);
  const eng = calorieEngine();
  const kc = kcalTotal(day);
  const pct = Math.min(100, Math.round(kc / eng.target * 100));
  const over = kc > eng.target;
  const deficitNow = eng.tdee - kc;
  // 7-day average deficit -> projected weekly fat loss
  let defSum = 0, defDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = peekDay(shiftDate(todayStr(), -i));
    if (d && kcalTotal(d) > 0) { defSum += eng.tdee - kcalTotal(d); defDays++; }
  }
  const avgDef = defDays ? Math.round(defSum / defDays) : 0;
  const weeklyKg = defDays ? round1(avgDef * 7 / 7700) : 0;
  const byMeal = {};
  day.foods.filter(f => f.mealType).forEach(f => { byMeal[f.mealType] = (byMeal[f.mealType] || 0) + (f.kcal || 0); });
  return `
  <div class="card protein-total-card">
    <div class="protein-big" style="color:${over ? "var(--red)" : "var(--accent2)"}">${kc} <span>/ ${eng.target} kcal target</span></div>
    <div class="progress-bar" style="margin:14px auto 6px;max-width:460px"><div style="width:${pct}%;background:${over ? "var(--red)" : "linear-gradient(90deg,var(--accent),var(--accent2))"}"></div></div>
    <div style="color:var(--muted);font-size:.85rem">
      ${over ? `${kc - eng.target} kcal over target` : `${eng.target - kc} kcal left today`}
      ${kc >= 1000 ? ` · running deficit vs TDEE: <b style="color:${deficitNow >= 0 ? "var(--green)" : "var(--red)"}">${deficitNow >= 0 ? "−" : "+"}${Math.abs(deficitNow)}</b>` : ""}
    </div>
    <div class="report-grid" style="margin-top:16px;text-align:left">
      <div class="report-stat"><div class="rs-num">${eng.bmr}</div><div class="rs-label">BMR (kcal)</div></div>
      <div class="report-stat"><div class="rs-num">${eng.tdee}</div><div class="rs-label">maintenance (TDEE)</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--accent2)">${eng.target}</div><div class="rs-label">daily target (−${eng.deficit})</div></div>
      <div class="report-stat"><div class="rs-num" style="color:${defDays >= 3 && weeklyKg > 0 ? "var(--green)" : "var(--muted)"}">${defDays >= 3 ? (weeklyKg > 0 ? "−" : "+") + Math.abs(weeklyKg) + " kg" : "—"}</div><div class="rs-label">${defDays >= 3 ? "projected / week (7-day avg)" : `projection unlocks after 3 logged days (${defDays}/3)`}</div></div>
    </div>
    <div style="color:var(--muted);font-size:.74rem;margin-top:8px">Mifflin-St Jeor for ${db.settings.physio.weightKg}kg · ${db.settings.physio.heightCm}cm · ${db.settings.physio.age}y · edit in Settings</div>
  </div>
  <div class="card">
    <h2>🍽️ Log food <span class="h-sub">updates calories + protein + fiber together</span></h2>
    ${foodGridHtml()}
  </div>
  <div class="card">
    <h2>📋 Your deficit meal plan <span class="h-sub">~${eng.target} kcal · ${db.settings.proteinGoal}g protein · non-veg</span></h2>
    ${MEAL_PLAN.map(m => `
      <div class="plan-row">
        <span class="plan-meal">${esc(m.meal)}</span>
        <span class="plan-items">${esc(m.items)}</span>
        <span class="plan-target">${esc(m.target)}</span>
      </div>`).join("")}
    <div style="color:var(--muted);font-size:.76rem;margin-top:10px">Swap same-macro items freely (fish ↔ chicken, fruits ↔ fruits). Keep protein high at every meal — it protects muscle while the deficit burns the belly fat.</div>
  </div>
  <div class="card">
    <h2>📜 Today's food <span class="h-sub">${Object.entries(byMeal).map(([m, k]) => `${m} ${Math.round(k)}`).join(" · ") || "no meal tags yet"}</span></h2>
    ${foodLogListHtml(day, f => (f.kcal || 0) > 0 || f.mealType, f => `${Math.round(f.kcal || 0)} kcal`, "var(--accent2)")}
  </div>`;
}

/* ================= Page: Water ================= */
function renderWater() {
  const day = getDay(currentDate);
  const total = waterTotal(day);
  const goal = db.settings.waterGoal;
  const pct = Math.min(100, Math.round(total / goal * 100));
  const face = pct >= 100 ? "🦙🎉" : pct >= 60 ? "🦙😊" : pct >= 30 ? "🦙🙂" : "🦙🥺";
  const msg = pct >= 100 ? "Goal reached! Your llama is thrilled!" : pct >= 60 ? "Great going, keep sipping!" : pct >= 30 ? "Making progress — drink up!" : "Your llama is thirsty… drink some water!";
  return `
  <div class="card">
    <h2>💧 Hydration <span class="h-sub">Goal: ${(goal / 1000).toFixed(1)} L / day · streak ${waterStreak()}🔥</span></h2>
    <div class="water-layout">
      <div class="water-visual">
        <div class="llama-cup"><div class="llama-fill" style="height:${pct}%"></div><div class="llama-face">${face}</div></div>
        <div class="water-big">${(total / 1000).toFixed(2)} L <span>/ ${(goal / 1000).toFixed(1)} L (${pct}%)</span></div>
        <div class="water-msg">${msg}</div>
      </div>
      <div>
        <div class="quick-adds">
          ${[100, 150, 200, 250, 300, 500].map(ml => `<button class="quick-add" data-act="quick-water" data-ml="${ml}">+${ml} ml</button>`).join("")}
        </div>
        <div class="row" style="margin-bottom:10px">
          <button class="quick-add" data-act="quick-food" data-name="Buttermilk">🥛 Buttermilk 250ml</button>
          <button class="quick-add" data-act="quick-food" data-name="Milk">🥛 Milk 250ml</button>
        </div>
        <div class="row" style="margin-bottom:14px">
          <input type="number" id="customMl" min="1" placeholder="Custom water (ml)" class="grow">
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
    <h2>📜 Drinks — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)}</h2>
    ${foodLogListHtml(day, f => (f.ml || 0) > 0, f => `+${f.ml} ml`, "var(--cyan)")}
  </div>`;
}

/* ================= Pages: Protein & Fiber (views over the same log) ================= */
function renderProtein() {
  const day = getDay(currentDate);
  const total = proteinTotal(day);
  const goal = db.settings.proteinGoal;
  const pct = Math.min(100, Math.round(total / goal * 100));
  return `
  <div class="card protein-total-card">
    <div class="protein-big" style="color:var(--green)">${total} g <span>/ ${goal} g protein</span></div>
    <div class="progress-bar" style="margin:14px auto 6px;max-width:420px"><div style="width:${pct}%;background:linear-gradient(90deg,var(--green),#1fa863)"></div></div>
    <div style="color:var(--muted);font-size:.85rem">${pct >= 100 ? "🎉 Protein goal hit!" : `${round1(goal - total)} g to go — cutting at 2g/kg protects your muscle`}</div>
    <div class="row" style="justify-content:center;margin-top:14px">
      <span style="color:var(--muted);font-size:.84rem">Daily goal (g):</span>
      <input type="number" id="proteinGoalInput" min="10" value="${goal}" style="width:100px">
      <button class="btn ghost small" data-act="set-protein-goal">Update goal</button>
    </div>
  </div>
  <div class="card">
    <h2>🍳 Quick add <span class="h-sub">high-protein picks — logs kcal & fiber too</span></h2>
    ${foodGridHtml(f => f.protein >= 3)}
  </div>
  <div class="card">
    <h2>📜 Protein today</h2>
    ${foodLogListHtml(day, f => (f.protein || 0) > 0, f => `${round1(f.protein)} g`, "var(--green)")}
  </div>`;
}

function renderFiber() {
  const day = getDay(currentDate);
  const total = fiberTotal(day);
  const goal = db.settings.fiberGoal;
  const pct = Math.min(100, Math.round(total / goal * 100));
  return `
  <div class="card protein-total-card">
    <div class="protein-big" style="color:var(--amber)">${total} g <span>/ ${goal} g fiber</span></div>
    <div class="progress-bar" style="margin:14px auto 6px;max-width:420px"><div style="width:${pct}%;background:linear-gradient(90deg,var(--amber),#d99a2b)"></div></div>
    <div style="color:var(--muted);font-size:.85rem">${pct >= 100 ? "🎉 Fiber goal hit — your gut thanks you!" : `${round1(goal - total)} g to go — fiber kills deficit hunger`}</div>
    <div class="row" style="justify-content:center;margin-top:14px">
      <span style="color:var(--muted);font-size:.84rem">Daily goal (g):</span>
      <input type="number" id="fiberGoalInput" min="5" value="${goal}" style="width:100px">
      <button class="btn ghost small" data-act="set-fiber-goal">Update goal</button>
    </div>
  </div>
  <div class="card">
    <h2>🌾 Quick add <span class="h-sub">high-fiber picks — logs kcal & protein too</span></h2>
    ${foodGridHtml(f => f.fiber >= 1.5)}
  </div>
  <div class="card">
    <h2>📜 Fiber today</h2>
    ${foodLogListHtml(day, f => (f.fiber || 0) > 0, f => `${round1(f.fiber)} g`, "var(--amber)")}
  </div>`;
}

/* ================= Page: Nutrition (guide, cheat meter, body) ================= */
function renderFood() {
  const day = getDay(currentDate);
  const body = [...db.body].sort((a, b) => a.date.localeCompare(b.date));
  const bfSeries = body.filter(b => b.bodyFat != null).map(b => ({ label: fmtShort(b.date), value: b.bodyFat }));
  const wtSeries = body.filter(b => b.weight != null).map(b => ({ label: fmtShort(b.date), value: b.weight }));
  const n = cheatCountForMonth(currentDate.slice(0, 7));
  const z = cheatZone(n);
  const meals = day.foods.filter(f => f.mealType);
  return `
  <div class="card">
    <h2>🍕 Cheat meter — ${dateObj(currentDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
      <span class="h-sub">green ≤ 2 · yellow 3–4 · red 5+</span></h2>
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
    <div class="zone-labels"><span>0</span><span>2</span><span>4</span><span>6+</span></div>
  </div>
  <div class="card">
    <h2>🍽️ Meals — ${currentDate === todayStr() ? "today" : fmtShort(currentDate)} <span class="h-sub">log food in 🔥 Calories; tag it with a meal</span></h2>
    ${meals.length ? [...meals].reverse().map(f => `
      <div class="meal-log-item">
        <span class="tag meal-tag meal-${f.mealType}">${f.mealType}</span>
        <span style="flex:1">${esc(f.food)} ${f.cheat ? `<span class="tag" style="background:rgba(255,107,122,.15);color:var(--red)">🍕 cheat</span>` : ""}</span>
        <span style="color:var(--muted);font-size:.78rem">${Math.round(f.kcal || 0)} kcal · ${esc(f.time || "")}</span>
        <button class="del-btn" data-act="del-food" data-id="${f.id}">✕</button>
      </div>`).join("") : `<div class="empty">No meals tagged for this day — use "🔥 Log food" with a meal tag.</div>`}
  </div>
  <div class="card">
    <h2>🥗 Eat this, not that</h2>
    <div class="food-guide-grid">
      <div class="guide-col eat">
        <h3>✅ EAT</h3>
        ${db.settings.eatList.map((f, i) => `<div class="guide-item"><span>${esc(f)}</span><button class="del-btn" data-act="del-eat" data-idx="${i}">✕</button></div>`).join("")}
        <div class="row" style="margin-top:8px"><input type="text" id="eatNew" class="grow" placeholder="Add good food…"><button class="btn small ghost" data-act="add-eat">Add</button></div>
      </div>
      <div class="guide-col avoid">
        <h3>🚫 AVOID</h3>
        ${db.settings.avoidList.map((f, i) => `<div class="guide-item"><span>${esc(f)}</span><button class="del-btn" data-act="del-avoid" data-idx="${i}">✕</button></div>`).join("")}
        <div class="row" style="margin-top:8px"><input type="text" id="avoidNew" class="grow" placeholder="Add food to avoid…"><button class="btn small ghost" data-act="add-avoid">Add</button></div>
      </div>
    </div>
  </div>
  <div class="card">
    <h2>🧮 Body fat calculator <span class="h-sub">US Navy method</span></h2>
    <div class="gender-row">
      <button class="gender-btn ${bfGender === "male" ? "active" : ""}" data-act="bf-gender" data-g="male">👨 Male</button>
      <button class="gender-btn ${bfGender === "female" ? "active" : ""}" data-act="bf-gender" data-g="female">👩 Female</button>
    </div>
    <div class="row">
      <input type="number" id="bfHeight" step="0.5" min="100" placeholder="Height (cm)" style="width:135px" value="${db.settings.physio.heightCm}">
      <input type="number" id="bfNeck" step="0.5" min="20" placeholder="Neck (cm)" style="width:125px">
      <input type="number" id="bfWaist" step="0.5" min="40" placeholder="Waist (cm)" style="width:125px">
      <input type="number" id="bfHip" step="0.5" min="40" placeholder="Hip (cm)" style="width:125px;display:${bfGender === "female" ? "block" : "none"}">
      <button class="btn" data-act="bf-calc">Calculate</button>
    </div>
    <div class="bf-result" id="bfResult"></div>
  </div>
  <div class="card">
    <h2>📉 Body tracking <span class="h-sub">weight & body fat over time</span></h2>
    <div class="row" style="margin-bottom:10px">
      <input type="date" id="bodyDate" class="inline" style="width:150px" value="${currentDate}">
      <input type="number" id="bodyWeight" step="0.1" min="20" placeholder="Weight (kg)" style="width:125px">
      <input type="number" id="bodyPct" step="0.1" min="2" max="60" placeholder="Body fat %" style="width:125px">
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

let bfGender = "male";
function navyBodyFat(gender, heightCm, neckCm, waistCm, hipCm) {
  const log10 = Math.log10;
  const bf = gender === "male"
    ? 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450
    : 495 / (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.22100 * log10(heightCm)) - 450;
  return round1(bf);
}
function bfCategory(gender, bf) {
  const bands = gender === "male"
    ? [[6, "Essential fat", "essential"], [14, "Athlete", "athlete"], [18, "Fit", "fit"], [25, "Average", "average"], [Infinity, "High", "high"]]
    : [[14, "Essential fat", "essential"], [21, "Athlete", "athlete"], [25, "Fit", "fit"], [32, "Average", "average"], [Infinity, "High", "high"]];
  for (const [max, label, cls] of bands) if (bf < max) return { label, cls };
  return { label: "High", cls: "high" };
}
function showBfResult(bf, gender) {
  const el = document.getElementById("bfResult");
  if (!el) return;
  if (bf == null || !isFinite(bf) || bf <= 2 || bf >= 60) {
    el.className = "bf-result show";
    el.innerHTML = `<div style="color:var(--red);font-weight:600">Those measurements don't look right — waist must be larger than neck. Try again.</div>`;
    return;
  }
  const cat = bfCategory(gender, bf);
  el.className = "bf-result show";
  el.dataset.bf = bf;
  el.innerHTML = `
    <div class="bf-big bf-cat-${cat.cls}">${bf}% <span style="font-size:.95rem">body fat</span></div>
    <div style="margin:4px 0 12px;font-size:.88rem">Category: <b class="bf-cat-${cat.cls}">${cat.label}</b></div>
    <div class="row">
      <input type="number" id="bfSaveWeight" step="0.1" placeholder="Weight (kg) — optional" style="width:190px">
      <button class="btn small" data-act="bf-save">💾 Save to body log (${fmtShort(currentDate)})</button>
    </div>`;
}

/* ================= Page: History ================= */
function renderHistory() {
  const [yy, mm] = histMonth.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const startDow = (new Date(yy, mm - 1, 1).getDay() + 6) % 7;
  const monthName = new Date(yy, mm - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const today = todayStr();
  const eng = calorieEngine();
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
        ${(day.foods || []).some(f => f.cheat) ? `<div class="cal-dot" style="background:var(--red)"></div>` : ""}
      </div>` : "";
    const typeEmoji = day && day.dayType && day.dayType !== "normal" ? DAY_TYPES[day.dayType].emoji : (isOfficeDay(ds) && !future ? "🏢" : "");
    cells.push(`
      <button class="cal-cell ${ds === today ? "today" : ""} ${future ? "future" : ""}" ${future ? "" : `data-act="goto-day" data-date="${ds}"`}>
        <span>${d} ${typeEmoji}</span>${dots}
        <div class="cal-score-bar">${score != null && score > 0 ? `<div style="width:${score}%;background:linear-gradient(90deg,var(--accent),var(--green))"></div>` : ""}</div>
      </button>`);
  }
  const water30 = [], protein30 = [], kcal30 = [];
  for (let i = 29; i >= 0; i--) {
    const ds = shiftDate(today, -i);
    const day = peekDay(ds);
    water30.push({ label: fmtShort(ds), value: Math.round(waterTotal(day) / 100) / 10 });
    protein30.push({ label: fmtShort(ds), value: proteinTotal(day) });
    kcal30.push({ label: fmtShort(ds), value: kcalTotal(day) });
  }
  const day = peekDay(currentDate);
  const meets = meetingsForDate(currentDate);
  const trackedDays = Object.keys(db.days).filter(d => dayScore(d) > 0).length;
  const perfectDays = Object.keys(db.days).filter(d => dayScore(d) >= 90).length;
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
      <span><span class="cal-dot" style="background:var(--cyan)"></span>water</span>
      <span><span class="cal-dot" style="background:var(--green)"></span>protein</span>
      <span><span class="cal-dot" style="background:var(--amber)"></span>workout</span>
      <span><span class="cal-dot" style="background:var(--accent2)"></span>meetings</span>
      <span><span class="cal-dot" style="background:var(--red)"></span>cheat</span>
      <span style="margin-left:auto">🏢 office day · click a day to open it</span>
    </div>
  </div>
  <div class="card">
    <h2>🔎 Day report — ${fmtDate(currentDate)}</h2>
    <div class="report-grid">
      <div class="report-stat"><div class="rs-num" style="color:var(--accent2)">${kcalTotal(day)}</div><div class="rs-label">kcal in</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--cyan)">${(waterTotal(day) / 1000).toFixed(2)} L</div><div class="rs-label">water</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--green)">${proteinTotal(day)} g</div><div class="rs-label">protein</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--amber)">${fiberTotal(day)} g</div><div class="rs-label">fiber</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--amber)">${day ? day.exercises.length : 0}</div><div class="rs-label">exercises</div></div>
      <div class="report-stat"><div class="rs-num" style="color:var(--accent)">${routineProgress(day)}%</div><div class="rs-label">routine</div></div>
    </div>
    <div class="report-list">
      ${day && day.dayType && day.dayType !== "normal" ? `<div>${DAY_TYPES[day.dayType].emoji} <b>${DAY_TYPES[day.dayType].label}</b></div>` : ""}
      ${day && day.actualWake ? `<div>⏰ <b>Woke at:</b> ${fmtTime12(day.actualWake)}</div>` : ""}
      ${day && kcalTotal(day) > 0 ? `<div>🔥 <b>Deficit vs TDEE:</b> ${eng.tdee - kcalTotal(day) >= 0 ? "−" : "+"}${Math.abs(eng.tdee - kcalTotal(day))} kcal</div>` : ""}
      ${day && day.exercises.length ? `<div>💪 <b>Workout:</b> ${day.exercises.map(e => `${esc(e.name)} ${e.sets}×${e.reps}`).join(", ")}</div>` : ""}
      ${day && day.foods.filter(f => f.mealType).length ? `<div>🍽️ <b>Meals:</b> ${day.foods.filter(f => f.mealType).map(f => `${f.mealType}${f.cheat ? " 🍕" : ""} — ${esc(f.food)}`).join(" · ")}</div>` : ""}
      ${meets.length ? `<div>🗓️ <b>Meetings:</b> ${meets.map(m => `${fmtTime12(m.localTime)} ${esc(m.title)}`).join(" · ")}</div>` : ""}
      ${isOfficeDay(currentDate) ? `<div>🚗 <b>Office day:</b> ${db.settings.office.commuteMin} min drive each way</div>` : ""}
    </div>
  </div>
  <div class="grid2">
    <div class="card"><h2>🔥 Calories — last 30 days</h2>${trendSvg(kcal30, { color: "var(--accent2)", goal: eng.target, unit: "" })}</div>
    <div class="card"><h2>💧 Water — last 30 days (L)</h2>${trendSvg(water30, { color: "var(--cyan)", goal: db.settings.waterGoal / 1000, unit: "L" })}</div>
    <div class="card"><h2>🥚 Protein — last 30 days (g)</h2>${trendSvg(protein30, { color: "var(--green)", goal: db.settings.proteinGoal, unit: "g" })}</div>
    <div class="card"><h2>🍕 Cheat meals — this month</h2>
      ${(() => { const n2 = cheatCountForMonth(histMonth); const z2 = cheatZone(n2);
        return `<div class="protein-big" style="color:${z2.color};font-size:2rem;padding-top:20px">${n2} <span style="font-size:.9rem">in ${new Date(yy, mm - 1, 1).toLocaleDateString("en-IN", { month: "long" })}</span></div>
        <div style="margin-top:8px"><span class="tag" style="background:${z2.color}22;color:${z2.color}">${z2.label}</span></div>
        <div style="color:var(--muted);font-size:.84rem;margin-top:10px">${z2.msg}</div>`; })()}
    </div>
  </div>
  <div class="card">
    <h2>🏆 All-time</h2>
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
    : sync.status === "connecting" ? "Connecting…" : "Not connected — data is stored in this browser only.";
  const p = db.settings.physio;
  const eng = calorieEngine();
  const o = db.settings.office;
  const r = db.settings.reminders;
  const perm = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  return `
  <div class="card">
    <h2>👤 Profile & goals</h2>
    <div class="setting-row"><span class="s-label">Your name</span>
      <input type="text" id="setName" value="${esc(db.settings.userName)}" style="width:190px">
      <button class="btn ghost small" data-act="set-name">Save</button></div>
    <div class="setting-row"><span class="s-label">Water goal (ml)</span>
      <input type="number" id="waterGoalInput" min="500" step="100" value="${db.settings.waterGoal}" style="width:120px">
      <button class="btn ghost small" data-act="set-water-goal">Save</button></div>
    <div class="setting-row"><span class="s-label">Protein goal (g)</span>
      <input type="number" id="proteinGoalInput" min="10" value="${db.settings.proteinGoal}" style="width:120px">
      <button class="btn ghost small" data-act="set-protein-goal">Save</button></div>
    <div class="setting-row"><span class="s-label">Fiber goal (g)</span>
      <input type="number" id="fiberGoalInput" min="5" value="${db.settings.fiberGoal}" style="width:120px">
      <button class="btn ghost small" data-act="set-fiber-goal">Save</button></div>
  </div>
  <div class="card">
    <h2>🔥 Calorie engine <span class="h-sub">BMR ${eng.bmr} · TDEE ${eng.tdee} · target ${eng.target} kcal</span></h2>
    <div class="setting-row"><span class="s-label">Weight (kg)</span>
      <input type="number" id="phWeight" step="0.1" value="${p.weightKg}" style="width:100px">
      <span class="s-label" style="min-width:auto">Height (cm)</span>
      <input type="number" id="phHeight" step="0.5" value="${p.heightCm}" style="width:100px">
      <span class="s-label" style="min-width:auto">Age</span>
      <input type="number" id="phAge" value="${p.age}" style="width:80px"></div>
    <div class="setting-row"><span class="s-label">Activity level</span>
      <select id="phActivity" style="width:230px">
        <option value="1.2"  ${p.activity === 1.2 ? "selected" : ""}>Sedentary (×1.2)</option>
        <option value="1.375" ${p.activity === 1.375 ? "selected" : ""}>Lightly active (×1.375)</option>
        <option value="1.55" ${p.activity === 1.55 ? "selected" : ""}>Moderately active (×1.55)</option>
        <option value="1.725" ${p.activity === 1.725 ? "selected" : ""}>Very active (×1.725)</option>
      </select>
      <span class="s-label" style="min-width:auto">Deficit (kcal)</span>
      <select id="phDeficit" style="width:190px">
        <option value="300" ${p.deficit === 300 ? "selected" : ""}>Gentle −300</option>
        <option value="500" ${p.deficit === 500 ? "selected" : ""}>Standard −500</option>
        <option value="700" ${p.deficit === 700 ? "selected" : ""}>Aggressive −700</option>
      </select>
      <button class="btn small" data-act="save-physio">Save</button></div>
    <div class="setting-row"><span class="s-help">Tip: update your weight here weekly (or in Body tracking) — the calorie targets recalculate automatically.</span></div>
  </div>
  <div class="card">
    <h2>🧭 Timezone <span class="h-sub">meetings stay anchored to home; your routine follows your body clock</span></h2>
    <div class="setting-row"><span class="s-label">Home / company tz</span>
      <select id="tzHome" style="width:230px">${TZ_PICKS.map(t => `<option value="${t.tz}" ${db.settings.homeTz === t.tz ? "selected" : ""}>${t.label}</option>`).join("")}</select></div>
    <div class="setting-row"><span class="s-label">I'm currently in</span>
      <select id="tzCurrent" style="width:230px">${TZ_PICKS.map(t => `<option value="${t.tz}" ${db.settings.currentTz === t.tz ? "selected" : ""}>${t.label}</option>`).join("")}</select>
      <button class="btn small" data-act="save-tz">Save</button></div>
    ${db.settings.currentTz !== db.settings.homeTz ? `<div class="daytype-note">🧭 Travel mode: your ${fmtTime12(convertTime("08:30", db.settings.homeTz, db.settings.homeTz, currentDate))} ${tzShort(db.settings.homeTz)} meetings show as their ${tzShort(db.settings.currentTz)} local times.</div>` : ""}
  </div>
  <div class="card">
    <h2>💼 Office & commute</h2>
    <div class="setting-row"><span class="s-label">Office days</span>
      <div class="dow-row" id="officeDays" style="display:flex">
        ${[1, 2, 3, 4, 5].map(d => `<label class="dow-chip"><input type="checkbox" value="${d}" ${o.days.includes(d) ? "checked" : ""}><span>${DOW_SHORT[d]}</span></label>`).join("")}
      </div></div>
    <div class="setting-row"><span class="s-label">Office hours (${esc(tzShort(db.settings.homeTz))})</span>
      <input type="time" id="offStart" value="${o.start}" style="width:105px"> <span style="color:var(--muted)">to</span>
      <input type="time" id="offEnd" value="${o.end}" style="width:105px">
      <span class="s-label" style="min-width:auto">Drive (min)</span>
      <input type="number" id="offCommute" value="${o.commuteMin}" min="0" style="width:80px">
      <button class="btn small" data-act="save-office">Save</button></div>
    <div class="setting-row"><span class="s-label">Default meeting length</span>
      <input type="number" id="setMtDur" value="${db.settings.meetingDurationMin}" min="5" step="5" style="width:80px">
      <span style="color:var(--muted);font-size:.8rem">minutes (used for conflict detection)</span>
      <button class="btn ghost small" data-act="set-mt-dur">Save</button></div>
  </div>
  <div class="card">
    <h2>🔔 Water reminders</h2>
    <div class="sync-status-line"><span class="dot ${r.water && perm === "granted" ? "ok" : "off"}"></span>
      ${r.water && perm === "granted" ? "On" : perm === "denied" ? "Notifications blocked in browser settings" : perm === "unsupported" ? "Not supported in this browser" : "Off"}</div>
    <div class="setting-row"><span class="s-label">Remind me every</span>
      <select id="remInterval" data-act="rem-update" style="width:120px">
        ${[45, 60, 90, 120].map(v => `<option value="${v}" ${r.interval === v ? "selected" : ""}>${v} min</option>`).join("")}
      </select>
      <span style="color:var(--muted)">between</span>
      <input type="time" id="remStart" data-act="rem-update" value="${r.start}" style="width:105px">
      <span style="color:var(--muted)">and</span>
      <input type="time" id="remEnd" data-act="rem-update" value="${r.end}" style="width:105px"></div>
    <div class="row" style="margin-top:10px">
      <button class="btn ${r.water ? "danger" : ""}" data-act="rem-toggle">${r.water ? "🔕 Turn off" : "🔔 Turn on reminders"}</button>
      <button class="btn ghost" data-act="rem-test">Send test notification</button>
    </div>
  </div>
  <div class="card">
    <h2>☁️ Supabase cloud sync <span class="h-sub">v2 normalized schema</span></h2>
    <div class="sync-status-line"><span class="dot ${statusDot}"></span> ${esc(statusText)}</div>
    <div class="setting-row"><span class="s-label">Project URL</span>
      <input type="text" id="sbUrl" class="grow" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url)}"></div>
    <div class="setting-row"><span class="s-label">Anon (public) key</span>
      <input type="text" id="sbKey" class="grow" placeholder="eyJhbGciOi…" value="${esc(cfg.key)}"></div>
    <div class="row" style="margin:10px 0">
      <button class="btn" data-act="sb-connect">🔌 Connect & sync</button>
      ${sync.status === "ok" ? `
        <button class="btn ghost" data-act="sb-push">⬆️ Push all to cloud</button>
        <button class="btn ghost" data-act="sb-pull">⬇️ Pull from cloud</button>` : ""}
      ${sync.config ? `<button class="btn danger" data-act="sb-disconnect">Disconnect</button>` : ""}
    </div>
    ${sync.config ? `
    <div class="row" style="margin:4px 0 10px">
      <button class="btn ghost" data-act="copy-connect-link">📱 Copy phone connect link</button>
      <span style="color:var(--muted);font-size:.78rem;flex:1;min-width:200px">Open it once on your phone — connects automatically. Keep it private.</span>
    </div>` : ""}
    <div style="font-size:.82rem;color:var(--muted)">
      <b style="color:var(--text)">Schema v2 setup:</b> ${esc(SETUP_SQL_NOTE)} It creates the normalized tables + star-schema views and migrates your v1 data automatically.
    </div>
  </div>
  <div class="card">
    <h2>🗄️ Backup & data</h2>
    <div class="row">
      <button class="btn ghost" data-act="export-json">⬇️ Export backup (JSON)</button>
      <label class="btn ghost" style="display:inline-flex;align-items:center;cursor:pointer">⬆️ Import backup
        <input type="file" id="importFile" accept=".json" style="display:none"></label>
      <button class="btn danger" data-act="wipe-all">🗑️ Erase all local data</button>
    </div>
  </div>`;
}

/* ================= Actions ================= */
const ACTION_SCOPES = {
  "add-milestone": "work", "del-milestone": "work", "ms-status": "work", "add-step": "work", "del-step": "work",
  "add-meeting": "work", "del-meeting": "work", "add-day-meeting": "work",
  "set-water-goal": "settings", "set-protein-goal": "settings", "set-fiber-goal": "settings",
  "set-name": "settings", "save-template": "settings", "save-physio": "settings", "save-tz": "settings",
  "save-office": "settings", "set-mt-dur": "settings", "rem-toggle": "settings", "rem-update": "settings",
  "add-eat": "settings", "del-eat": "settings", "add-avoid": "settings", "del-avoid": "settings",
  "add-body": "body", "del-body": "body", "bf-save": "body",
};

function addFoodEntry(entry) {
  getDay(currentDate).foods.push(entry);
}

const actions = {
  /* routine & day */
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
    getDay(currentDate).routine.push({ id: uid(), time, text, anchored: document.getElementById("rtAnchored").checked, done: false });
    toast("Routine item added");
  },
  "save-template": () => {
    const day = getDay(currentDate);
    db.settings.routineTemplate = [...day.routine].sort((a, b) => a.time.localeCompare(b.time)).map(r => ({ time: r.time, text: r.text, anchored: !!r.anchored }));
    toast("💾 Saved — new days start with this routine");
  },
  "reset-routine": () => {
    if (!confirm("Replace this day's routine with your default template?")) return "no-render";
    getDay(currentDate).routine = db.settings.routineTemplate.map(r => ({ id: uid(), time: r.time, text: r.text, anchored: !!r.anchored, done: false }));
  },
  "set-day-type": el => {
    getDay(currentDate).dayType = el.dataset.type;
    toast(`${DAY_TYPES[el.dataset.type].emoji} Marked as ${DAY_TYPES[el.dataset.type].label.toLowerCase()}`);
  },
  "apply-wake": () => {
    const t = document.getElementById("actualWake").value;
    if (!t) { toast("Pick the time you actually woke up", "err"); return "no-render"; }
    getDay(currentDate).actualWake = t;
    toast(`⏰ Routine re-planned around a ${fmtTime12(t)} wake-up`);
  },
  "reset-wake": () => {
    getDay(currentDate).actualWake = null;
    toast("Back to the planned routine");
  },

  /* meetings */
  "add-day-meeting": () => {
    const title = document.getElementById("dmTitle").value.trim();
    if (!title) { toast("Give the meeting a title", "err"); return "no-render"; }
    const repeat = document.getElementById("dmRepeat").value;
    const days = repeat === "custom" ? pickedDays("dmDays") : [];
    if (repeat === "custom" && !days.length) { toast("Pick at least one weekday", "err"); return "no-render"; }
    db.work.meetings.push({
      id: uid(), date: currentDate, time: document.getElementById("dmTime").value || "09:00",
      title, notes: "", repeat, days, durationMin: db.settings.meetingDurationMin,
    });
    toast("🗓️ Meeting added");
  },
  "add-meeting": () => {
    const title = document.getElementById("mtTitle").value.trim();
    if (!title) { toast("Give the meeting a title", "err"); return "no-render"; }
    const repeat = document.getElementById("mtRepeat").value;
    const days = repeat === "custom" ? pickedDays("mtDays") : [];
    if (repeat === "custom" && !days.length) { toast("Pick at least one weekday (e.g. Wed + Fri)", "err"); return "no-render"; }
    db.work.meetings.push({
      id: uid(), date: document.getElementById("mtDate").value || todayStr(),
      time: document.getElementById("mtTime").value || "", title,
      notes: document.getElementById("mtNotes").value.trim(), repeat, days,
      durationMin: parseInt(document.getElementById("mtDur").value, 10) || db.settings.meetingDurationMin,
    });
    toast("🗓️ Meeting added");
  },
  "del-meeting": el => { db.work.meetings = db.work.meetings.filter(m => m.id !== el.dataset.id); },

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

  /* unified food log */
  "quick-water": el => {
    const ml = parseInt(el.dataset.ml, 10);
    addFoodEntry({ id: uid(), food: "Water", qty: ml / 100, unit: "100 ml", ml, kcal: 0, protein: 0, fiber: 0, time: nowTime() });
    toast(`💧 +${ml} ml`);
  },
  "add-water-custom": () => {
    const ml = parseInt(document.getElementById("customMl").value, 10);
    if (!(ml > 0)) { toast("Enter a valid amount in ml", "err"); return "no-render"; }
    addFoodEntry({ id: uid(), food: "Water", qty: ml / 100, unit: "100 ml", ml, kcal: 0, protein: 0, fiber: 0, time: nowTime() });
  },
  "quick-food": el => {
    const f = catalogByName(el.dataset.name);
    if (!f) return "no-render";
    addFoodEntry({ id: uid(), food: f.name, qty: 1, unit: f.unit, ml: f.ml || 0, kcal: f.kcal, protein: f.protein, fiber: f.fiber, time: nowTime() });
    toast(`${f.cat === "beverage" ? "🥛" : "🍽️"} ${f.name}: +${f.kcal} kcal · +${f.protein}g protein`);
  },
  "pick-food": el => {
    const f = catalogByName(el.dataset.name);
    if (!f) return "no-render";
    document.getElementById("pfName").value = f.name;
    document.getElementById("pfKcal").value = f.kcal;
    document.getElementById("pfProt").value = f.protein;
    document.getElementById("pfFib").value = f.fiber;
    document.getElementById("pfUnit").textContent = `× ${f.unit}`;
    document.getElementById("pfName").dataset.unit = f.unit;
    document.getElementById("pfName").dataset.ml = f.ml || 0;
    document.getElementById("pfQty").focus();
    return "no-render";
  },
  "add-food": () => {
    const nameEl = document.getElementById("pfName");
    const food = nameEl.value.trim();
    const qty = parseFloat(document.getElementById("pfQty").value);
    const kcal = parseFloat(document.getElementById("pfKcal").value) || 0;
    const prot = parseFloat(document.getElementById("pfProt").value) || 0;
    const fib = parseFloat(document.getElementById("pfFib").value) || 0;
    if (!food) { toast("Enter a food name (or tap a preset)", "err"); return "no-render"; }
    if (!(qty > 0)) { toast("Quantity must be positive", "err"); return "no-render"; }
    const mealType = document.getElementById("pfMeal").value || undefined;
    const cheat = document.getElementById("pfCheat").checked || undefined;
    const mlPer = parseFloat(nameEl.dataset.ml) || 0;
    addFoodEntry({
      id: uid(), food, qty, unit: nameEl.dataset.unit || "unit", ml: Math.round(mlPer * qty),
      kcal: Math.round(kcal * qty), protein: round1(prot * qty), fiber: round1(fib * qty),
      time: nowTime(), mealType, cheat,
    });
    if (cheat) {
      const n = cheatCountForMonth(currentDate.slice(0, 7));
      toast(`🍕 Cheat meal #${n} this month — ${cheatZone(n).label}`, n > 4 ? "err" : "ok");
    } else toast(`🍽️ +${Math.round(kcal * qty)} kcal · +${round1(prot * qty)}g protein · +${round1(fib * qty)}g fiber`);
  },
  "del-food": el => {
    const day = getDay(currentDate);
    day.foods = day.foods.filter(f => f.id !== el.dataset.id);
  },

  /* goals & settings */
  "set-water-goal": () => {
    const g = parseInt(document.getElementById("waterGoalInput").value, 10);
    if (!(g >= 500)) { toast("Goal must be at least 500 ml", "err"); return "no-render"; }
    db.settings.waterGoal = g; toast("Water goal updated");
  },
  "set-protein-goal": () => {
    const g = parseInt(document.getElementById("proteinGoalInput").value, 10);
    if (!(g >= 10)) { toast("Goal must be at least 10 g", "err"); return "no-render"; }
    db.settings.proteinGoal = g; toast("Protein goal updated");
  },
  "set-fiber-goal": () => {
    const g = parseInt(document.getElementById("fiberGoalInput").value, 10);
    if (!(g >= 5)) { toast("Goal must be at least 5 g", "err"); return "no-render"; }
    db.settings.fiberGoal = g; toast("Fiber goal updated");
  },
  "set-name": () => {
    const v = document.getElementById("setName").value.trim();
    if (!v) { toast("Enter a name", "err"); return "no-render"; }
    db.settings.userName = v; toast("Saved 👋");
  },
  "save-physio": () => {
    const p = db.settings.physio;
    p.weightKg = parseFloat(document.getElementById("phWeight").value) || p.weightKg;
    p.heightCm = parseFloat(document.getElementById("phHeight").value) || p.heightCm;
    p.age = parseInt(document.getElementById("phAge").value, 10) || p.age;
    p.activity = parseFloat(document.getElementById("phActivity").value) || p.activity;
    p.deficit = parseInt(document.getElementById("phDeficit").value, 10) || p.deficit;
    const eng = calorieEngine();
    toast(`🔥 Updated — TDEE ${eng.tdee}, target ${eng.target} kcal`);
  },
  "save-tz": () => {
    db.settings.homeTz = document.getElementById("tzHome").value;
    db.settings.currentTz = document.getElementById("tzCurrent").value;
    toast(db.settings.currentTz === db.settings.homeTz ? "🧭 Timezone saved" : `🧭 Travel mode: showing times in ${tzShort(db.settings.currentTz)}`);
  },
  "save-office": () => {
    const o = db.settings.office;
    o.days = pickedDays("officeDays");
    o.start = document.getElementById("offStart").value || o.start;
    o.end = document.getElementById("offEnd").value || o.end;
    o.commuteMin = parseInt(document.getElementById("offCommute").value, 10) ?? o.commuteMin;
    toast("💼 Office schedule saved");
  },
  "set-mt-dur": () => {
    const v = parseInt(document.getElementById("setMtDur").value, 10);
    if (!(v >= 5)) { toast("At least 5 minutes", "err"); return "no-render"; }
    db.settings.meetingDurationMin = v; toast("Default meeting length saved");
  },

  /* eat/avoid lists */
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

  /* body */
  "add-body": () => {
    const date = document.getElementById("bodyDate").value || todayStr();
    const weight = parseFloat(document.getElementById("bodyWeight").value);
    const bodyFat = parseFloat(document.getElementById("bodyPct").value);
    if (isNaN(weight) && isNaN(bodyFat)) { toast("Enter weight, body fat %, or both", "err"); return "no-render"; }
    db.body = db.body.filter(b => b.date !== date);
    db.body.push({ date, weight: isNaN(weight) ? null : weight, bodyFat: isNaN(bodyFat) ? null : bodyFat });
    if (!isNaN(weight)) { db.settings.physio.weightKg = weight; queuePush("settings"); db.meta.settings = Date.now(); }
    toast("⚖️ Body entry saved" + (!isNaN(weight) ? " — calorie targets recalculated" : ""));
  },
  "del-body": el => { db.body = db.body.filter(b => b.date !== el.dataset.date); },
  "bf-gender": el => { bfGender = el.dataset.g; },
  "bf-calc": () => {
    const h = parseFloat(document.getElementById("bfHeight").value);
    const n = parseFloat(document.getElementById("bfNeck").value);
    const w = parseFloat(document.getElementById("bfWaist").value);
    const hip = parseFloat(document.getElementById("bfHip").value);
    if (isNaN(h) || isNaN(n) || isNaN(w) || (bfGender === "female" && isNaN(hip))) { toast("Fill in all measurements (cm)", "err"); return "no-render"; }
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
    toast(`💾 ${bf}% body fat saved`);
  },

  /* history */
  "goto-day": el => { currentDate = el.dataset.date; currentPage = "day"; },
  "hist-month": el => {
    const [y, m] = histMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + parseInt(el.dataset.delta, 10), 1);
    histMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return "render-only";
  },

  /* reminders */
  "rem-toggle": () => {
    const r = db.settings.reminders;
    if (r.water) { r.water = false; toast("🔕 Water reminders off"); return; }
    r.interval = parseInt(document.getElementById("remInterval").value, 10) || 90;
    r.start = document.getElementById("remStart").value || "08:00";
    r.end = document.getElementById("remEnd").value || "22:00";
    if (typeof Notification === "undefined") { toast("This browser doesn't support notifications", "err"); return "no-render"; }
    Notification.requestPermission().then(perm => {
      if (perm === "granted") { db.settings.reminders.water = true; save("settings"); toast("🔔 Reminders on"); }
      else toast("Permission not granted — reminders stay off", "err");
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

  /* sync */
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
  "copy-connect-link": () => {
    if (!sync.config) { toast("Connect Supabase here first", "err"); return "no-render"; }
    const link = APP_URL + "#connect=" + encodeURIComponent(btoa(JSON.stringify(sync.config)));
    navigator.clipboard.writeText(link).then(
      () => toast("📋 Link copied — open it on your phone once"),
      () => toast("Couldn't copy automatically", "err"));
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
    if (!confirm("Erase ALL local data? (Cloud data is not touched.)")) return "no-render";
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
          if (!confirm("Import this backup? It replaces your current local data.")) return;
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
  ["dm", "mt"].forEach(p => {
    const sel = document.getElementById(p + "Repeat");
    const row = document.getElementById(p + "Days");
    if (sel && row) sel.addEventListener("change", () => { row.style.display = sel.value === "custom" ? "flex" : "none"; });
  });
  const enterMap = {
    rtText: "add-routine", msTitle: "add-milestone", mtTitle: "add-meeting", dmTitle: "add-day-meeting",
    customMl: "add-water-custom", eatNew: "add-eat", avoidNew: "add-avoid", exName: "add-exercise", pfName: "add-food",
  };
  Object.entries(enterMap).forEach(([id, act]) => {
    const inp = document.getElementById(id);
    if (inp) inp.addEventListener("keydown", ev => { if (ev.key === "Enter") runAction(act, inp); });
  });
}

/* One-tap device setup via #connect=<base64 {url,key}> */
function handleConnectLink() {
  const m = location.hash.match(/^#connect=(.+)/);
  if (!m) return;
  try {
    const cfg = JSON.parse(atob(decodeURIComponent(m[1])));
    if (cfg.url && cfg.key) {
      sync.config = { url: cfg.url, key: cfg.key };
      localStorage.setItem(SYNC_KEY, JSON.stringify(sync.config));
      toast("☁️ Cloud sync configured — connecting…");
    } else throw new Error("missing fields");
  } catch (e) { toast("That connect link looks invalid", "err"); }
  history.replaceState(null, "", location.pathname + location.search);
}

function init() {
  load();
  handleConnectLink();
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
