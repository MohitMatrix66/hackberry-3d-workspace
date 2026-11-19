/** Build RFC 4180 CSV text from rows of plain values. */
export function toCSV(header, rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Trigger a browser download of text or a data URL. */
export function download(filename, content, type = 'text/csv') {
  const url = content.startsWith?.('data:') ? content : URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  if (!content.startsWith?.('data:')) setTimeout(() => URL.revokeObjectURL(url), 1000);
}
