/** THE GRID — Time Utilities */

/** Today's date as YYYY-MM-DD */
export function today() {
  return new Date().toISOString().split('T')[0];
}

/** Format "HH:MM" (24h) from a time string */
export function formatTime(timeStr) {
  if (!timeStr) return '--:--';
  return timeStr.slice(0, 5);
}

/** Format duration in minutes to "Xh Ym" */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Calculate end time from start + duration */
export function endTime(startTime, durationMin) {
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + durationMin;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/** Convert time string to total minutes since midnight */
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** Check if two blocks overlap */
export function blocksOverlap(a, b) {
  const aStart = timeToMinutes(a.start_time);
  const aEnd = aStart + a.duration_minutes;
  const bStart = timeToMinutes(b.start_time);
  const bEnd = bStart + b.duration_minutes;
  return aStart < bEnd && bStart < aEnd;
}

/** Detect overlaps between a new block and existing blocks */
export function findOverlaps(newBlock, existingBlocks, excludeId) {
  return existingBlocks.filter(b =>
    b.id !== excludeId && blocksOverlap(newBlock, b)
  );
}

/** Get current time as "HH:MM:SS" */
export function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** Get current time as total minutes since midnight */
export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Seconds remaining in a block from now */
export function secondsRemaining(startTime, durationMin) {
  const d = new Date();
  const nowSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  const [h, m] = startTime.split(':').map(Number);
  const endSec = (h * 60 + m + durationMin) * 60;
  return Math.max(0, endSec - nowSec);
}

/** Format seconds as MM:SS or HH:MM:SS */
export function formatSeconds(sec) {
  if (sec <= 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Is a block currently active? (now is within its time range) */
export function isBlockActive(block) {
  const nowM = nowMinutes();
  const start = timeToMinutes(block.start_time);
  const end = start + block.duration_minutes;
  return nowM >= start && nowM < end;
}

/** Is a block in the past? */
export function isBlockPast(block) {
  const nowM = nowMinutes();
  const end = timeToMinutes(block.start_time) + block.duration_minutes;
  return nowM >= end;
}

/** Category display names */
export const CATEGORIES = {
  prayer: 'Prayer',
  bible_study: 'Bible Study',
  reading: 'Reading',
  writing: 'Writing',
  exercise: 'Exercise',
  deep_work: 'Deep Work',
  admin: 'Admin',
  meals: 'Meals',
  rest: 'Rest',
  other: 'Other',
};

/** Category keys */
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

/** Priority display */
export const PRIORITIES = {
  critical: 'Critical',
  important: 'Important',
  routine: 'Routine',
};
