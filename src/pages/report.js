/** THE GRID — End-of-Day Report */
import { getBlocksByDate, getCheckInsByDate, getReport, saveReport } from '../db.js';
import { today, formatTime, endTime, formatDuration, CATEGORIES, PRIORITIES } from '../utils/time.js';
import { formatDate } from '../utils/date.js';
import { generateVerdict, generateRecommendation } from '../utils/verdict.js';
import { downloadPDF } from '../utils/pdf.js';
import { trackDayComplete, trackPdfDownload } from '../analytics.js';
import { toast } from '../utils/toast.js';

export function initReport(container) {
  render(container);
  return null;
}

async function render(container) {
  const dateStr = today();
  let blocks = [];
  let checkIns = [];
  let report = null;

  try {
    blocks = await getBlocksByDate(dateStr);
    checkIns = await getCheckInsByDate(dateStr);
    report = await getReport(dateStr);
  } catch (e) {
    console.error('[GRID] Failed to load report data:', e);
  }

  // Generate report if it doesn't exist yet
  if (!report && blocks.length > 0) {
    report = await generateReport(dateStr, blocks, checkIns);
  }

  drawPage(container, dateStr, blocks, checkIns, report);
}

async function generateReport(dateStr, blocks, checkIns) {
  const total = blocks.length;
  const completed = blocks.filter(b => b.status === 'completed' || b.status === 'started').length;
  const skipped = blocks.filter(b => b.status === 'skipped').length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const verdict = generateVerdict(pct, skipped, total);
  const recommendation = generateRecommendation(blocks, checkIns);

  // Build block-by-block JSON
  const reportJson = blocks.map(b => {
    const ci = checkIns.find(c => c.block_id === b.id);
    return {
      name: b.name,
      category: b.category,
      start_time: b.start_time,
      duration_minutes: b.duration_minutes,
      status: b.status,
      response: ci?.response || null,
      skip_reason: ci?.skip_reason || null,
      auto_skipped: ci?.auto_skipped || false,
    };
  });

  const reportData = {
    report_date: dateStr,
    total_blocks: total,
    completed_blocks: completed,
    skipped_blocks: skipped,
    completion_score: pct,
    deep_work_integrity: null, // TODO: pull from deep_work_sessions
    verdict,
    recommendation,
    report_json: reportJson,
  };

  try {
    const saved = await saveReport(reportData);
    trackDayComplete(pct, total, completed);
    return saved;
  } catch (e) {
    console.error('[GRID] Save report failed:', e);
    return reportData;
  }
}

function drawPage(container, dateStr, blocks, checkIns, report) {
  if (!report) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header__title">DAILY REPORT</div>
        <div class="page-header__sub">${formatDate(dateStr)}</div>
      </div>
      <div class="empty">
        <div class="empty__icon">◈</div>
        <div class="empty__text">No blocks scheduled today. Build your grid first.</div>
        <a href="#/build" class="btn btn--green">BUILD YOUR GRID</a>
      </div>
    `;
    return;
  }

  const scoreColor = report.completion_score >= 75 ? 'green' : report.completion_score >= 50 ? 'amber' : 'red';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">DAILY REPORT</div>
      <div class="page-header__sub">${formatDate(dateStr)}</div>
    </div>

    <!-- SCORES -->
    <div class="stats">
      <div class="stat">
        <div class="stat__value ${scoreColor}">${report.completion_score}%</div>
        <div class="stat__label">COMPLETION</div>
      </div>
      <div class="stat">
        <div class="stat__value">${report.completed_blocks}/${report.total_blocks}</div>
        <div class="stat__label">COMPLETED</div>
      </div>
      <div class="stat">
        <div class="stat__value red">${report.skipped_blocks}</div>
        <div class="stat__label">SKIPPED</div>
      </div>
      ${report.deep_work_integrity != null ? `
        <div class="stat">
          <div class="stat__value blue">${report.deep_work_integrity}%</div>
          <div class="stat__label">DW INTEGRITY</div>
        </div>
      ` : ''}
    </div>

    <!-- BLOCK-BY-BLOCK -->
    <h3 style="margin-bottom: var(--g-sp-3);">BLOCK BREAKDOWN</h3>
    <div style="margin-bottom: var(--g-sp-6);">
      ${blocks.map(b => {
        const ci = checkIns.find(c => c.block_id === b.id);
        const status = b.status || 'pending';
        const statusColor = status === 'completed' || status === 'started' ? 'green' : status === 'skipped' ? 'red' : status === 'delayed' ? 'amber' : 'dim';
        return `
          <div class="report-block">
            <span class="dim" style="min-width:45px;">${formatTime(b.start_time)}</span>
            <span style="flex:1;">${b.name}</span>
            <span class="report-block__status ${statusColor}">${status.toUpperCase()}</span>
            ${ci?.skip_reason ? `<span class="dim" style="font-size:var(--g-fs-xs);">↳ ${ci.skip_reason}</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <!-- VERDICT -->
    <div class="report-verdict">
      <div class="report-verdict__title">PERFORMANCE VERDICT</div>
      <div class="report-verdict__text">${report.verdict}</div>
    </div>

    ${report.recommendation ? `
      <div class="report-verdict" style="margin-top: var(--g-sp-3); border-color: var(--g-amber-dim);">
        <div class="report-verdict__title" style="color: var(--g-amber);">RECOMMENDATION</div>
        <div class="report-verdict__text">${report.recommendation}</div>
      </div>
    ` : ''}

    <!-- DOWNLOAD -->
    <div style="margin-top: var(--g-sp-6);">
      <button class="btn btn--green btn--lg btn--full" id="btn-download-pdf">↓ DOWNLOAD PDF REPORT</button>
    </div>

    <!-- REGENERATE -->
    <div style="margin-top: var(--g-sp-3);">
      <button class="btn btn--full" id="btn-regen-report">⟳ REGENERATE REPORT</button>
    </div>
  `;

  // Bind PDF download
  document.getElementById('btn-download-pdf').addEventListener('click', () => {
    downloadPDF(report, blocks, checkIns);
    trackPdfDownload(dateStr);
    toast('PDF downloaded.');
  });

  // Bind regenerate
  document.getElementById('btn-regen-report').addEventListener('click', async () => {
    try {
      await generateReport(dateStr, blocks, checkIns);
      toast('Report regenerated.');
      render(container);
    } catch (e) {
      toast('Regeneration failed.');
    }
  });
}
