import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { MarketData } from '../../../shared/types';
import { getDateKeyInTimeZone, parseDateKey } from '../utils/date';

interface StocksSlideProps {
  now: Date;
  timezone: string;
  market: MarketData | null;
}

function formatSessionLabel(tradingDate: string, todayKey: string, isOpen: boolean): string {
  if (isOpen) return 'Market Open · Live';
  if (tradingDate === todayKey) return 'Market Close';
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parseDateKey(tradingDate));
  return `Close · ${weekday}`;
}

export function StocksSlide({ now, timezone, market }: StocksSlideProps) {
  const todayKey = getDateKeyInTimeZone(now, timezone);
  const quotes = market?.quotes ?? [];

  const updatedLabel = market?.fetchedAt
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(market.fetchedAt))
    : null;

  return (
    <section className="slide-panel stocks-slide" aria-label="Markets & Stocks">
      <div className="slide-header">
        <div className="slide-header-left">
          <h2 className="slide-title">Markets</h2>
          {market && (
            <span className={`stocks-status-pill ${market.isMarketOpen ? 'is-live' : ''}`}>
              {market.isMarketOpen && <span className="market-live-dot" aria-hidden="true" />}
              {formatSessionLabel(market.tradingDate, todayKey, market.isMarketOpen)}
            </span>
          )}
        </div>
        {updatedLabel && (
          <span className="slide-subtitle">
            {market?.stale ? 'Cached · ' : ''}Updated {updatedLabel}
          </span>
        )}
      </div>

      {quotes.length === 0 ? (
        <div className="slide-empty">
          <p>No market quotes available yet.</p>
        </div>
      ) : (
        <div
          className={`stocks-card-grid ${quotes.length <= 2 ? 'stocks-card-grid-hero' : ''}`}
        >
          {quotes.map((quote) => {
            const direction =
              quote.changePercent > 0 ? 'up' : quote.changePercent < 0 ? 'down' : 'flat';
            const sign = quote.changePercent > 0 ? '+' : '';
            const dollarChange = quote.price - quote.previousClose;
            const dollarSign = dollarChange > 0 ? '+' : dollarChange < 0 ? '-' : '';
            const dollarText = `${dollarSign}$${Math.abs(dollarChange).toFixed(2)}`;
            const pctText = `${sign}${quote.changePercent.toFixed(1)}%`;

            return (
              <div
                key={quote.symbol}
                className={`stock-hero-card stock-hero-${direction}`}
              >
                <div className="stock-hero-top">
                  <span className="stock-hero-symbol">{quote.symbol}</span>
                  <span className="stock-hero-price">${quote.price.toFixed(2)}</span>
                </div>

                <div className={`stock-hero-pct stock-pct-${direction}`}>
                  {direction === 'up' ? (
                    <TrendingUp size={40} />
                  ) : direction === 'down' ? (
                    <TrendingDown size={40} />
                  ) : (
                    <Minus size={40} />
                  )}
                  {pctText}
                </div>

                <div className="stock-hero-footer">
                  <span className={`stock-hero-delta stock-delta-${direction}`}>
                    {dollarText} today
                  </span>
                  <span className="stock-hero-prev">
                    Prev close ${quote.previousClose.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
