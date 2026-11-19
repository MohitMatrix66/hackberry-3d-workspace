/**
 * Filament, cost and time estimates for 3D-printed parts.
 *
 * mass = density x (shell + infill), where
 *   shell  = min(volume, surface area x wall thickness)
 *   infill = (volume - shell) x infill fraction
 * It is an estimate (slicers differ), but good enough to plan filament and budget.
 */

export const MATERIALS = {
  'PLA+': { density: 1.24, pricePerKg: 850, gramsPerHour: 14, note: 'First test print' },
  PETG: { density: 1.27, pricePerKg: 1000, gramsPerHour: 12, note: 'Final hand on your own printer' },
  'PA12 nylon (SLS service)': { density: 1.01, pricePerKg: 0, gramsPerHour: 0, note: 'Order from a printing service' },
  'TPU 95A': { density: 1.21, pricePerKg: 1800, gramsPerHour: 6, note: 'Grip pads only' },
};

/**
 * @param {{volume_cm3:number, area_cm2:number}} stats  mesh statistics of the part
 * @param {{wall_mm:number, infill_fraction:number}} profile  print profile
 * @param {number} density  g/cm3
 * @param {number} [waste=1.08] extra for brim, supports and purge
 */
export function partGrams(stats, profile, density, waste = 1.08) {
  const volume = Math.max(0, stats.volume_cm3);
  const shell = Math.min(volume, stats.area_cm2 * (profile.wall_mm / 10));
  const infill = Math.max(0, volume - shell) * profile.infill_fraction;
  return (shell + infill) * density * waste;
}

/**
 * Totals for a list of plan rows.
 * @param {Array<{grams:number, qty:number}>} rows  grams = mass of ONE copy
 * @param {{pricePerKg:number, gramsPerHour:number}} material
 */
export function planTotals(rows, material) {
  const grams = rows.reduce((sum, r) => sum + r.grams * r.qty, 0);
  const pieces = rows.reduce((sum, r) => sum + r.qty, 0);
  return {
    pieces,
    grams,
    cost: material.pricePerKg ? (grams / 1000) * material.pricePerKg : null,
    hours: material.gramsPerHour ? grams / material.gramsPerHour : null,
  };
}
