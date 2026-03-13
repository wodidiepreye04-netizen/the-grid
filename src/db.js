/** THE GRID — Supabase Client */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://btiapgmtcuhmnagrcvyz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0aWFwZ210Y3VobW5hZ3Jjdnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDcwNjUsImV4cCI6MjA4ODk4MzA2NX0.EYMyr50duN3Q-CkhxdcqwuX9RC5gJx-cOokRp2w0zjw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── DAILY BLOCKS ─────────────────────────────────────────
export async function getBlocksByDate(date) {
  const { data, error } = await supabase
    .from('daily_blocks')
    .select('*')
    .eq('block_date', date)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createBlock(block) {
  const { data, error } = await supabase
    .from('daily_blocks')
    .insert(block)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBlock(id, updates) {
  const { data, error } = await supabase
    .from('daily_blocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBlock(id) {
  const { error } = await supabase
    .from('daily_blocks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function updateBlockOrders(blocks) {
  const updates = blocks.map((b, i) =>
    supabase.from('daily_blocks').update({ sort_order: i }).eq('id', b.id)
  );
  await Promise.all(updates);
}

// ── CHECK-INS ────────────────────────────────────────────
export async function createCheckIn(checkIn) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert(checkIn)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCheckInsByDate(date) {
  const { data, error } = await supabase
    .from('check_ins')
    .select('*, daily_blocks!inner(block_date)')
    .eq('daily_blocks.block_date', date);
  if (error) throw error;
  return data || [];
}

export async function getCheckInForBlock(blockId) {
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('block_id', blockId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── DEEP WORK SESSIONS ──────────────────────────────────
export async function createDeepWorkSession(session) {
  const { data, error } = await supabase
    .from('deep_work_sessions')
    .insert(session)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDeepWorkSession(id, updates) {
  const { data, error } = await supabase
    .from('deep_work_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── DAILY REPORTS ────────────────────────────────────────
export async function getReport(date) {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('report_date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveReport(report) {
  const { data, error } = await supabase
    .from('daily_reports')
    .upsert(report, { onConflict: 'report_date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getReportsRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .gte('report_date', startDate)
    .lte('report_date', endDate)
    .order('report_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── TEMPLATES ────────────────────────────────────────────
export async function getTemplates() {
  const { data, error } = await supabase
    .from('block_templates')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveTemplate(template) {
  const { data, error } = await supabase
    .from('block_templates')
    .insert(template)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clearTemplates() {
  const { error } = await supabase
    .from('block_templates')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

export async function replaceTemplates(templates) {
  await clearTemplates();
  if (templates.length === 0) return [];
  const { data, error } = await supabase
    .from('block_templates')
    .insert(templates)
    .select();
  if (error) throw error;
  return data || [];
}
