/** THE GRID — Deep Work Mode */
import { createDeepWorkSession, updateDeepWorkSession, updateBlock } from '../db.js';
import { formatSeconds } from '../utils/time.js';
import { trackDeepWork } from '../analytics.js';
import { toast } from '../utils/toast.js';
import { navigate } from '../router.js';
import * as state from '../state.js';

let timerInterval = null;
let focusStart = null;
let totalFocused = 0;
let totalElapsed = 0;
let exits = 0;
let sessionId = null;
let blockId = null;
let blockDurationSec = 0;
let isFocused = true;

export function initDeepWork(container) {
  const overlay = document.getElementById('deepwork-overlay');
  const activeBlock = state.get('deepWorkBlock');

  if (!activeBlock) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header__title">DEEP WORK</div>
        <div class="page-header__sub">No active Deep Work block</div>
      </div>
      <div class="empty">
        <div class="empty__icon">◉</div>
        <div class="empty__text">Deep Work mode activates automatically when a Deep Work block starts.</div>
        <a href="#/today" class="btn btn--green">BACK TO GRID</a>
      </div>
    `;
    return cleanup;
  }

  blockId = activeBlock.id;
  blockDurationSec = activeBlock.duration_minutes * 60;

  startSession(overlay, activeBlock);

  return cleanup;
}

async function startSession(overlay, block) {
  // Create session in DB
  try {
    const session = await createDeepWorkSession({
      block_id: block.id,
      total_seconds: 0,
      focused_seconds: 0,
      exits: 0,
      started_at: new Date().toISOString(),
    });
    sessionId = session.id;
  } catch (e) {
    console.error('[GRID] Deep Work session start failed:', e);
  }

  totalFocused = 0;
  totalElapsed = 0;
  exits = 0;
  isFocused = true;
  focusStart = Date.now();

  // Render overlay
  overlay.innerHTML = `
    <div class="deepwork__task">${block.name}</div>
    <div class="deepwork__timer" id="dw-timer">${formatSeconds(blockDurationSec)}</div>
    <div id="dw-reentry" style="display:none; margin-top: var(--g-sp-6);">
      <div class="amber" style="font-size: var(--g-fs-sm); margin-bottom: var(--g-sp-3);">YOU LEFT FOCUS. RETURN TO WORK.</div>
      <button class="btn btn--green btn--lg" id="dw-refocus">RE-ENTER FOCUS</button>
    </div>
    <div class="deepwork__exit">
      <button class="btn" id="dw-end" style="margin-top: var(--g-sp-4);">END SESSION</button>
    </div>
  `;
  overlay.classList.add('deepwork--active');

  // Timer
  timerInterval = setInterval(() => {
    totalElapsed++;
    if (isFocused) totalFocused++;

    const remaining = Math.max(0, blockDurationSec - totalElapsed);
    const timerEl = document.getElementById('dw-timer');
    if (timerEl) timerEl.textContent = formatSeconds(remaining);

    if (remaining <= 0) {
      endSession(overlay);
    }
  }, 1000);

  // Visibility change detection (tab-away)
  document.addEventListener('visibilitychange', handleVisibility);

  // End button
  document.getElementById('dw-end').addEventListener('click', () => endSession(overlay));
  document.getElementById('dw-refocus')?.addEventListener('click', () => {
    isFocused = true;
    focusStart = Date.now();
    document.getElementById('dw-reentry').style.display = 'none';
  });
}

function handleVisibility() {
  if (document.hidden) {
    // Left focus
    isFocused = false;
    exits++;
  } else {
    // Returned — show re-entry prompt
    const reentry = document.getElementById('dw-reentry');
    if (reentry) reentry.style.display = 'block';
  }
}

async function endSession(overlay) {
  clearInterval(timerInterval);
  timerInterval = null;
  document.removeEventListener('visibilitychange', handleVisibility);

  const integrityScore = totalElapsed > 0
    ? Math.round((totalFocused / totalElapsed) * 100)
    : 0;

  // Save to DB
  if (sessionId) {
    try {
      await updateDeepWorkSession(sessionId, {
        total_seconds: totalElapsed,
        focused_seconds: totalFocused,
        exits,
        ended_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[GRID] Deep Work session save failed:', e);
    }
  }

  // Update block status
  if (blockId) {
    try {
      await updateBlock(blockId, { status: 'completed' });
    } catch (e) { /* skip */ }
  }

  // Track
  trackDeepWork(integrityScore, Math.round(totalElapsed / 60));

  // Close overlay
  overlay.classList.remove('deepwork--active');
  overlay.innerHTML = '';

  // Clear state
  state.set('deepWorkBlock', null);

  toast(`Deep Work complete. Integrity: ${integrityScore}%`);
  navigate('/today');
}

function cleanup() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  document.removeEventListener('visibilitychange', handleVisibility);
}

/** Activate Deep Work from outside */
export function activateDeepWork(block) {
  state.set('deepWorkBlock', block);
  navigate('/deepwork');
}
