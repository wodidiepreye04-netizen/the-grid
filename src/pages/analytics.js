/** THE GRID — Weekly Analytics */
import Chart from 'chart.js/auto';
import { getReportsRange } from '../db.js';
import { pastDays, dayName, formatDate } from '../utils/date.js';
import { today } from '../utils/time.js';
import { trackStreak } from '../analytics.js';

let chartInstance = null;

export function initAnalyticsPage(container) {
  render(container);
  return cleanup;
}

function cleanup() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

async function render(container) {
  const days = pastDays(7);
  let reports = [];

  try {
    reports = await getReportsRange(days[0], days[6]);
  } catch (e) {
    console.error('[GRID] Failed to load reports:', e);
  }

  // Map reports by date
  const byDate = {};
  reports.forEach(r => { byDate[r.report_date] = r; });

  // Calculate stats
  const scores = days.map(d => byDate[d]?.completion_score || 0);
  const labels = days.map(d => dayName(d));
  const totalDeepWork = reports.reduce((sum, r) => sum + (r.deep_work_integrity || 0), 0);
  const bestDay = days.reduce((best, d) => (byDate[d]?.completion_score || 0) > (byDate[best]?.completion_score || 0) ? d : best, days[0]);

  // Streak
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if ((byDate[days[i]]?.completion_score || 0) >= 75) streak++;
    else break;
  }
  if (streak > 0) trackStreak(streak);

  // Most skipped categories
  const skipByCat = {};
  reports.forEach(r => {
    if (!r.report_json) return;
    const parsed = typeof r.report_json === 'string' ? JSON.parse(r.report_json) : r.report_json;
    parsed.forEach(b => {
      if (b.status === 'skipped') {
        skipByCat[b.category] = (skipByCat[b.category] || 0) + 1;
      }
    });
  });
  const topSkipped = Object.entries(skipByCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const categoryNames = {
    prayer: 'Prayer', bible_study: 'Bible Study', reading: 'Reading',
    writing: 'Writing', exercise: 'Exercise', deep_work: 'Deep Work',
    admin: 'Admin', meals: 'Meals', rest: 'Rest', other: 'Other',
  };

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">WEEKLY DATA</div>
      <div class="page-header__sub">${formatDate(days[0])} — ${formatDate(days[6])}</div>
    </div>

    <!-- STATS -->
    <div class="stats">
      <div class="stat">
        <div class="stat__value ${streak >= 5 ? 'green' : streak >= 3 ? 'amber' : 'red'}">${streak}</div>
        <div class="stat__label">DAY STREAK</div>
      </div>
      <div class="stat">
        <div class="stat__value green">${dayName(bestDay)}</div>
        <div class="stat__label">BEST DAY</div>
      </div>
      <div class="stat">
        <div class="stat__value blue">${Math.round(totalDeepWork / 60)}h</div>
        <div class="stat__label">DEEP WORK</div>
      </div>
    </div>

    <!-- CHART -->
    <div class="chart-container">
      <canvas id="weekly-chart"></canvas>
    </div>

    <!-- MOST SKIPPED -->
    <h3 style="margin-bottom: var(--g-sp-3);">MOST SKIPPED CATEGORIES</h3>
    ${topSkipped.length > 0 ? `
      <div style="margin-bottom: var(--g-sp-6);">
        ${topSkipped.map(([cat, count]) => `
          <div class="report-block">
            <span class="red" style="min-width:24px; font-weight:700;">${count}×</span>
            <span>${categoryNames[cat] || cat}</span>
          </div>
        `).join('')}
      </div>
    ` : `
      <div class="dim" style="margin-bottom: var(--g-sp-6); font-size: var(--g-fs-sm);">No data yet.</div>
    `}

    <!-- DAILY BREAKDOWN -->
    <h3 style="margin-bottom: var(--g-sp-3);">DAILY SCORES</h3>
    <div>
      ${days.map(d => {
        const r = byDate[d];
        const score = r?.completion_score || 0;
        const color = score >= 75 ? 'green' : score >= 50 ? 'amber' : score > 0 ? 'red' : 'dim';
        return `
          <div class="report-block">
            <span class="dim" style="min-width:45px;">${dayName(d)}</span>
            <span style="flex:1;">${formatDate(d)}</span>
            <span class="${color}" style="font-weight:700;">${score > 0 ? score + '%' : '—'}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Render chart
  renderChart(labels, scores);
}

function renderChart(labels, scores) {
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Completion %',
        data: scores,
        backgroundColor: scores.map(s =>
          s >= 75 ? '#00ff4133' : s >= 50 ? '#ffaa0033' : '#ff333333'
        ),
        borderColor: scores.map(s =>
          s >= 75 ? '#00ff41' : s >= 50 ? '#ffaa00' : '#ff3333'
        ),
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#666', font: { family: "'JetBrains Mono'" } },
          grid: { color: '#1e1e1e' },
        },
        x: {
          ticks: { color: '#666', font: { family: "'JetBrains Mono'" } },
          grid: { display: false },
        },
      },
    },
  });
}
