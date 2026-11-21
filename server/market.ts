import type { MarketData, MarketQuote } from '../shared/types.js';

export const DEFAULT_MARKET_SYMBOLS = ['SPY', 'QQQ'] as const;

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'] as const;

export interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        currentTradingPeriod?: {
          regular?: {
            start?: number;
            end?: number;
          };
        };
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }> | null;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
}

export function epochToNyDateKey(epochSec: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(epochSec * 1000));
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function parseYahooChartQuote(
  symbol: string,
  raw: YahooChartResponse,
  nowMs: number = Date.now()
): MarketQuote {
  const result = raw.chart?.result?.[0];
  if (!result?.meta) {
    const desc = raw.chart?.error?.description ?? 'Missing chart result';
    throw new Error(`Yahoo Finance returned no data for ${symbol}: ${desc}`);
  }

  const meta = result.meta;
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  // Deduplicate daily bars by NY trading date, keeping the latest close for each date
  const barByDate = new Map<string, number>();
  const len = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < len; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (typeof ts === 'number' && Number.isFinite(ts) && isFinitePositive(close)) {
      barByDate.set(epochToNyDateKey(ts), close);
    }
  }

  const bars = Array.from(barByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, close]) => ({ date, close }));

  const regPrice = isFinitePositive(meta.regularMarketPrice) ? meta.regularMarketPrice : undefined;
  const regDate =
    typeof meta.regularMarketTime === 'number' && Number.isFinite(meta.regularMarketTime)
      ? epochToNyDateKey(meta.regularMarketTime)
      : undefined;

  let price: number;
  let previousClose: number;
  let tradingDate: string;

  if (bars.length >= 2) {
    const lastBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];

    if (regDate && regDate > lastBar.date && regPrice !== undefined) {
      price = regPrice;
      previousClose = lastBar.close;
      tradingDate = regDate;
    } else {
      price = regPrice ?? lastBar.close;
      previousClose = prevBar.close;
      tradingDate = regDate ?? lastBar.date;
    }
  } else if (bars.length === 1) {
    price = regPrice ?? bars[0].close;
    previousClose =
      (isFinitePositive(meta.previousClose) ? meta.previousClose : undefined) ??
      (isFinitePositive(meta.chartPreviousClose) ? meta.chartPreviousClose : undefined) ??
      bars[0].close;
    tradingDate = regDate ?? bars[0].date;
  } else if (regPrice !== undefined) {
    price = regPrice;
    previousClose =
      (isFinitePositive(meta.previousClose) ? meta.previousClose : undefined) ??
      (isFinitePositive(meta.chartPreviousClose) ? meta.chartPreviousClose : undefined) ??
      regPrice;
    tradingDate = regDate ?? epochToNyDateKey(Math.floor(nowMs / 1000));
  } else {
    throw new Error(`No usable price data for ${symbol}`);
  }

  const regularPeriod = meta.currentTradingPeriod?.regular;
  const nowSec = Math.floor(nowMs / 1000);
  const isMarketOpen =
    typeof regularPeriod?.start === 'number' &&
    typeof regularPeriod?.end === 'number' &&
    nowSec >= regularPeriod.start &&
    nowSec < regularPeriod.end;

  const rawPct = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;
  const changePercent = Math.round(rawPct * 100) / 100;

  return {
    symbol: meta.symbol || symbol,
    price: Math.round(price * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    changePercent,
    tradingDate,
    isMarketOpen,
  };
}

export async function fetchYahooQuote(symbol: string): Promise<MarketQuote> {
  let lastErr: unknown;

  for (const host of YAHOO_HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; Homeboard/1.0)',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${host}`);
      }
      const json = (await res.json()) as YahooChartResponse;
      return parseYahooChartQuote(symbol, json);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`Failed to fetch quote for ${symbol}`);
}

export class MarketService {
  private cache: MarketData | null = null;
  private lastError: string | undefined;
  private readonly symbols: readonly string[];

  constructor(symbols: readonly string[] = DEFAULT_MARKET_SYMBOLS) {
    this.symbols = symbols;
  }

  getSnapshot(): { data: MarketData | null; error?: string } {
    return {
      data: this.cache,
      error: this.lastError,
    };
  }

  async refresh(): Promise<void> {
    const results = await Promise.allSettled(this.symbols.map((sym) => fetchYahooQuote(sym)));
    const quotes: MarketQuote[] = [];
    const errors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        quotes.push(r.value);
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`${this.symbols[i]}: ${msg}`);
      }
    }

    if (quotes.length > 0) {
      this.cache = {
        fetchedAt: new Date().toISOString(),
        stale: false,
        isMarketOpen: quotes.some((q) => q.isMarketOpen),
        tradingDate: quotes[0].tradingDate,
        quotes,
      };
      this.lastError = errors.length > 0 ? errors.join('; ') : undefined;
    } else {
      const message = errors.join('; ') || 'Market fetch failed';
      this.lastError = message;
      if (this.cache) {
        this.cache = { ...this.cache, stale: true };
      }
      console.error(`[market] Refresh failed: ${message}`);
    }
  }
}
