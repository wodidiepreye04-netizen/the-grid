/** THE GRID — Entry Point */
import './css/reset.css';
import './css/tokens.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';
import './css/pages.css';

import { route, initRouter } from './router.js';
import { initAnalytics } from './analytics.js';
import { requestPermission } from './notify.js';
import { initToday } from './pages/today.js';
import { initBuild } from './pages/build.js';
import { initReport } from './pages/report.js';
import { initAnalyticsPage } from './pages/analytics.js';
import { initSettings } from './pages/settings.js';

// ── BOOT ─────────────────────────────────────────────────
function boot() {
  // Analytics
  initAnalytics();

  // Notifications
  requestPermission();

  // Routes
  route('/today', initToday);
  route('/build', initBuild);
  route('/report', initReport);
  route('/analytics', initAnalyticsPage);
  route('/settings', initSettings);

  // Start router
  initRouter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
