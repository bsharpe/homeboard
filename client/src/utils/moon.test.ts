import { describe, expect, it } from 'vitest';
import { addDaysToKey } from './date';
import { getMoonPhaseForDateKey } from './moon';

describe('moon phases', () => {
  it('identifies exactly one day per major phase across a 29-day cycle', () => {
    const majorDays: Array<{ dateKey: string; kind: string }> = [];
    for (let i = 0; i < 29; i++) {
      const dateKey = addDaysToKey('2026-11-15', i);
      const info = getMoonPhaseForDateKey(dateKey);
      if (info.majorPhase) {
        majorDays.push({ dateKey, kind: info.majorPhase });
      }
    }

    const kinds = new Set(majorDays.map((d) => d.kind));
    expect(kinds.has('first-quarter')).toBe(true);
    expect(kinds.has('full')).toBe(true);
    expect(kinds.has('last-quarter')).toBe(true);
    expect(kinds.has('new')).toBe(true);
    expect(majorDays.length).toBe(4);
  });

  it('computes high illumination on a full moon day', () => {
    // Full Moon in late November 2026 is around Nov 24
    const full = getMoonPhaseForDateKey('2026-11-24');
    expect(full.illumination).toBeGreaterThan(0.95);
    expect(full.name).toBe('Full Moon');
  });
});
