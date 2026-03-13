-- ═══════════════════════════════════════════════════════
-- THE GRID — Supabase Schema Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ═══════════════════════════════════════════════════════

-- 1. Block Templates (reusable default schedule)
CREATE TABLE IF NOT EXISTS block_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  category TEXT NOT NULL CHECK (category IN (
    'prayer','bible_study','reading','writing','exercise',
    'deep_work','admin','meals','rest','other'
  )),
  priority TEXT NOT NULL CHECK (priority IN ('critical','important','routine')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Daily Blocks (scheduled blocks per date)
CREATE TABLE IF NOT EXISTS daily_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  block_date DATE NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  category TEXT NOT NULL CHECK (category IN (
    'prayer','bible_study','reading','writing','exercise',
    'deep_work','admin','meals','rest','other'
  )),
  priority TEXT NOT NULL CHECK (priority IN ('critical','important','routine')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','started','delayed','skipped','completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_blocks_date ON daily_blocks(block_date);

-- 3. Check-Ins (mandatory block responses)
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id UUID NOT NULL REFERENCES daily_blocks(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('started','delayed','skipped')),
  skip_reason TEXT,
  responded_at TIMESTAMPTZ DEFAULT now(),
  auto_skipped BOOLEAN DEFAULT false,
  delay_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_check_ins_block ON check_ins(block_id);

-- 4. Deep Work Sessions (focus integrity tracking)
CREATE TABLE IF NOT EXISTS deep_work_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id UUID NOT NULL REFERENCES daily_blocks(id) ON DELETE CASCADE,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  focused_seconds INTEGER NOT NULL DEFAULT 0,
  exits INTEGER NOT NULL DEFAULT 0,
  integrity_score NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_seconds > 0
      THEN ROUND((focused_seconds::NUMERIC / total_seconds) * 100, 2)
      ELSE 0
    END
  ) STORED,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- 5. Daily Reports (end-of-day summaries)
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  total_blocks INTEGER NOT NULL,
  completed_blocks INTEGER NOT NULL,
  skipped_blocks INTEGER NOT NULL,
  completion_score NUMERIC(5,2) NOT NULL,
  deep_work_integrity NUMERIC(5,2),
  verdict TEXT NOT NULL,
  recommendation TEXT,
  report_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

-- ═══════════════════════════════════════════════════════
-- Row Level Security (disabled for single-user mode)
-- Enable these if you add auth later
-- ═══════════════════════════════════════════════════════
ALTER TABLE block_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE deep_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (single user, no auth)
CREATE POLICY "anon_all" ON block_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON daily_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON check_ins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON deep_work_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON daily_reports FOR ALL USING (true) WITH CHECK (true);
