/** THE GRID — Settings */
import { toast } from '../utils/toast.js';
import { supabase } from '../db.js';

export function initSettings(container) {
  // Load settings from localStorage
  const settings = loadSettings();
  drawPage(container, settings);
  return null;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('grid_settings');
    return raw ? JSON.parse(raw) : getDefaults();
  } catch {
    return getDefaults();
  }
}

function saveSettings(settings) {
  localStorage.setItem('grid_settings', JSON.stringify(settings));
}

function getDefaults() {
  return {
    notifications_enabled: true,
    prep_alert: true,
    start_alert: true,
    escalation_alert: true,
    eod_alert: true,
    strict_mode: false,
    rest_day: false,
  };
}

function drawPage(container, settings) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">SYSTEM CONFIG</div>
      <div class="page-header__sub">Notification preferences and data management</div>
    </div>

    <!-- NOTIFICATIONS -->
    <h3 style="margin-bottom: var(--g-sp-3);">NOTIFICATIONS</h3>
    <div style="margin-bottom: var(--g-sp-6);">
      ${settingToggle('notifications_enabled', 'Master Notifications', 'Enable/disable all browser notifications', settings)}
      ${settingToggle('prep_alert', '5-Min Prep Alert', 'Alert 5 minutes before each block', settings)}
      ${settingToggle('start_alert', 'Block Start Alert', 'Check-in prompt at block start time', settings)}
      ${settingToggle('escalation_alert', 'Escalation Alert', 'Warning when check-in goes unanswered', settings)}
      ${settingToggle('eod_alert', 'End-of-Day Alert', 'Report generation notification', settings)}
    </div>

    <!-- DISCIPLINE -->
    <h3 style="margin-bottom: var(--g-sp-3);">DISCIPLINE</h3>
    <div style="margin-bottom: var(--g-sp-6);">
      ${settingToggle('strict_mode', 'Strict Mode', 'Removes the Delay option from check-ins. Started or Skipped only.', settings)}
      ${settingToggle('rest_day', 'Rest Day', 'Disable today\'s schedule and scoring. No blocks, no judgment.', settings)}
    </div>

    <!-- DATA MANAGEMENT -->
    <h3 style="margin-bottom: var(--g-sp-3);">DATA</h3>
    <div style="margin-bottom: var(--g-sp-6);">
      <div class="setting-row">
        <div>
          <div class="setting-row__label">Export All Data</div>
          <div class="setting-row__desc">Download all stored data as JSON</div>
        </div>
        <button class="btn" id="btn-export">EXPORT</button>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-row__label red">Clear All Data</div>
          <div class="setting-row__desc">Permanently delete all blocks, reports, and settings</div>
        </div>
        <button class="btn btn--red" id="btn-clear">CLEAR</button>
      </div>
    </div>

    <!-- SYSTEM INFO -->
    <div style="margin-top: var(--g-sp-8); padding-top: var(--g-sp-4); border-top: 1px solid var(--g-border);">
      <div class="dim" style="font-size: var(--g-fs-xs);">
        THE GRID v1.0<br/>
        Because discipline without enforcement is just intention.<br/>
        Built by Wodi Diepreye
      </div>
    </div>
  `;

  // Bind toggles
  container.querySelectorAll('[data-toggle]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const key = toggle.dataset.toggle;
      settings[key] = !settings[key];
      toggle.classList.toggle('toggle--active', settings[key]);
      saveSettings(settings);
      toast(`${key.replace(/_/g, ' ')} ${settings[key] ? 'ON' : 'OFF'}`);
    });
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', async () => {
    try {
      const [blocks, reports, templates] = await Promise.all([
        supabase.from('daily_blocks').select('*').then(r => r.data),
        supabase.from('daily_reports').select('*').then(r => r.data),
        supabase.from('block_templates').select('*').then(r => r.data),
      ]);
      const data = { blocks, reports, templates, settings, exported_at: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TheGrid_Export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Data exported.');
    } catch (e) {
      console.error('[GRID] Export failed:', e);
      toast('Export failed.');
    }
  });

  // Clear
  document.getElementById('btn-clear').addEventListener('click', async () => {
    if (!confirm('DELETE ALL DATA? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure?')) return;
    try {
      await supabase.from('check_ins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('deep_work_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('daily_blocks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('daily_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('block_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      localStorage.removeItem('grid_settings');
      toast('All data cleared.');
      drawPage(container, getDefaults());
    } catch (e) {
      console.error('[GRID] Clear failed:', e);
      toast('Clear failed.');
    }
  });
}

function settingToggle(key, label, desc, settings) {
  const active = settings[key] ? 'toggle--active' : '';
  return `
    <div class="setting-row">
      <div>
        <div class="setting-row__label">${label}</div>
        <div class="setting-row__desc">${desc}</div>
      </div>
      <div class="toggle ${active}" data-toggle="${key}">
        <div class="toggle__knob"></div>
      </div>
    </div>
  `;
}

/** Get a setting value (for use by other modules) */
export function getSetting(key) {
  const settings = loadSettings();
  return settings[key];
}
