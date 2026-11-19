import { describe, expect, it } from 'vitest';
import { toCSV } from '../src/lib/csv.js';

describe('toCSV', () => {
  it('quotes cells that contain commas, quotes or line breaks', () => {
    const csv = toCSV(['id', 'name'], [['R-O-01', 'Middle, distal "phalanx"'], ['R-H-02', 'two\nlines']]);
    expect(csv).toBe('id,name\r\nR-O-01,"Middle, distal ""phalanx"""\r\nR-H-02,"two\nlines"\r\n');
  });

  it('writes empty cells for null and undefined', () => {
    expect(toCSV(['a', 'b', 'c'], [[1, null, undefined]])).toBe('a,b,c\r\n1,,\r\n');
  });
});
