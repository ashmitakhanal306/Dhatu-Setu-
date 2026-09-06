-- ============================================================
-- PART A: Add lat/lon columns to facilities
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

alter table facilities
  add column if not exists latitude  numeric(9,6),
  add column if not exists longitude numeric(9,6);

-- Update seed rows with real approximate coordinates
update facilities set latitude = 28.651900, longitude = 77.190900 where id = 'agg-001';
update facilities set latitude = 19.041000, longitude = 72.857000 where id = 'agg-002';
update facilities set latitude = 12.967500, longitude = 79.943200 where id = 'rec-001';
update facilities set latitude = 21.705100, longitude = 72.541100 where id = 'rec-002';
update facilities set latitude = 28.000000, longitude = 75.788500 where id = 'rec-003';
