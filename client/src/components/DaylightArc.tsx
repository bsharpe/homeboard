import type { SolarInfo } from '../utils/solar';

interface DaylightArcProps {
  solar: SolarInfo;
}

// Quadratic Bezier from (8, 30) through control (34, 2) to (60, 30)
function bezierPoint(t: number): { x: number; y: number } {
  const u = 1 - t;
  const x = u * u * 8 + 2 * u * t * 34 + t * t * 60;
  const y = u * u * 30 + 2 * u * t * 2 + t * t * 30;
  return { x, y };
}

export function DaylightArc({ solar }: DaylightArcProps) {
  const pos = bezierPoint(solar.progress);
  const deltaText =
    solar.daylightDeltaMin !== null && solar.daylightDeltaMin !== 0
      ? ` · ${solar.daylightDeltaMin > 0 ? '+' : ''}${solar.daylightDeltaMin}m`
      : '';

  const tooltip = `Sunrise ${solar.sunriseLabel} · Sunset ${solar.sunsetLabel} · Daylight ${solar.daylightDurationLabel}${deltaText}`;

  return (
    <div className="header-solar" title={tooltip}>
      <div className="header-solar-icon">
        <svg
          width="58"
          height="38"
          viewBox="0 0 68 40"
          fill="none"
          className="solar-arc-svg"
          aria-hidden="true"
        >
          {/* Horizon line */}
          <line
            x1="4"
            y1="30"
            x2="64"
            y2="30"
            stroke="currentColor"
            strokeOpacity="0.24"
            strokeWidth="1.2"
            strokeDasharray="2.5 2.5"
          />
          {/* Full solar path track */}
          <path
            d="M 8 30 Q 34 2 60 30"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          {/* Elapsed daylight arc */}
          {solar.isDaylight && (
            <path
              d="M 8 30 Q 34 2 60 30"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              pathLength={100}
              strokeDasharray={`${Math.round(solar.progress * 100)} 100`}
            />
          )}
          {/* Sunrise & sunset horizon markers */}
          <circle cx="8" cy="30" r="1.8" fill="currentColor" fillOpacity="0.4" />
          <circle cx="60" cy="30" r="1.8" fill="currentColor" fillOpacity="0.4" />

          {/* Sun dot */}
          {solar.isDaylight ? (
            <g>
              <circle cx={pos.x} cy={pos.y} r="7.5" fill="rgba(251, 191, 36, 0.25)" />
              <circle
                cx={pos.x}
                cy={pos.y}
                r="3.8"
                fill="#fbbf24"
                stroke="#fef3c7"
                strokeWidth="1"
              />
            </g>
          ) : (
            <circle
              cx={solar.nowMin < solar.sunriseMin ? 8 : 60}
              cy="34"
              r="2.8"
              fill="#94a3b8"
              fillOpacity="0.65"
            />
          )}
        </svg>
      </div>
      <div className="header-solar-text">
        <span className="header-solar-primary">{solar.primaryLabel}</span>
        <span className="header-solar-meta">
          {solar.secondaryLabel} · {solar.daylightDurationLabel}
        </span>
      </div>
    </div>
  );
}
