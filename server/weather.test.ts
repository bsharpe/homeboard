import { describe, expect, it } from 'vitest';
import {
  mapTempestIconToWmo,
  parseTempestBetterForecast,
  type TempestBetterForecastResponse,
} from './weather.js';

describe('Tempest weather integration', () => {
  it('maps Tempest icon names to WMO weather codes', () => {
    expect(mapTempestIconToWmo('clear-day')).toBe(0);
    expect(mapTempestIconToWmo('clear-night')).toBe(0);
    expect(mapTempestIconToWmo('partly-cloudy-day')).toBe(2);
    expect(mapTempestIconToWmo('cloudy')).toBe(3);
    expect(mapTempestIconToWmo('foggy')).toBe(45);
    expect(mapTempestIconToWmo('possibly-rainy-day')).toBe(80);
    expect(mapTempestIconToWmo('rainy')).toBe(63);
    expect(mapTempestIconToWmo('snow')).toBe(73);
    expect(mapTempestIconToWmo('thunderstorm')).toBe(95);
  });

  it('parses Tempest better_forecast payload into WeatherData with hyperlocal extras', () => {
    const sample: TempestBetterForecastResponse = {
      status: { status_code: 0, status_message: 'SUCCESS' },
      location_name: 'Backyard Tempest',
      timezone: 'America/Denver',
      current_conditions: {
        time: 1795201200, // 2026-11-20T12:00:00 MST (19:00 UTC)
        conditions: 'Partly Cloudy',
        icon: 'partly-cloudy-day',
        air_temperature: 52.4,
        feels_like: 49.8,
        relative_humidity: 41,
        wind_avg: 6.4,
        wind_gust: 14.2,
        uv: 5.6,
        pressure_trend: 'steady',
        precip_accum_local_day: 0.14,
        lightning_strike_count_last_1hr: 2,
        lightning_strike_last_distance: 8.3,
      },
      forecast: {
        hourly: [
          {
            time: 1795201200,
            conditions: 'Partly Cloudy',
            icon: 'partly-cloudy-day',
            air_temperature: 52,
            precip_probability: 10,
          },
          {
            time: 1795204800, // +1h
            conditions: 'Rain Likely',
            icon: 'possibly-rainy-day',
            air_temperature: 50.6,
            precip_probability: 65,
          },
          {
            time: 1795208400, // +2h
            conditions: 'Clear',
            icon: 'clear-night',
            air_temperature: 45.2,
            precip_probability: 5,
          },
        ],
        daily: [
          {
            day_start_local: 1795158000, // 2026-11-20 00:00 MST
            conditions: 'Partly Cloudy',
            icon: 'partly-cloudy-day',
            air_temp_high: 55.2,
            air_temp_low: 31.4,
            precip_probability: 40,
            sunrise: 1795182480, // 06:48 MST
            sunset: 1795219080, // 16:58 MST
          },
        ],
      },
    };

    const result = parseTempestBetterForecast(sample, {
      name: 'Santa Fe Backyard',
      unit: 'fahrenheit',
      timezone: 'America/Denver',
    });

    expect(result.source).toBe('tempest');
    expect(result.locationName).toBe('Santa Fe Backyard');
    expect(result.current.temperature).toBe(52);
    expect(result.current.apparentTemperature).toBe(50);
    expect(result.current.windSpeed).toBe(6);
    expect(result.current.windGust).toBe(14);
    expect(result.current.uvIndex).toBe(5.6);
    expect(result.current.precipToday).toBe(0.14);
    expect(result.current.lightningCount).toBe(2);
    expect(result.current.lightningLastDist).toBe(8);
    expect(result.current.isDay).toBe(true);
    expect(result.hourly).toHaveLength(2);
    expect(result.hourly[0].precipitationProbability).toBe(65);
    expect(result.hourly[1].isDay).toBe(false);
    expect(result.daily).toHaveLength(1);
    expect(result.daily[0].date).toBe('2026-11-20');
    expect(result.daily[0].sunrise).toMatch(/^2026-11-20T06:48$/);
    expect(result.daily[0].sunset).toMatch(/^2026-11-20T16:58$/);
  });
});
