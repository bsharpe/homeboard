import { describe, expect, it } from 'vitest';
import { getSeason, getSkyPhase, getWeatherMood, resolveBoardTheme } from './atmosphere';

describe('atmosphere utilities', () => {
  it('computes sky phases from sunrise and sunset', () => {
    const tz = 'America/Denver';
    const sunrise = '2026-06-15T05:50';
    const sunset = '2026-06-15T20:25';

    // 03:00 MDT = 09:00 UTC
    expect(getSkyPhase(new Date('2026-06-15T09:00:00Z'), tz, sunrise, sunset)).toBe('night');
    // 06:00 MDT = 12:00 UTC (within 45m of sunrise)
    expect(getSkyPhase(new Date('2026-06-15T12:00:00Z'), tz, sunrise, sunset)).toBe('dawn');
    // 08:30 MDT = 14:30 UTC
    expect(getSkyPhase(new Date('2026-06-15T14:30:00Z'), tz, sunrise, sunset)).toBe('morning');
    // 13:00 MDT = 19:00 UTC
    expect(getSkyPhase(new Date('2026-06-15T19:00:00Z'), tz, sunrise, sunset)).toBe('midday');
    // 19:45 MDT = 01:45 UTC next day
    expect(getSkyPhase(new Date('2026-06-16T01:45:00Z'), tz, sunrise, sunset)).toBe('golden');
    // 21:00 MDT = 03:00 UTC next day
    expect(getSkyPhase(new Date('2026-06-16T03:00:00Z'), tz, sunrise, sunset)).toBe('dusk');
    // 22:30 MDT = 04:30 UTC next day
    expect(getSkyPhase(new Date('2026-06-16T04:30:00Z'), tz, sunrise, sunset)).toBe('night');
  });

  it('maps WMO weather codes to ambient moods', () => {
    expect(getWeatherMood(0)).toBe('clear');
    expect(getWeatherMood(3)).toBe('cloudy');
    expect(getWeatherMood(45)).toBe('fog');
    expect(getWeatherMood(63)).toBe('rain');
    expect(getWeatherMood(73)).toBe('snow');
    expect(getWeatherMood(95)).toBe('storm');
  });

  it('computes seasons for northern and southern hemispheres', () => {
    expect(getSeason(new Date('2026-01-15T12:00:00Z'), 'UTC', 35)).toBe('winter');
    expect(getSeason(new Date('2026-04-15T12:00:00Z'), 'UTC', 35)).toBe('spring');
    expect(getSeason(new Date('2026-07-15T12:00:00Z'), 'UTC', 35)).toBe('summer');
    expect(getSeason(new Date('2026-10-15T12:00:00Z'), 'UTC', 35)).toBe('autumn');
    expect(getSeason(new Date('2026-01-15T12:00:00Z'), 'UTC', -33)).toBe('summer');
  });

  it('resolves explicit and auto themes', () => {
    expect(resolveBoardTheme('dark', null, new Date('2026-06-15T18:00:00Z'), 'UTC')).toBe('dark');
    expect(resolveBoardTheme('light', null, new Date('2026-06-15T02:00:00Z'), 'UTC')).toBe('light');
    expect(resolveBoardTheme('auto', null, new Date('2026-06-15T13:00:00Z'), 'UTC')).toBe('light');
    expect(resolveBoardTheme('auto', null, new Date('2026-06-15T22:00:00Z'), 'UTC')).toBe('dark');
  });
});
