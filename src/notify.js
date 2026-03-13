/** THE GRID — Notification System */

let permission = 'default';

export async function requestPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') {
    permission = 'granted';
    return permission;
  }
  permission = await Notification.requestPermission();
  return permission;
}

export function notify(title, body, tag) {
  if (permission !== 'granted') return null;
  try {
    const n = new Notification(title, {
      body,
      tag: tag || 'grid-' + Date.now(),
      icon: '/grid-icon.svg',
      badge: '/grid-icon.svg',
      requireInteraction: true,
    });
    return n;
  } catch (e) {
    console.warn('[GRID] Notification failed:', e);
    return null;
  }
}

// Scheduled notification timers
const _timers = new Map();

export function scheduleNotification(id, delayMs, title, body) {
  cancelNotification(id);
  const timer = setTimeout(() => {
    notify(title, body, id);
    _timers.delete(id);
  }, delayMs);
  _timers.set(id, timer);
}

export function cancelNotification(id) {
  if (_timers.has(id)) {
    clearTimeout(_timers.get(id));
    _timers.delete(id);
  }
}

export function cancelAllNotifications() {
  _timers.forEach(timer => clearTimeout(timer));
  _timers.clear();
}
