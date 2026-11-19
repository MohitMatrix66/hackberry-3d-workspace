/** Small notifications in the bottom-right corner. */
export function toast(message, ms = 2600) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), ms);
}
