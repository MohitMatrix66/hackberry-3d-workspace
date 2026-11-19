/** Display helpers. */
export const mm = (v, digits = 1) => `${Number(v).toFixed(digits)} mm`;

export const size3 = (s) => `${s.map((v) => Number(v).toFixed(1)).join(' × ')} mm`;

export const grams = (g) => (g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`);

export const rupees = (v) => (v === null || v === undefined ? '-' : `₹${Math.round(v).toLocaleString('en-IN')}`);

export const hours = (h) => (h === null || h === undefined ? '-' : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
