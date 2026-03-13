/** THE GRID — Reactive State Manager */

const _state = {};
const _listeners = {};

export function get(key) {
  return _state[key];
}

export function set(key, value) {
  _state[key] = value;
  if (_listeners[key]) {
    _listeners[key].forEach(fn => fn(value));
  }
}

export function on(key, fn) {
  if (!_listeners[key]) _listeners[key] = [];
  _listeners[key].push(fn);
  return () => {
    _listeners[key] = _listeners[key].filter(f => f !== fn);
  };
}

export function update(key, updater) {
  set(key, updater(get(key)));
}
