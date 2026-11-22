import type { MarketData, MarketQuote } from '../../../shared/types.js';
import { CacheStore } from '../cache.js';

const MARKET_TTL_SEC = 300; // 5 minutes per symbol (shared across all families)
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'] as const;

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        currentTradingPeriod?: {
          regular?: { start?: number; end?: number };
        };
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }> | null;
    error?: { code?: string; description?: string } | null;
  };
}

function epochToNyDateKey(epochSec: number): string {
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

function parseYahooQuote(symbol: string, raw: YahooChartResponse): MarketQuote {
  const result = raw.chart?.result?.[0];
  if (!result?.meta) {
    throw new Error(raw.chart?.error?.description ?? `No data for ${symbol}`);
  }
  const meta = result.meta;
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

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
    tradingDate = regDate ?? epochToNyDateKey(Math.floor(Date.now() / 1000));
  } else {
    throw new Error(`No usable price data for ${symbol}`);
  }

  const regularPeriod = meta.currentTradingPeriod?.regular;
  const nowSec = Math.floor(Date.now() / 1000);
  const isMarketOpen =
    typeof regularPeriod?.start === 'number' &&
    typeof regularPeriod?.end === 'number' &&
    nowSec >= regularPeriod.start &&
    nowSec < regularPeriod.end;

  const rawPct = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  return {
    symbol: meta.symbol || symbol,
    price: Math.round(price * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    changePercent: Math.round(rawPct * 100) / 100,
    tradingDate,
    isMarketOpen,
  };
}

async function fetchSymbolQuote(
  symbol: string,
  cache: CacheStore,
  options?: { force?: boolean; fetchFn?: typeof fetch }
): Promise<MarketQuote> {
  const fetchFn = options?.fetchFn ?? fetch;
  const cacheKey = `market:quote:${symbol}`;

  if (!options?.force) {
    const cached = await cache.getJson<MarketQuote>(cacheKey);
    if (cached) return cached;
  }

  let lastErr: unknown;
  for (const host of YAHOO_HOSTS) {
    try {
      const res = await fetchFn(
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; HomeboardCloud/1.0)',
          },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as YahooChartResponse;
      const quote = parseYahooQuote(symbol, json);
      await cache.setJson(cacheKey, quote, MARKET_TTL_SEC);
      return quote;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`Failed to fetch ${symbol}`);
}

export async function resolveMarket(
  rawSymbols: string[],
  cache: CacheStore,
  options?: { force?: boolean; fetchFn?: typeof fetch }
): Promise<MarketData> {
  const symbols = Array.from(
    new Set(
      rawSymbols
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.^=-]{1,12}$/.test(s))
    )
  ).slice(0, 10);

  const list = symbols.length > 0 ? symbols : ['SPY', 'QQQ'];
  const results = await Promise.allSettled(
    list.map((sym) => fetchSymbolQuote(sym, cache, options))
  );

  const quotes: MarketQuote[] = [];
  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      quotes.push(r.value);
    } else {
      errors.push(`${list[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  }

  if (quotes.length === 0) {
    throw new Error(errors.join('; ') || 'Market fetch failed');
  }

  return {
    fetchedAt: new Date().toISOString(),
    stale: false,
    isMarketOpen: quotes.some((q) => q.isMarketOpen),
    tradingDate: quotes[0].tradingDate,
    quotes,
  };
}
