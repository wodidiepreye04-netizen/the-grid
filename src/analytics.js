/** THE GRID — PostHog Analytics */
import posthog from 'posthog-js';

const PH_KEY = 'phc_NWUH5xL9nlJ6ibPUNmiNTNLXYaJIrGK52d1ULXwttEp';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  posthog.init(PH_KEY, {
    api_host: 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    persistence: 'localStorage',
  });
  initialized = true;
}

export function trackPage(page) {
  posthog.capture('$pageview', { page });
}

export function trackBlockCreate(block) {
  posthog.capture('block_created', {
    category: block.category,
    priority: block.priority,
    duration: block.duration_minutes,
  });
}

export function trackCheckIn(response, blockCategory) {
  posthog.capture('check_in', {
    response,
    category: blockCategory,
  });
}

export function trackBlockComplete(blockCategory) {
  posthog.capture('block_completed', { category: blockCategory });
}

export function trackSkip(reason, blockCategory) {
  posthog.capture('block_skipped', { reason, category: blockCategory });
}

export function trackDeepWork(integrityScore, durationMin) {
  posthog.capture('deep_work_session', {
    integrity_score: integrityScore,
    duration_minutes: durationMin,
  });
}

export function trackDayComplete(score, totalBlocks, completedBlocks) {
  posthog.capture('day_completed', {
    score,
    total_blocks: totalBlocks,
    completed_blocks: completedBlocks,
  });
}

export function trackStreak(days) {
  posthog.capture('streak_update', { streak_days: days });
}

export function trackPdfDownload(date) {
  posthog.capture('pdf_downloaded', { report_date: date });
}
