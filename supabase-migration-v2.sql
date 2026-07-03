-- ============================================================
-- Momentum v2 schema — dimensional design (Kimball)
-- Run once in Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Layer 1: OLTP operational tables (source of truth, app writes)
-- Layer 2: OLAP star schema as views (dims + facts, analytics)
-- Layer 3: one-time migration of v1 jsonb data (tracker_days/kv)
-- ============================================================

-- ---------- Layer 1 · operational tables ----------

create table if not exists food_catalog (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  category    text not null default 'food' check (category in ('food','beverage')),
  unit        text not null,
  kcal        numeric not null default 0,
  protein_g   numeric not null default 0,
  fiber_g     numeric not null default 0,
  is_preset   boolean not null default true
);

create table if not exists day_info (
  date        date primary key,
  day_type    text not null default 'normal' check (day_type in ('normal','rest','holiday')),
  location    text not null default 'home'   check (location in ('home','office','travel')),
  actual_wake time,
  timezone    text,
  updated_at  timestamptz not null default now()
);

create table if not exists consumption_log (
  id         text primary key,              -- client-generated uid
  date       date not null,
  time_of_day time,
  food_id    bigint references food_catalog(id),
  food_name  text not null,
  qty        numeric not null default 1,
  unit       text,
  ml         integer not null default 0,    -- hydration volume when beverage
  kcal       numeric not null default 0,
  protein_g  numeric not null default 0,
  fiber_g    numeric not null default 0,
  meal_type  text check (meal_type in ('breakfast','lunch','snack','dinner')),
  is_cheat   boolean not null default false
);
create index if not exists ix_consumption_date on consumption_log(date);

create table if not exists exercise_log (
  id           text primary key,
  date         date not null,
  time_of_day  time,
  exercise     text not null,
  muscle_group text check (muscle_group in ('abs','legs','arms')),
  sets         int not null,
  reps         int not null
);
create index if not exists ix_exercise_date on exercise_log(date);

create table if not exists schedule_log (
  id           text primary key,
  date         date not null,
  kind         text not null check (kind in ('routine','meeting','commute')),
  title        text not null,
  planned_time time,
  shifted_time time,
  anchored     boolean not null default false,
  completed    boolean not null default false,
  skipped      boolean not null default false,
  meeting_id   text
);
create index if not exists ix_schedule_date on schedule_log(date);

create table if not exists meetings (
  id           text primary key,
  title        text not null,
  start_date   date not null,
  time_of_day  time,
  duration_min int not null default 30,
  repeat       text not null default 'none'
               check (repeat in ('none','daily','weekdays','weekly','custom')),
  custom_days  int[] not null default '{}',  -- 0=Sun … 6=Sat
  notes        text not null default '',
  timezone     text not null default 'America/Chicago'
);

create table if not exists milestones (
  id          text primary key,
  title       text not null,
  target_date date,
  status      text not null default 'planned'
              check (status in ('planned','in-progress','done')),
  created_at  timestamptz not null default now()
);

create table if not exists milestone_steps (
  id           text primary key,
  milestone_id text not null references milestones(id) on delete cascade,
  step_date    date not null,
  note         text not null
);

create table if not exists body_log (
  date         date primary key,
  weight_kg    numeric,
  body_fat_pct numeric,
  updated_at   timestamptz not null default now()
);

create table if not exists commute_log (
  id        text primary key,
  date      date not null,
  direction text not null check (direction in ('to_office','to_home')),
  minutes   int not null default 40
);
create index if not exists ix_commute_date on commute_log(date);

