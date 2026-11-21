import { describe, expect, it } from 'vitest';
import { parseYahooChartQuote, type YahooChartResponse } from './market.js';

describe('parseYahooChartQuote', () => {
  it('computes intraday percent change against previous trading day close while market is open', () => {
    const raw: YahooChartResponse = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'SPY',
              regularMarketPrice: 595.5,
              regularMarketTime: Date.UTC(2026, 10, 20, 16, 30, 0) / 1000, // 11:30 AM ET
              chartPreviousClose: 580.0, // 5 days ago, should NOT be used
              currentTradingPeriod: {
                regular: {
                  start: Date.UTC(2026, 10, 20, 14, 30, 0) / 1000, // 9:30 AM ET
                  end: Date.UTC(2026, 10, 20, 21, 0, 0) / 1000,    // 4:00 PM ET
                },
              },
            },
            timestamp: [
              Date.UTC(2026, 10, 18, 14, 30, 0) / 1000,
              Date.UTC(2026, 10, 19, 14, 30, 0) / 1000,
              Date.UTC(2026, 10, 20, 16, 30, 0) / 1000,
            ],
            indicators: {
              quote: [
                {
                  close: [586.0, 590.0, 595.5],
                },
              ],
            },
          },
        ],
      },
    };

    const nowMs = Date.UTC(2026, 10, 20, 16, 35, 0);
    const quote = parseYahooChartQuote('SPY', raw, nowMs);

    expect(quote.symbol).toBe('SPY');
    expect(quote.price).toBe(595.5);
    expect(quote.previousClose).toBe(590.0);
    expect(quote.changePercent).toBe(0.93);
    expect(quote.tradingDate).toBe('2026-11-20');
    expect(quote.isMarketOpen).toBe(true);
  });

  it('shows last trading day percent change when market is closed (weekend)', () => {
    const raw: YahooChartResponse = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'QQQ',
              regularMarketPrice: 502.0,
              regularMarketTime: Date.UTC(2026, 10, 20, 21, 0, 0) / 1000, // Friday 4:00 PM ET
              chartPreviousClose: 495.0,
              currentTradingPeriod: {
                regular: {
                  start: Date.UTC(2026, 10, 20, 14, 30, 0) / 1000,
                  end: Date.UTC(2026, 10, 20, 21, 0, 0) / 1000,
                },
              },
            },
            timestamp: [
              Date.UTC(2026, 10, 19, 14, 30, 0) / 1000,
              Date.UTC(2026, 10, 20, 14, 30, 0) / 1000,
            ],
            indicators: {
              quote: [
                {
                  close: [510.0, 502.0],
                },
              ],
            },
          },
        ],
      },
    };

    // Saturday afternoon
    const nowMs = Date.UTC(2026, 10, 21, 18, 0, 0);
    const quote = parseYahooChartQuote('QQQ', raw, nowMs);

    expect(quote.symbol).toBe('QQQ');
    expect(quote.price).toBe(502.0);
    expect(quote.previousClose).toBe(510.0);
    expect(quote.changePercent).toBe(-1.57);
    expect(quote.tradingDate).toBe('2026-11-20');
    expect(quote.isMarketOpen).toBe(false);
  });

  it('handles duplicate same-day timestamps and null closes gracefully', () => {
    const raw: YahooChartResponse = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'SPY',
              regularMarketPrice: 600.0,
              regularMarketTime: Date.UTC(2026, 10, 20, 20, 55, 0) / 1000,
              currentTradingPeriod: {
                regular: {
                  start: Date.UTC(2026, 10, 20, 14, 30, 0) / 1000,
                  end: Date.UTC(2026, 10, 20, 21, 0, 0) / 1000,
                },
              },
            },
            timestamp: [
              Date.UTC(2026, 10, 19, 14, 30, 0) / 1000,
              Date.UTC(2026, 10, 20, 14, 30, 0) / 1000,
              Date.UTC(2026, 10, 20, 20, 55, 0) / 1000,
            ],
            indicators: {
              quote: [
                {
                  close: [594.0, null, 600.0],
                },
              ],
            },
          },
        ],
      },
    };

    const nowMs = Date.UTC(2026, 10, 20, 20, 56, 0);
    const quote = parseYahooChartQuote('SPY', raw, nowMs);

    expect(quote.previousClose).toBe(594.0);
    expect(quote.changePercent).toBe(1.01);
    expect(quote.isMarketOpen).toBe(true);
  });
});
