import { describe, expect, it } from 'vitest';
import { getHolidayForDateKey } from './holidays';

describe('holidays', () => {
  it('identifies fixed holidays accurately', () => {
    expect(getHolidayForDateKey('2026-01-01')?.id).toBe('new-years');
    expect(getHolidayForDateKey('2026-02-14')?.id).toBe('valentines');
    expect(getHolidayForDateKey('2026-03-17')?.id).toBe('st-patricks');
    expect(getHolidayForDateKey('2026-07-04')?.id).toBe('independence');
    expect(getHolidayForDateKey('2026-10-31')?.id).toBe('halloween');
    expect(getHolidayForDateKey('2026-12-25')?.id).toBe('christmas');
    expect(getHolidayForDateKey('2026-12-31')?.id).toBe('new-years');
    expect(getHolidayForDateKey('2026-11-20')).toBeNull();
  });

  it('computes floating holidays (Thanksgiving and Easter)', () => {
    // 2026 Thanksgiving = 4th Thursday of Nov = Nov 26
    expect(getHolidayForDateKey('2026-11-26')?.id).toBe('thanksgiving');
    expect(getHolidayForDateKey('2026-11-19')).toBeNull();
    // 2027 Thanksgiving = Nov 25
    expect(getHolidayForDateKey('2027-11-25')?.id).toBe('thanksgiving');

    // 2026 Easter = April 5; 2027 Easter = March 28
    expect(getHolidayForDateKey('2026-04-05')?.id).toBe('easter');
    expect(getHolidayForDateKey('2027-03-28')?.id).toBe('easter');
  });
});
