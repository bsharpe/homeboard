import { describe, expect, it } from 'vitest';
import { getEquinoxSolsticeInstants, getHolidayForDateKey } from './holidays';

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

  it('computes astronomical solstice and equinox UTC instants accurately', () => {
    const y2026 = getEquinoxSolsticeInstants(2026);
    // Official USNO 2026 UTC times:
    // Mar 20 14:46, Jun 21 08:24, Sep 23 00:05, Dec 21 20:50
    expect(Math.abs(y2026.marchEquinox.getTime() - Date.UTC(2026, 2, 20, 14, 46))).toBeLessThan(
      3 * 60_000
    );
    expect(Math.abs(y2026.juneSolstice.getTime() - Date.UTC(2026, 5, 21, 8, 24))).toBeLessThan(
      3 * 60_000
    );
    expect(Math.abs(y2026.septemberEquinox.getTime() - Date.UTC(2026, 8, 23, 0, 5))).toBeLessThan(
      3 * 60_000
    );
    expect(Math.abs(y2026.decemberSolstice.getTime() - Date.UTC(2026, 11, 21, 20, 50))).toBeLessThan(
      3 * 60_000
    );
  });

  it('identifies solstices and equinoxes with timezone awareness', () => {
    // UTC dates for 2026
    expect(getHolidayForDateKey('2026-03-20')).toEqual({
      id: 'spring-equinox',
      label: 'Spring Equinox',
    });
    expect(getHolidayForDateKey('2026-06-21')).toEqual({
      id: 'summer-solstice',
      label: 'Summer Solstice',
    });
    expect(getHolidayForDateKey('2026-09-23')).toEqual({
      id: 'autumn-equinox',
      label: 'Autumn Equinox',
    });
    expect(getHolidayForDateKey('2026-12-21')).toEqual({
      id: 'winter-solstice',
      label: 'Winter Solstice',
    });

    // 2026 Sep equinox is Sep 23 00:05 UTC -> Sep 22 18:05 MDT in America/Denver
    expect(getHolidayForDateKey('2026-09-22', { timezone: 'America/Denver' })?.id).toBe(
      'autumn-equinox'
    );
    expect(getHolidayForDateKey('2026-09-23', { timezone: 'America/Denver' })).toBeNull();

    // 2027 Dec solstice is Dec 22 02:42 UTC -> Dec 21 19:42 MST in America/Denver
    expect(getHolidayForDateKey('2027-12-22', { timezone: 'UTC' })?.id).toBe('winter-solstice');
    expect(getHolidayForDateKey('2027-12-21', { timezone: 'America/Denver' })?.id).toBe(
      'winter-solstice'
    );
  });

  it('flips solstice and equinox season labels in the southern hemisphere', () => {
    const sydney = { timezone: 'Australia/Sydney', latitude: -33.87 };
    expect(getHolidayForDateKey('2026-03-21', sydney)).toEqual({
      id: 'autumn-equinox',
      label: 'Autumn Equinox',
    });
    expect(getHolidayForDateKey('2026-06-21', sydney)).toEqual({
      id: 'winter-solstice',
      label: 'Winter Solstice',
    });
    expect(getHolidayForDateKey('2026-09-23', sydney)).toEqual({
      id: 'spring-equinox',
      label: 'Spring Equinox',
    });
    expect(getHolidayForDateKey('2026-12-22', sydney)).toEqual({
      id: 'summer-solstice',
      label: 'Summer Solstice',
    });
  });
});
