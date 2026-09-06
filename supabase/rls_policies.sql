-- ============================================================
-- PART B: Row Level Security (RLS) — Dhatu Setu
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- DESIGN RATIONALE (for Q&A):
--   • SELECT + INSERT are open to the anon key so the demo app
--     (which uses the public anon key) can read and write.
--   • UPDATE is allowed only on tables that need it
--     (facilities for pin, material_rates for MoM rate edits,
--      dispatches for status updates by recycler).
--   • DELETE is BLOCKED on intake_transactions and dispatches
--     because these are immutable ledger tables — every mineral
--     gram must be permanently auditable. Deletion would break
--     the chain-of-custody proof. This mirrors how blockchain
--     ledgers work: append-only.
-- ============================================================

-- ── 1. FACILITIES ────────────────────────────────────────────
alter table facilities enable row level security;

-- Anon can read facility list (needed for login dropdown)
create policy "anon_select_facilities"
  on facilities for select
  to anon
  using (true);

-- Anon can update facilities (needed for pin column demo)
create policy "anon_update_facilities"
  on facilities for update
  to anon
  using (true);

-- No insert/delete by anon — facilities are pre-seeded by admin

-- ── 2. COLLECTORS ────────────────────────────────────────────
alter table collectors enable row level security;

-- Anon can read collectors (needed for Digital ID page)
create policy "anon_select_collectors"
  on collectors for select
  to anon
  using (true);

-- Anon can insert new collectors (POS registers new Kabadiwalas)
create policy "anon_insert_collectors"
  on collectors for insert
  to anon
  with check (true);

-- Anon can update collectors (e.g. dbt_eligible flag)
create policy "anon_update_collectors"
  on collectors for update
  to anon
  using (true);

-- DELETE BLOCKED — no policy means deletion is denied by default

-- ── 3. INTAKE TRANSACTIONS ───────────────────────────────────
-- This is the immutable ledger of every mineral intake event.
-- Deletion is intentionally prohibited to ensure auditability.
alter table intake_transactions enable row level security;

-- Anon can read all intake records (dashboard + collector ID page)
create policy "anon_select_intake"
  on intake_transactions for select
  to anon
  using (true);

-- Anon can insert new intake records (POS terminal logs intake)
create policy "anon_insert_intake"
  on intake_transactions for insert
  to anon
  with check (true);

-- NO DELETE POLICY → deletion is blocked by RLS (append-only ledger)
-- NO UPDATE POLICY → once logged, a weight record cannot be altered

-- ── 4. DISPATCHES ────────────────────────────────────────────
-- Dispatch records are also ledger entries; deletion is blocked.
-- However, recyclers must be able to UPDATE status (accept/reject).
alter table dispatches enable row level security;

-- Anon can read dispatches (recycler portal + inventory page)
create policy "anon_select_dispatches"
  on dispatches for select
  to anon
  using (true);

-- Anon can insert dispatch records (aggregator authorises dispatch)
create policy "anon_insert_dispatches"
  on dispatches for insert
  to anon
  with check (true);

-- Anon can update dispatches (recycler accepts/rejects incoming)
create policy "anon_update_dispatches"
  on dispatches for update
  to anon
  using (true);

-- NO DELETE POLICY → deletion blocked — dispatch ledger is permanent

-- ── 5. MATERIAL RATES ────────────────────────────────────────
alter table material_rates enable row level security;

-- Anon can read rates (POS terminal + collector ID page)
create policy "anon_select_rates"
  on material_rates for select
  to anon
  using (true);

-- Anon can update rates (MoM dashboard admin panel)
create policy "anon_update_rates"
  on material_rates for update
  to anon
  using (true);

-- No insert/delete by anon — rates rows are pre-seeded, only updated
