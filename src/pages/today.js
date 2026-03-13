/** THE GRID — Today's Grid (Daily Progress Dashboard) */
import { getBlocksByDate, updateBlock, createBlock, getCheckInForBlock, createCheckIn } from '../db.js';
import { today, formatTime, endTime, formatDuration, secondsRemaining, formatSeconds, isBlockActive, isBlockPast, nowMinutes, timeToMinutes, CATEGORIES, PRIORITIES } from '../utils/time.js';
import { formatDate } from '../utils/date.js';
import { toast } from '../utils/toast.js';
import { trackCheckIn, trackBlockComplete, trackSkip } from '../analytics.js';
import { notify, scheduleNotification } from '../notify.js';
import { navigate } from '../router.js';

let timerInterval = null;
let checkInInterval = null;
let blocks = [];
let checkIns = {};

export function initToday(container) {
  render(container);
  return cleanup;
}

function cleanup() {
  clearInterval(timerInterval);
  clearInterval(checkInInterval);
  timerInterval = null;
  checkInInterval = null;
}

async function render(container) {
  const dateStr = today();
  try {
    blocks = await getBlocksByDate(dateStr);
  } catch (e) {
    console.error('[GRID] Failed to load blocks:', e);
    blocks = [];
  }

  // Load check-ins for each block
  checkIns = {};
  for (const block of blocks) {
    try {
      const ci = await getCheckInForBlock(block.id);
      if (ci) checkIns[block.id] = ci;
    } catch (e) { /* skip */ }
  }

  // Mark completed blocks
  for (const block of blocks) {
    if (checkIns[block.id]?.response === 'started' && isBlockPast(block) && block.status !== 'completed') {
      try {
        await updateBlock(block.id, { status: 'completed' });
        block.status = 'completed';
      } catch (e) { /* skip */ }
    }
  }

  drawPage(container, dateStr);
  startTimers(container, dateStr);
  scheduleBlockNotifications();
}

