import { describe, expect, it } from 'vitest';
import type { DailyForecastItem } from '../../../shared/types';
import { formatDurationShort, formatMinutesClock, getSolarInfo, getUvBadgeInfo } from './solar';

const sampleToday: DailyForecastItem = {
  date: '2026-11-20',
  weatherCode: 0,
  condition: 'Clear',
  tempMax: 54,
  tempMin: 30,
  precipitationProbability: 5,
  sunrise: '2026-11-20T06:48',
  sunset: '2026-11-20T16:58',
};

const sampleTomorrow: DailyForecastItem = {
  ...sampleToday,
  date: '2026-11-21',
  sunrise: '2026-11-21T06:49',
  sunset: '2026-11-21T16:57',
};

describe('solar utilities', () => {
  it('formats minutes and durations cleanly', () => {
    expect(formatMinutesClock(6 * 60 + 48, '12h')).toBe('6:48a');
    expect(formatMinutesClock(16 * 60 + 58, '12h')).toBe('4:58p');
    expect(formatMinutesClock(16 * 60 + 58, '24h')).toBe('16:58');
    expect(formatDurationShort(72)).toBe('1h 12m');
    expect(formatDurationShort(45)).toBe('45m');
    expect(formatDurationShort(120)).toBe('2h');
  });

  it('computes daytime solar progress and sunset countdown', () => {
    // 11:53 MST (UTC-7) = 18:53 UTC -> right around midday
    const info = getSolarInfo(
      new Date('2026-11-20T18:53:00Z'),
      'America/Denver',
      sampleToday,
      sampleTomorrow,
      '12h'
    );
    expect(info).not.toBeNull();
    expect(info!.isDaylight).toBe(true);
    expect(info!.progress).toBeGreaterThan(0.45);
    expect(info!.progress).toBeLessThan(0.55);
    expect(info!.primaryLabel).toBe('Sunset 4:58p');
    expect(info!.daylightDeltaMin).toBe(-2);
  });

  it('returns UV badge only when daytime and UV >= 3', () => {
    expect(getUvBadgeInfo(2.4, true)).toBeNull();
    expect(getUvBadgeInfo(7.2, false)).toBeNull();
    expect(getUvBadgeInfo(4.2, true)).toEqual({ value: 4, label: 'Moderate', tone: 'moderate' });
    expect(getUvBadgeInfo(6.8, true)).toEqual({ value: 7, label: 'High', tone: 'high' });
    expect(getUvBadgeInfo(9.1, true)).toEqual({ value: 9, label: 'Very High', tone: 'very-high' });
    expect(getUvBadgeInfo(11.3, true)).toEqual({ value: 11, label: 'Extreme', tone: 'extreme' });
  });
});
