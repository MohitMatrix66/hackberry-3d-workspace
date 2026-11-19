import { describe, expect, it } from 'vitest';
import { partGrams, planTotals, MATERIALS } from '../src/lib/printEstimate.js';

const profile = { wall_mm: 1.2, infill_fraction: 0.25 };

describe('partGrams', () => {
  it('prints a thin part solid (its walls fill it)', () => {
    // 2 cm3 with 30 cm2 of surface: 30 x 0.12 cm = 3.6 cm3 of walls > volume
    expect(partGrams({ volume_cm3: 2, area_cm2: 30 }, profile, 1.0, 1)).toBeCloseTo(2, 9);
  });

  it('uses walls plus partial infill for a chunky part', () => {
    // walls 10 x 0.12 = 1.2 cm3, infill (10 - 1.2) x 0.25 = 2.2 cm3
    expect(partGrams({ volume_cm3: 10, area_cm2: 10 }, profile, 1.0, 1)).toBeCloseTo(3.4, 9);
  });

  it('applies density and waste factor', () => {
    expect(partGrams({ volume_cm3: 1, area_cm2: 100 }, profile, 1.27, 1.1)).toBeCloseTo(1.397, 9);
  });
});

describe('planTotals', () => {
  it('sums quantity-weighted grams, cost and time', () => {
    const t = planTotals([{ grams: 10, qty: 3 }, { grams: 20, qty: 1 }], { pricePerKg: 1000, gramsPerHour: 10 });
    expect(t.pieces).toBe(4);
    expect(t.grams).toBe(50);
    expect(t.cost).toBe(50);
    expect(t.hours).toBe(5);
  });

  it('returns no cost or time for a printing-service material', () => {
    const t = planTotals([{ grams: 10, qty: 1 }], MATERIALS['PA12 nylon (SLS service)']);
    expect(t.cost).toBeNull();
    expect(t.hours).toBeNull();
  });
});
