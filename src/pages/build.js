/** THE GRID — Timetable Builder */
import Sortable from 'sortablejs';
import { getBlocksByDate, createBlock, updateBlock, deleteBlock, updateBlockOrders, getTemplates, replaceTemplates } from '../db.js';
import { today, formatTime, endTime, formatDuration, findOverlaps, CATEGORIES, CATEGORY_KEYS, PRIORITIES } from '../utils/time.js';
import { formatDate } from '../utils/date.js';
import { toast } from '../utils/toast.js';
import { trackBlockCreate } from '../analytics.js';

let blocks = [];
let editingId = null;
let sortableInstance = null;

export function initBuild(container) {
  render(container);
  return cleanup;
}

function cleanup() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  editingId = null;
}

async function render(container) {
  const dateStr = today();
  try {
    blocks = await getBlocksByDate(dateStr);
  } catch (e) {
    console.error('[GRID] Failed to load blocks:', e);
    blocks = [];
  }

  drawPage(container, dateStr);
}

function drawPage(container, dateStr) {
  const categoryOptions = CATEGORY_KEYS.map(k =>
    `<option value="${k}">${CATEGORIES[k]}</option>`
  ).join('');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">BUILD YOUR GRID</div>
      <div class="page-header__sub">${formatDate(dateStr)}</div>
    </div>

    <!-- FORM -->
    <div class="card" style="margin-bottom: var(--g-sp-6);" id="block-form-card">
      <h3 style="margin-bottom: var(--g-sp-4); color: var(--g-green);">${editingId ? '✎ EDIT BLOCK' : '+ NEW BLOCK'}</h3>
      <form id="block-form">
        <div class="form-group">
          <label class="label" for="bf-name">BLOCK NAME</label>
          <input class="input" id="bf-name" type="text" placeholder="e.g. Morning Copywriting" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label" for="bf-start">START TIME</label>
            <input class="input" id="bf-start" type="time" required />
          </div>
          <div class="form-group">
            <label class="label" for="bf-duration">DURATION (MIN)</label>
            <input class="input" id="bf-duration" type="number" min="5" max="480" step="5" placeholder="60" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label" for="bf-category">CATEGORY</label>
            <select class="select" id="bf-category">${categoryOptions}</select>
          </div>
          <div class="form-group">
            <label class="label" for="bf-priority">PRIORITY</label>
            <select class="select" id="bf-priority">
              <option value="critical">🔴 Critical</option>
              <option value="important">🟡 Important</option>
              <option value="routine" selected>⚪ Routine</option>
            </select>
          </div>
        </div>
        <div style="display:flex; gap: var(--g-sp-2);">
          <button class="btn btn--green btn--lg" type="submit" id="bf-submit">${editingId ? 'UPDATE BLOCK' : 'ADD BLOCK'}</button>
          ${editingId ? '<button class="btn btn--lg" type="button" id="bf-cancel">CANCEL</button>' : ''}
        </div>
        <div id="bf-error" class="red" style="margin-top: var(--g-sp-2); font-size: var(--g-fs-xs); display:none;"></div>
      </form>
    </div>

    <!-- ACTIONS -->
    <div class="build-actions">
      <h3>${blocks.length} BLOCK${blocks.length !== 1 ? 'S' : ''} SCHEDULED</h3>
      <div style="display:flex; gap: var(--g-sp-2);">
        <button class="btn" id="btn-save-template">SAVE AS TEMPLATE</button>
        <button class="btn" id="btn-load-template">LOAD TEMPLATE</button>
      </div>
    </div>

    <!-- BLOCKS LIST -->
    <div id="blocks-list">
      ${blocks.length === 0 ? `
        <div class="empty">
          <div class="empty__icon">⊞</div>
          <div class="empty__text">No blocks yet. Add your first block above.</div>
        </div>
      ` : blocks.map(b => renderBuildCard(b)).join('')}
    </div>
  `;

  bindForm(container, dateStr);
  bindActions(container, dateStr);
  initSortable(container, dateStr);
}

function renderBuildCard(block) {
  return `
    <div class="block-card block-card--pending" data-id="${block.id}">
      <div class="block-card__time">${formatTime(block.start_time)}</div>
      <div class="block-card__body">
        <div class="block-card__name">${block.name}</div>
        <div class="block-card__meta">
          <span>${CATEGORIES[block.category]}</span>
          <span>${formatTime(block.start_time)} — ${endTime(block.start_time, block.duration_minutes)}</span>
          <span>${formatDuration(block.duration_minutes)}</span>
          <span class="priority priority--${block.priority}">${PRIORITIES[block.priority]}</span>
        </div>
      </div>
      <div class="block-card__actions">
        <button class="block-card__btn" data-edit="${block.id}">✎</button>
        <button class="block-card__btn block-card__btn--delete" data-delete="${block.id}">✕</button>
      </div>
    </div>
  `;
}

function bindForm(container, dateStr) {
  const form = document.getElementById('block-form');
  const errorEl = document.getElementById('bf-error');

  // If editing, populate form
  if (editingId) {
    const block = blocks.find(b => b.id === editingId);
    if (block) {
      document.getElementById('bf-name').value = block.name;
      document.getElementById('bf-start').value = block.start_time.slice(0, 5);
      document.getElementById('bf-duration').value = block.duration_minutes;
      document.getElementById('bf-category').value = block.category;
      document.getElementById('bf-priority').value = block.priority;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const name = document.getElementById('bf-name').value.trim();
    const start_time = document.getElementById('bf-start').value;
    const duration_minutes = parseInt(document.getElementById('bf-duration').value);
    const category = document.getElementById('bf-category').value;
    const priority = document.getElementById('bf-priority').value;

    if (!name || !start_time || !duration_minutes) {
      errorEl.textContent = 'All fields required.';
      errorEl.style.display = 'block';
      return;
    }

    const newBlock = { start_time, duration_minutes, name, category, priority };

    // Overlap check
    const overlaps = findOverlaps(newBlock, blocks, editingId);
    if (overlaps.length > 0) {
      errorEl.textContent = `CONFLICT: Overlaps with "${overlaps[0].name}" (${formatTime(overlaps[0].start_time)} — ${endTime(overlaps[0].start_time, overlaps[0].duration_minutes)})`;
      errorEl.style.display = 'block';
      return;
    }

    try {
      if (editingId) {
        await updateBlock(editingId, newBlock);
        toast('Block updated.');
        editingId = null;
      } else {
        await createBlock({
          ...newBlock,
          block_date: dateStr,
          sort_order: blocks.length,
          status: 'pending',
        });
        toast('Block added.');
        trackBlockCreate(newBlock);
      }
      await render(container);
    } catch (e) {
      console.error('[GRID] Save block failed:', e);
      errorEl.textContent = 'Failed to save. Try again.';
      errorEl.style.display = 'block';
    }
  });

  // Cancel edit
  const cancelBtn = document.getElementById('bf-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      editingId = null;
      drawPage(container, dateStr);
    });
  }
}

function bindActions(container, dateStr) {
  // Edit buttons
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = btn.dataset.edit;
      drawPage(container, dateStr);
      document.getElementById('block-form-card').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Delete buttons
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delete;
      const block = blocks.find(b => b.id === id);
      if (!confirm(`Delete "${block?.name}"?`)) return;
      try {
        await deleteBlock(id);
        toast('Block deleted.');
        await render(container);
      } catch (e) {
        console.error('[GRID] Delete failed:', e);
        toast('Delete failed.');
      }
    });
  });

  // Save as template
  document.getElementById('btn-save-template').addEventListener('click', async () => {
    if (blocks.length === 0) {
      toast('No blocks to save.');
      return;
    }
    try {
      const templates = blocks.map((b, i) => ({
        name: b.name,
        start_time: b.start_time,
        duration_minutes: b.duration_minutes,
        category: b.category,
        priority: b.priority,
        sort_order: i,
      }));
      await replaceTemplates(templates);
      toast('Template saved.');
    } catch (e) {
      console.error('[GRID] Save template failed:', e);
      toast('Save failed.');
    }
  });

  // Load template
  document.getElementById('btn-load-template').addEventListener('click', async () => {
    try {
      const templates = await getTemplates();
      if (templates.length === 0) {
        toast('No template saved.');
        return;
      }
      if (blocks.length > 0 && !confirm('Replace current blocks with template?')) return;
      // Delete existing blocks
      for (const b of blocks) {
        await deleteBlock(b.id);
      }
      // Create blocks from template
      for (const t of templates) {
        await createBlock({
          name: t.name,
          start_time: t.start_time,
          duration_minutes: t.duration_minutes,
          category: t.category,
          priority: t.priority,
          sort_order: t.sort_order,
          block_date: dateStr,
          status: 'pending',
        });
      }
      toast('Template loaded.');
      await render(container);
    } catch (e) {
      console.error('[GRID] Load template failed:', e);
      toast('Load failed.');
    }
  });
}

function initSortable(container, dateStr) {
  const list = document.getElementById('blocks-list');
  if (!list || blocks.length === 0) return;

  sortableInstance = Sortable.create(list, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    handle: '.block-card',
    onEnd: async (evt) => {
      // Reorder blocks array
      const movedBlock = blocks.splice(evt.oldIndex, 1)[0];
      blocks.splice(evt.newIndex, 0, movedBlock);
      try {
        await updateBlockOrders(blocks);
      } catch (e) {
        console.error('[GRID] Reorder failed:', e);
      }
    },
  });
}
