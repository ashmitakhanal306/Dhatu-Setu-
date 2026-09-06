-- ============================================================
-- MoM Mineral Traceability Platform — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. FACILITIES (Aggregators & Formal Recyclers)
create table if not exists facilities (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  location    text not null,
  type        text not null check (type in ('Aggregator', 'Formal Recycler')),
  pin         text not null default '1234',
  latitude    numeric(9,6),
  longitude   numeric(9,6),
  created_at  timestamptz default now()
);


-- 2. COLLECTORS (Informal / Kabadiwalas — phone as PK)
create table if not exists collectors (
  phone       text primary key,
  name        text not null,
  dbt_eligible boolean not null default false,
  created_at  timestamptz default now()
);

-- 3. INTAKE TRANSACTIONS (Aggregator logs material coming IN from collectors)
create table if not exists intake_transactions (
  id              uuid primary key default gen_random_uuid(),
  collector_phone text not null references collectors(phone) on delete restrict,
  aggregator_id   text not null references facilities(id) on delete restrict,
  material_code   text not null check (material_code in ('COPPER', 'ALUMINUM', 'EWASTE')),
  weight_kg       numeric(10, 3) not null check (weight_kg > 0),
  timestamp       timestamptz not null default now()
);

-- 4. DISPATCHES (Aggregator sends material OUT to formal recycler)
create table if not exists dispatches (
  id                  uuid primary key default gen_random_uuid(),
  aggregator_id       text not null references facilities(id) on delete restrict,
  recycler_id         text not null references facilities(id) on delete restrict,
  material_code       text not null check (material_code in ('COPPER', 'ALUMINUM', 'EWASTE')),
  weight_kg           numeric(10, 3) not null check (weight_kg > 0),
  status              text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  received_weight_kg  numeric(10, 3),
  rejection_reason    text,
  timestamp           timestamptz not null default now()
);

-- ============================================================
-- INDEXES for common query patterns
-- ============================================================
create index if not exists idx_intake_aggregator   on intake_transactions(aggregator_id);
create index if not exists idx_intake_collector    on intake_transactions(collector_phone);
create index if not exists idx_intake_material     on intake_transactions(material_code);
create index if not exists idx_dispatch_aggregator on dispatches(aggregator_id);
create index if not exists idx_dispatch_recycler   on dispatches(recycler_id);
create index if not exists idx_dispatch_status     on dispatches(status);

-- ============================================================
-- 5. SEED DATA — Demo facilities for local testing
-- ============================================================
insert into facilities (id, name, location, type, pin) values
  ('agg-001', 'Delhi Central Godown',     'Karol Bagh, New Delhi',      'Aggregator', '1234'),
  ('agg-002', 'Mumbai West Scrap Yard',   'Dharavi, Mumbai',             'Aggregator', '1234'),
  ('rec-001', 'National E-Waste Corp',    'Sriperumbudur, Tamil Nadu',  'Formal Recycler', '1234'),
  ('rec-002', 'Hindalco Metals',          'Dahej, Gujarat',             'Formal Recycler', '1234'),
  ('rec-003', 'Bharat Copper Ltd',        'Khetri, Rajasthan',          'Formal Recycler', '1234')
on conflict (id) do update set pin = excluded.pin;

-- ============================================================
-- 6. MATERIAL RATES — MoM-controlled per-kg purchase rates
-- ============================================================
create table if not exists material_rates (
  material_code text primary key check (material_code in ('COPPER', 'ALUMINUM', 'EWASTE')),
  rate_per_kg   numeric(10, 2) not null,
  updated_at    timestamptz not null default now()
);

insert into material_rates (material_code, rate_per_kg) values
  ('COPPER',   500),
  ('ALUMINUM', 150),
  ('EWASTE',    50)
on conflict (material_code) do nothing;

