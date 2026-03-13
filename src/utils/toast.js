/** THE GRID — Toast Utility */

let toastEl = null;
let toastTimer = null;

function ensureToast() {
  if (toastEl) return;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.body.appendChild(toastEl);
}

export function toast(message, duration = 2500) {
  ensureToast();
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('toast--visible');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('toast--visible');
  }, duration);
}
