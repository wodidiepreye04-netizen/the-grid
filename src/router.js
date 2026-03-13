/** THE GRID — Hash Router */
import { trackPage } from './analytics.js';

const routes = {};
let currentCleanup = null;

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = '#' + path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/today';
}

function resolve() {
  const path = getCurrentRoute();
  const handler = routes[path];
  const content = document.getElementById('page-content');
  if (!content) return;

  // Cleanup previous page
  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  if (handler) {
    content.innerHTML = '';
    currentCleanup = handler(content);
    trackPage(path);
  } else {
    // Default to /today
    navigate('/today');
  }

  // Update nav active state
  document.querySelectorAll('.nav__link').forEach(link => {
    const href = link.getAttribute('data-route');
    link.classList.toggle('nav__link--active', href === path);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', resolve);
  // Initial resolve
  if (!window.location.hash) {
    window.location.hash = '#/today';
  } else {
    resolve();
  }
}