create table if not exists app_settings (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists work_meta (      -- last-write-wins stamp for the work scope
  key        text primary key,
  updated_at timestamptz not null default now()
);

-- ---------- RLS (personal single-user app: anon key gets full access) ----------
do $$
declare t text;
begin
  foreach t in array array['food_catalog','day_info','consumption_log','exercise_log',
    'schedule_log','meetings','milestones','milestone_steps','body_log','commute_log',
    'app_settings','work_meta']
  loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'personal_all') then
      execute format('create policy personal_all on %I for all using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- ---------- Seed food catalog (kcal + protein + fiber per unit) ----------
insert into food_catalog (name, category, unit, kcal, protein_g, fiber_g) values
  ('Water',               'beverage', '100 ml',        0,    0,    0),
  ('Buttermilk',          'beverage', 'glass (250ml)', 35,   2,    0),
  ('Milk',                'beverage', 'glass (250ml)', 150,  8,    0),
  ('Egg (whole)',         'food', 'egg',          78,   6,    0),
  ('Egg white',           'food', 'egg white',    17,   3.6,  0),
  ('Chicken breast',      'food', '100g',         165,  31,   0),
  ('Fish',                'food', '100g',         130,  22,   0),
  ('Paneer',              'food', '100g',         265,  18,   0),
  ('Whey protein',        'food', 'scoop',        120,  24,   0),
  ('Curd',                'food', '100g',         60,   4,    0),
  ('Dal (cooked)',        'food', '100g',         115,  9,    8),
  ('Soya chunks',         'food', '50g dry',      170,  26,   6.5),
  ('Peanuts',             'food', '30g',          170,  7.5,  2.5),
  ('Oats (dry)',          'food', '40g',          150,  5,    4),
  ('Apple',               'food', 'medium',       95,   0.5,  4.4),
  ('Banana',              'food', 'medium',       105,  1.3,  3.1),
  ('Orange',              'food', 'medium',       62,   1.2,  3),
  ('Guava',               'food', 'medium',       68,   2.6,  5.4),
  ('Rajma (cooked)',      'food', '100g',         127,  8.7,  6.4),
  ('Chana (cooked)',      'food', '100g',         164,  8.9,  7.6),
  ('Roti / chapati',      'food', 'roti',         104,  3,    2),
  ('Rice (cooked)',       'food', '100g',         130,  2.7,  0.4),
  ('Brown rice (cooked)', 'food', '100g',         111,  2.6,  1.8),
  ('Broccoli',            'food', '100g',         34,   2.8,  2.6),
  ('Carrot',              'food', '100g',         41,   0.9,  2.8),
  ('Spinach (cooked)',    'food', '100g',         23,   3,    2.4),
  ('Sweet potato',        'food', '100g',         86,   1.6,  3),
  ('Chia seeds',          'food', 'tbsp',         58,   2,    4.1),
  ('Flax seeds',          'food', 'tbsp',         55,   1.9,  2.8),
  ('Almonds',             'food', '30g',          174,  6.3,  3.5),
  ('Mixed salad',         'food', 'bowl',         50,   2,    3),
  ('Mixed vegetables (cooked)', 'food', '100g',   60,   2,    3)
on conflict (name) do nothing;

-- ---------- Layer 3 · migrate v1 jsonb data (skipped if v1 tables absent) ----------
do $$
begin
  if to_regclass('public.tracker_days') is null then
    raise notice 'v1 tables not found - skipping data migration';
    return;
  end if;

  -- day info
  insert into day_info (date, day_type, updated_at)
  select d.date::date, coalesce(d.data->>'dayType','normal'), d.updated_at
  from tracker_days d
  on conflict (date) do nothing;

  -- water/buttermilk -> consumption
  insert into consumption_log (id, date, time_of_day, food_name, qty, unit, ml, kcal, protein_g)
  select w->>'id', d.date::date, nullif(w->>'time','')::time,
         case when w->>'type' = 'buttermilk' then 'Buttermilk' else 'Water' end,
         1, 'entry', (w->>'ml')::int,
         case when w->>'type' = 'buttermilk' then round((w->>'ml')::numeric * 35 / 250) else 0 end,
         case when w->>'type' = 'buttermilk' then round((w->>'ml')::numeric * 2 / 250, 1) else 0 end
  from tracker_days d, jsonb_array_elements(coalesce(d.data->'water','[]'::jsonb)) w
  on conflict (id) do nothing;

  -- protein entries (historical kcal unknown -> protein measure only)
  insert into consumption_log (id, date, time_of_day, food_name, qty, unit, protein_g)
  select p->>'id', d.date::date, nullif(p->>'time','')::time,
         p->>'food', coalesce((p->>'qty')::numeric,1), p->>'unit', coalesce((p->>'grams')::numeric,0)
  from tracker_days d, jsonb_array_elements(coalesce(d.data->'protein','[]'::jsonb)) p
  on conflict (id) do nothing;

  -- fiber entries
  insert into consumption_log (id, date, time_of_day, food_name, qty, unit, fiber_g)
  select f->>'id', d.date::date, nullif(f->>'time','')::time,
         f->>'food', coalesce((f->>'qty')::numeric,1), f->>'unit', coalesce((f->>'grams')::numeric,0)
  from tracker_days d, jsonb_array_elements(coalesce(d.data->'fiber','[]'::jsonb)) f
  on conflict (id) do nothing;

  -- meals (text notes; measures unknown)
  insert into consumption_log (id, date, time_of_day, food_name, qty, unit, meal_type, is_cheat)
  select m->>'id', d.date::date, nullif(m->>'time','')::time,
         m->>'text', 1, 'meal', m->>'type', coalesce((m->>'cheat')::boolean, false)
  from tracker_days d, jsonb_array_elements(coalesce(d.data->'meals','[]'::jsonb)) m
  on conflict (id) do nothing;

  -- exercises
  insert into exercise_log (id, date, time_of_day, exercise, muscle_group, sets, reps)
  select e->>'id', d.date::date, nullif(e->>'time','')::time,
         e->>'name', e->>'cat', coalesce((e->>'sets')::int,1), coalesce((e->>'reps')::int,1)
  from tracker_days d, jsonb_array_elements(coalesce(d.data->'exercises','[]'::jsonb)) e
  on conflict (id) do nothing;

  -- routine items -> schedule log
  insert into schedule_log (id, date, kind, title, planned_time, completed)
  select r->>'id', d.date::date, 'routine', r->>'text',
         nullif(r->>'time','')::time, coalesce((r->>'done')::boolean,false)
  from tracker_days d, jsonb_array_elements(coalesce(d.data->'routine','[]'::jsonb)) r
  on conflict (id) do nothing;

  -- work kv -> meetings / milestones / steps
  insert into meetings (id, title, start_date, time_of_day, repeat, custom_days, notes)
  select m->>'id', m->>'title', (m->>'date')::date, nullif(m->>'time','')::time,
         coalesce(m->>'repeat','none'),
         coalesce((select array_agg(x::int) from jsonb_array_elements_text(coalesce(m->'days','[]'::jsonb)) x), '{}'),
         coalesce(m->>'notes','')
  from tracker_kv kv, jsonb_array_elements(coalesce(kv.data->'meetings','[]'::jsonb)) m
  where kv.key = 'work'
  on conflict (id) do nothing;

  insert into milestones (id, title, target_date, status)
  select ms->>'id', ms->>'title', nullif(ms->>'target','')::date, coalesce(ms->>'status','planned')
  from tracker_kv kv, jsonb_array_elements(coalesce(kv.data->'milestones','[]'::jsonb)) ms
  where kv.key = 'work'
  on conflict (id) do nothing;

  insert into milestone_steps (id, milestone_id, step_date, note)
  select s->>'id', ms->>'id', (s->>'date')::date, s->>'text'
  from tracker_kv kv,
       jsonb_array_elements(coalesce(kv.data->'milestones','[]'::jsonb)) ms,
       jsonb_array_elements(coalesce(ms->'steps','[]'::jsonb)) s
  where kv.key = 'work'
  on conflict (id) do nothing;

  -- body kv -> body log
  insert into body_log (date, weight_kg, body_fat_pct)
  select (b->>'date')::date, (b->>'weight')::numeric, (b->>'bodyFat')::numeric
  from tracker_kv kv, jsonb_array_elements(coalesce(kv.data,'[]'::jsonb)) b
  where kv.key = 'body'
  on conflict (date) do nothing;

  -- settings kv -> app settings
  insert into app_settings (key, data, updated_at)
  select 'main', kv.data, kv.updated_at from tracker_kv kv where kv.key = 'settings'
  on conflict (key) do nothing;

  raise notice 'v1 data migrated';
end $$;

-- ---------- Layer 2 · star schema (views over the operational layer) ----------

create or replace view dim_date as
with all_dates as (
  select date from consumption_log union
  select date from exercise_log    union
  select date from schedule_log    union
  select date from body_log        union
  select date from commute_log     union
  select date from day_info
)
select a.date as date_key,
       extract(isodow from a.date)::int          as iso_dow,       -- 1=Mon … 7=Sun
       to_char(a.date, 'Dy')                     as day_name,
       to_char(a.date, 'IYYY-IW')                as iso_week,
       to_char(a.date, 'YYYY-MM')                as year_month,
       coalesce(di.day_type, 'normal')           as day_type,
       coalesce(di.location,
                case when extract(isodow from a.date) in (2,4) then 'office' else 'home' end)
                                                 as location,
       extract(isodow from a.date) in (2,4)      as is_office_day,
       di.actual_wake,
       di.timezone
from all_dates a
left join day_info di on di.date = a.date;

create or replace view dim_food as
select id as food_key, name, category, unit, kcal, protein_g, fiber_g, is_preset
from food_catalog;

create or replace view dim_meeting as
select id as meeting_key, title, start_date, time_of_day, duration_min, repeat, custom_days, timezone
from meetings;

create or replace view fact_consumption as
select c.id, c.date as date_key, c.time_of_day, c.food_id as food_key, c.food_name,
       coalesce(f.category, case when c.ml > 0 then 'beverage' else 'food' end) as category,
       c.meal_type, c.is_cheat,
       c.qty, c.ml, c.kcal, c.protein_g, c.fiber_g
from consumption_log c
left join food_catalog f on f.id = c.food_id;

create or replace view fact_exercise_set as
select id, date as date_key, time_of_day, exercise, muscle_group,
       sets, reps, sets * reps as volume
from exercise_log;

create or replace view fact_schedule_event as
select id, date as date_key, kind, title, meeting_id,
       planned_time, shifted_time, anchored,
       completed::int as completed, skipped::int as skipped,
       case when shifted_time is not null and planned_time is not null
            then round(extract(epoch from (shifted_time - planned_time)) / 60)
            else 0 end as shift_minutes
from schedule_log;

create or replace view fact_body_measurement as
select date as date_key, weight_kg, body_fat_pct from body_log;

create or replace view fact_commute as
select id, date as date_key, direction, minutes from commute_log;

create or replace view fact_daily_summary as
select d.date_key, d.day_type, d.location, d.is_office_day,
       coalesce(w.water_ml, 0)        as water_ml,
       coalesce(n.kcal, 0)            as kcal_in,
       coalesce(n.protein_g, 0)       as protein_g,
       coalesce(n.fiber_g, 0)         as fiber_g,
       coalesce(n.cheat_meals, 0)     as cheat_meals,
       coalesce(e.exercise_count, 0)  as exercise_count,
       coalesce(e.total_volume, 0)    as total_volume,
       coalesce(s.routine_total, 0)   as routine_total,
       coalesce(s.routine_done, 0)    as routine_done,
       case when coalesce(s.routine_total,0) > 0
            then round(100.0 * s.routine_done / s.routine_total) else 0 end as routine_pct,
       coalesce(c.commute_minutes, 0) as commute_minutes,
       b.weight_kg, b.body_fat_pct
from dim_date d
left join (select date, sum(ml) as water_ml
           from consumption_log group by date) w on w.date = d.date_key
left join (select date, sum(kcal) as kcal, sum(protein_g) as protein_g, sum(fiber_g) as fiber_g,
                  count(*) filter (where is_cheat) as cheat_meals
           from consumption_log group by date) n on n.date = d.date_key
left join (select date, count(*) as exercise_count, sum(sets*reps) as total_volume
           from exercise_log group by date) e on e.date = d.date_key
left join (select date, count(*) filter (where kind = 'routine') as routine_total,
                  count(*) filter (where kind = 'routine' and completed) as routine_done
           from schedule_log group by date) s on s.date = d.date_key
left join (select date, sum(minutes) as commute_minutes
           from commute_log group by date) c on c.date = d.date_key
left join body_log b on b.date = d.date_key;

-- Example analytics this design unlocks:
--   select location, avg(protein_g) from fact_daily_summary group by location;
--   select year_month, sum(cheat_meals) from fact_daily_summary f
--     join dim_date d on d.date_key = f.date_key group by 1 order by 1;
