/** Inline stroke icons (24x24, currentColor). */
const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  fit: icon('<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="3"/>'),
  explode: icon('<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3"/>'),
  xray: icon('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" stroke-dasharray="2.5 2"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  section: icon('<path d="M4 6l8-3 8 3-8 3z"/><path d="M4 6v12l8 3 8-3V6"/><path d="M2 13h20" stroke-dasharray="3 2"/>'),
  measure: icon('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  servo: icon('<rect x="3" y="8" width="13" height="10" rx="1.5"/><path d="M1 11h2M16 11h2"/><circle cx="12" cy="6" r="2.5"/><path d="M12 3.5V2"/>'),
  inside: icon('<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4V11"/><path d="M21 7v4" stroke-dasharray="2 2"/>'),
  palette: icon('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="16" cy="10" r="1.3"/><path d="M13 21a3 3 0 0 1 0-6h3"/>'),
  camera: icon('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  grid: icon('<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  play: icon('<path d="M7 4l13 8-13 8z"/>'),
  pause: icon('<path d="M7 4v16M17 4v16"/>'),
  eye: icon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: icon('<path d="M3 3l18 18"/><path d="M10.6 5.1A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1"/>'),
  download: icon('<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'),
  external: icon('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: icon('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
  focus: icon('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  isolate: icon('<rect x="8" y="8" width="8" height="8" rx="1"/><path d="M3 3h4M3 3v4M21 3h-4M21 3v4M3 21h4M3 21v-4M21 21h-4M21 21v-4"/>'),
  reset: icon('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>'),
  hand: icon('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3 13.5a1.5 1.5 0 0 1 2.4-1.8L8 15"/>'),
  wire: icon('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l16 9M20 7.5l-16 9M12 3v18"/>'),
  caret: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};