function drawPage(container, dateStr) {
  const completed = blocks.filter(b => b.status === 'completed').length;
  const skipped = blocks.filter(b => b.status === 'skipped').length;
  const total = blocks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const activeBlock = blocks.find(b => isBlockActive(b) && b.status !== 'skipped');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">TODAY'S GRID</div>
      <div class="page-header__sub">${formatDate(dateStr)}</div>
    </div>

    <!-- STATS -->
    <div class="stats">
      <div class="stat">
        <div class="stat__value ${pct >= 75 ? 'green' : pct >= 50 ? 'amber' : 'red'}">${pct}%</div>
        <div class="stat__label">COMPLETE</div>
      </div>
      <div class="stat">
        <div class="stat__value">${completed}/${total}</div>
        <div class="stat__label">BLOCKS DONE</div>
      </div>
      <div class="stat">
        <div class="stat__value red">${skipped}</div>
        <div class="stat__label">SKIPPED</div>
      </div>
    </div>

    <!-- PROGRESS BAR -->
    <div class="progress" style="margin-bottom: var(--g-sp-6);">
      <div class="progress__fill" style="width: ${pct}%;"></div>
    </div>

    <!-- CURRENT BLOCK -->
    ${activeBlock ? `
      <div class="today-current" id="current-block">
        <div class="today-current__label">▶ ACTIVE BLOCK</div>
        <div class="today-current__name">${activeBlock.name}</div>
        <div class="page-header__sub">${formatTime(activeBlock.start_time)} — ${endTime(activeBlock.start_time, activeBlock.duration_minutes)} · ${CATEGORIES[activeBlock.category]}</div>
        <div class="today-current__timer" id="active-timer">--:--</div>
      </div>
    ` : `
      <div class="today-current" style="border-color: var(--g-border);">
        <div class="today-current__label" style="color: var(--g-text-dim);">NO ACTIVE BLOCK</div>
        <div class="page-header__sub">${total === 0 ? 'No blocks scheduled. <a href="#/build" style="color: var(--g-green);">Build your grid →</a>' : 'Waiting for next block'}</div>
      </div>
    `}

    <!-- BLOCK LIST -->
    <div id="blocks-list">
      ${blocks.length === 0 ? `
        <div class="empty">
          <div class="empty__icon">⊞</div>
          <div class="empty__text">No blocks scheduled for today.</div>
          <a href="#/build" class="btn btn--green">BUILD YOUR GRID</a>
        </div>
      ` : blocks.map(b => renderBlockCard(b)).join('')}
    </div>
  `;

  // Bind quick-add
  container.querySelectorAll('[data-checkin]').forEach(btn => {
    btn.addEventListener('click', () => triggerCheckIn(btn.dataset.checkin, container, dateStr));
  });
}

function renderBlockCard(block) {
  const active = isBlockActive(block);
  const past = isBlockPast(block);
  const ci = checkIns[block.id];
  let statusClass = 'pending';
  let statusText = 'UPCOMING';

  if (block.status === 'completed' || (ci?.response === 'started' && past)) {
    statusClass = 'completed';
    statusText = 'DONE';
  } else if (block.status === 'skipped' || ci?.response === 'skipped') {
    statusClass = 'skipped';
    statusText = 'SKIPPED';
  } else if (ci?.response === 'delayed') {
    statusClass = 'delayed';
    statusText = 'DELAYED';
  } else if (ci?.response === 'started' || active) {
    statusClass = 'started';
    statusText = active ? 'ACTIVE' : 'STARTED';
  } else if (past && !ci) {
    statusClass = 'skipped';
    statusText = 'MISSED';
  }

  return `
    <div class="block-card block-card--${statusClass}">
      <div class="block-card__time">${formatTime(block.start_time)}</div>
      <div class="block-card__body">
        <div class="block-card__name">${block.name}</div>
        <div class="block-card__meta">
          <span>${CATEGORIES[block.category]}</span>
          <span>${formatDuration(block.duration_minutes)}</span>
          <span class="priority priority--${block.priority}">${PRIORITIES[block.priority]}</span>
        </div>
        ${ci?.skip_reason ? `<div class="block-card__meta red" style="margin-top:4px;">↳ "${ci.skip_reason}"</div>` : ''}
      </div>
      <div class="block-card__actions">
        <span class="block-card__btn" style="color: var(--g-${statusClass === 'completed' ? 'green' : statusClass === 'skipped' ? 'red' : statusClass === 'started' ? 'blue' : 'text-mute'});">${statusText}</span>
      </div>
    </div>
  `;
}

function startTimers(container, dateStr) {
  // Update active timer every second
  timerInterval = setInterval(() => {
    const activeBlock = blocks.find(b => isBlockActive(b) && b.status !== 'skipped');
    const timerEl = document.getElementById('active-timer');
    if (activeBlock && timerEl) {
      const remaining = secondsRemaining(activeBlock.start_time, activeBlock.duration_minutes);
      timerEl.textContent = formatSeconds(remaining);
      if (remaining <= 0) {
        // Block finished
        drawPage(container, dateStr);
      }
    }
  }, 1000);

  // Check-in polling: every 10 seconds, check if any block needs a check-in
  checkInInterval = setInterval(() => {
    const nowM = nowMinutes();
    for (const block of blocks) {
      const startM = timeToMinutes(block.start_time);
      if (nowM >= startM && nowM < startM + 5 && !checkIns[block.id] && block.status === 'pending') {
        showCheckIn(block, container, dateStr);
        break;
      }
      // Auto-skip after 5 min
      if (nowM >= startM + 5 && !checkIns[block.id] && block.status === 'pending') {
        autoSkip(block, container, dateStr);
        break;
      }
    }
  }, 10000);
}

function showCheckIn(block, container, dateStr) {
  const overlay = document.getElementById('checkin-overlay');
  if (!overlay || overlay.classList.contains('checkin-overlay--active')) return;

  let autoSkipTimer = null;
  const startTime = Date.now();

  overlay.innerHTML = `
    <div class="checkin__label">BLOCK CHECK-IN</div>
    <div class="checkin__block-name">${block.name}</div>
    <div class="checkin__time">${formatTime(block.start_time)} — ${endTime(block.start_time, block.duration_minutes)} · ${CATEGORIES[block.category]}</div>
    <div class="checkin__actions">
      <button class="btn btn--green btn--full btn--lg" id="ci-start">▶ STARTED</button>
      <button class="btn btn--amber btn--full btn--lg" id="ci-delay">⏳ DELAY (15 MIN)</button>
      <button class="btn btn--red btn--full btn--lg" id="ci-skip">✕ SKIP</button>
    </div>
    <div class="checkin__skip-reason" id="skip-reason-wrap" style="display:none;">
      <input class="input" id="skip-reason-input" type="text" placeholder="Reason for skipping (required)" />
      <button class="btn btn--red btn--full" id="ci-skip-confirm" style="margin-top: var(--g-sp-2);">CONFIRM SKIP</button>
    </div>
    <div class="checkin__countdown" id="ci-countdown">Auto-skip in 5:00</div>
  `;
  overlay.classList.add('checkin-overlay--active');

  // Auto-skip countdown
  autoSkipTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 300 - elapsed;
    if (remaining <= 0) {
      clearInterval(autoSkipTimer);
      respondCheckIn(block, 'skipped', 'Auto-skipped: no response', true, overlay, container, dateStr);
    } else {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const el = document.getElementById('ci-countdown');
      if (el) el.textContent = `Auto-skip in ${m}:${String(s).padStart(2, '0')}`;
    }
  }, 1000);

  // Handlers
  document.getElementById('ci-start').addEventListener('click', () => {
    clearInterval(autoSkipTimer);
    respondCheckIn(block, 'started', null, false, overlay, container, dateStr);
  });

  document.getElementById('ci-delay').addEventListener('click', () => {
    clearInterval(autoSkipTimer);
    const delayUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    respondCheckIn(block, 'delayed', null, false, overlay, container, dateStr, delayUntil);
  });

  document.getElementById('ci-skip').addEventListener('click', () => {
    document.getElementById('skip-reason-wrap').style.display = 'block';
    document.getElementById('skip-reason-input').focus();
  });

  document.getElementById('ci-skip-confirm').addEventListener('click', () => {
    const reason = document.getElementById('skip-reason-input').value.trim();
    if (!reason) {
      toast('Reason required.');
      return;
    }
    clearInterval(autoSkipTimer);
    respondCheckIn(block, 'skipped', reason, false, overlay, container, dateStr);
  });
}

async function respondCheckIn(block, response, reason, autoSkipped, overlay, container, dateStr, delayUntil) {
  try {
    const ci = await createCheckIn({
      block_id: block.id,
      response,
      skip_reason: reason || null,
      auto_skipped: autoSkipped,
      delay_until: delayUntil || null,
    });
    checkIns[block.id] = ci;

    // Update block status
    let newStatus = response === 'started' ? 'started' : response === 'skipped' ? 'skipped' : 'delayed';
    await updateBlock(block.id, { status: newStatus });
    block.status = newStatus;

    // Track
    trackCheckIn(response, block.category);
    if (response === 'started') trackBlockComplete(block.category);
    if (response === 'skipped') trackSkip(reason, block.category);

    // Deep Work auto-activate
    if (response === 'started' && block.category === 'deep_work') {
      navigate('/deepwork');
    }
  } catch (e) {
    console.error('[GRID] Check-in failed:', e);
    toast('Check-in failed. Try again.');
  }

  overlay.classList.remove('checkin-overlay--active');
  drawPage(container, dateStr);
}

async function autoSkip(block, container, dateStr) {
  try {
    await createCheckIn({
      block_id: block.id,
      response: 'skipped',
      skip_reason: 'Auto-skipped: no response',
      auto_skipped: true,
    });
    await updateBlock(block.id, { status: 'skipped' });
    block.status = 'skipped';
    checkIns[block.id] = { response: 'skipped', skip_reason: 'Auto-skipped: no response', auto_skipped: true };
    trackSkip('Auto-skipped: no response', block.category);
    notify('BLOCK SKIPPED', `"${block.name}" was auto-skipped. No response received.`, `skip-${block.id}`);
    drawPage(container, dateStr);
  } catch (e) {
    console.error('[GRID] Auto-skip failed:', e);
  }
}

function triggerCheckIn(blockId, container, dateStr) {
  const block = blocks.find(b => b.id === blockId);
  if (block) showCheckIn(block, container, dateStr);
}

function scheduleBlockNotifications() {
  const nowM = nowMinutes();
  for (const block of blocks) {
    if (checkIns[block.id]) continue;
    const startM = timeToMinutes(block.start_time);
    const prepM = startM - 5;
    // 5-min prep alert
    if (prepM > nowM) {
      const delayMs = (prepM - nowM) * 60 * 1000;
      scheduleNotification(`prep-${block.id}`, delayMs, 'PREPARE', `"${block.name}" starts in 5 minutes.`);
    }
    // Start alert
    if (startM > nowM) {
      const delayMs = (startM - nowM) * 60 * 1000;
      scheduleNotification(`start-${block.id}`, delayMs, 'BLOCK STARTED', `"${block.name}" — Check in now.`);
    }
  }
}
