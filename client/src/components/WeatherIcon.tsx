interface WeatherIconProps {
  code: number;
  isDay?: boolean;
  size?: number;
  className?: string;
}

const CLOUD_PATH =
  'M23.5 22H9.5a4.5 4.5 0 0 1-.8-8.93A6 6 0 0 1 20.2 11.4 4.5 4.5 0 0 1 23.5 22Z';

const SMALL_CLOUD_PATH =
  'M24.2 22.5H12.2a3.8 3.8 0 0 1-.65-7.54A5 5 0 0 1 21.3 13.6a3.8 3.8 0 0 1 2.9 8.9Z';

function SunRays({ cx, cy, rInner, rOuter }: { cx: number; cy: number; rInner: number; rOuter: number }) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g
      className="wi-sun-rays"
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      stroke="#fbbf24"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {angles.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + Math.cos(rad) * rInner;
        const y1 = cy + Math.sin(rad) * rInner;
        const x2 = cx + Math.cos(rad) * rOuter;
        const y2 = cy + Math.sin(rad) * rOuter;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
    </g>
  );
}

export function WeatherIcon({ code, isDay = true, size = 24, className }: WeatherIconProps) {
  const svgClass = ['wi-svg', className].filter(Boolean).join(' ');

  // Clear / Mainly clear
  if (code === 0 || code === 1) {
    if (isDay) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={svgClass}
          aria-hidden="true"
        >
          <circle
            cx="16"
            cy="16"
            r="9"
            fill="rgba(251, 191, 36, 0.16)"
            className="wi-sun-glow"
          />
          <SunRays cx={16} cy={16} rInner={9.2} rOuter={12.4} />
          <circle
            cx="16"
            cy="16"
            r="5.6"
            fill="#fbbf24"
            stroke="#fde68a"
            strokeWidth="1.2"
          />
        </svg>
      );
    }

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        <g className="wi-moon" style={{ transformOrigin: '15px 16px' }}>
          <path
            d="M21.8 18.6A7.6 7.6 0 0 1 13.4 10.2a7.6 7.6 0 1 0 8.4 8.4Z"
            fill="rgba(203, 213, 225, 0.2)"
            stroke="#cbd5e1"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <circle cx="22.5" cy="9.5" r="1.2" fill="#e2e8f0" className="wi-star wi-star-1" />
        <circle cx="25.2" cy="14" r="0.9" fill="#cbd5e1" className="wi-star wi-star-2" />
      </svg>
    );
  }

  // Partly cloudy
  if (code === 2) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        {isDay ? (
          <g>
            <SunRays cx={12.5} cy={12} rInner={6.4} rOuter={8.6} />
            <circle cx="12.5" cy="12" r="4" fill="#fbbf24" />
          </g>
        ) : (
          <g>
            <g className="wi-moon" style={{ transformOrigin: '12px 12px' }}>
              <path
                d="M16.2 13.6a5.2 5.2 0 0 1-5.8-5.8 5.2 5.2 0 1 0 5.8 5.8Z"
                fill="rgba(203, 213, 225, 0.2)"
                stroke="#cbd5e1"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </g>
            <circle cx="18.5" cy="7.5" r="1" fill="#e2e8f0" className="wi-star wi-star-1" />
          </g>
        )}
        <path
          d={SMALL_CLOUD_PATH}
          fill="#1e293b"
          stroke="#cbd5e1"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="wi-cloud-drift"
        />
      </svg>
    );
  }

  // Overcast
  if (code === 3) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        <path
          d="M21 15.5h-8.5a3 3 0 0 1-.5-5.95A4 4 0 0 1 19.6 8.5a3 3 0 0 1 1.4 7Z"
          fill="rgba(148, 163, 184, 0.16)"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="wi-cloud-drift-slow"
        />
        <path
          d={CLOUD_PATH}
          fill="rgba(30, 41, 59, 0.85)"
          stroke="#94a3b8"
          strokeWidth="1.85"
          strokeLinejoin="round"
          className="wi-cloud-drift"
        />
      </svg>
    );
  }

  // Fog
  if (code === 45 || code === 48) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        <path
          d="M23.5 18.5H9.5a4 4 0 0 1-.7-7.94A5.4 5.4 0 0 1 19.4 9.1a4 4 0 0 1 4.1 9.4Z"
          fill="rgba(148, 163, 184, 0.14)"
          stroke="#94a3b8"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="wi-cloud-drift-slow"
        />
        <line
          x1="7.5"
          y1="22.5"
          x2="22.5"
          y2="22.5"
          stroke="#94a3b8"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="wi-fog-1"
        />
        <line
          x1="10"
          y1="26"
          x2="24.5"
          y2="26"
          stroke="#64748b"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="wi-fog-2"
        />
      </svg>
    );
  }

  // Drizzle
  if (code >= 51 && code <= 57) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        <path
          d="M23.5 18.5H9.5a4 4 0 0 1-.7-7.94A5.4 5.4 0 0 1 19.4 9.1a4 4 0 0 1 4.1 9.4Z"
          fill="rgba(56, 189, 248, 0.1)"
          stroke="#94a3b8"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="wi-cloud-drift-slow"
        />
        <line x1="11.5" y1="21.5" x2="10.5" y2="24" stroke="#7dd3fc" strokeWidth="1.7" strokeLinecap="round" className="wi-rain wi-rain-1" />
        <line x1="16.5" y1="21.5" x2="15.5" y2="24" stroke="#7dd3fc" strokeWidth="1.7" strokeLinecap="round" className="wi-rain wi-rain-2" />
        <line x1="21.5" y1="21.5" x2="20.5" y2="24" stroke="#7dd3fc" strokeWidth="1.7" strokeLinecap="round" className="wi-rain wi-rain-3" />
      </svg>
    );
  }

  // Rain
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        <path
          d="M23.5 18.5H9.5a4 4 0 0 1-.7-7.94A5.4 5.4 0 0 1 19.4 9.1a4 4 0 0 1 4.1 9.4Z"
          fill="rgba(56, 189, 248, 0.14)"
          stroke="#7dd3fc"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="wi-cloud-drift-slow"
        />
        <line x1="10.5" y1="20.5" x2="9" y2="25" stroke="#38bdf8" strokeWidth="1.85" strokeLinecap="round" className="wi-rain wi-rain-1" />
        <line x1="15.5" y1="20.5" x2="14" y2="25" stroke="#38bdf8" strokeWidth="1.85" strokeLinecap="round" className="wi-rain wi-rain-2" />
        <line x1="20.5" y1="20.5" x2="19" y2="25" stroke="#38bdf8" strokeWidth="1.85" strokeLinecap="round" className="wi-rain wi-rain-3" />
      </svg>
    );
  }

  // Snow
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        <path
          d="M23.5 18.5H9.5a4 4 0 0 1-.7-7.94A5.4 5.4 0 0 1 19.4 9.1a4 4 0 0 1 4.1 9.4Z"
          fill="rgba(224, 242, 254, 0.14)"
          stroke="#cbd5e1"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="wi-cloud-drift-slow"
        />
        <circle cx="11" cy="22" r="1.4" fill="#e0f2fe" className="wi-snow wi-snow-1" />
        <circle cx="16" cy="22.5" r="1.4" fill="#e0f2fe" className="wi-snow wi-snow-2" />
        <circle cx="21" cy="22" r="1.4" fill="#e0f2fe" className="wi-snow wi-snow-3" />
      </svg>
    );
  }

  // Thunderstorm
  if (code >= 95) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={svgClass}
        aria-hidden="true"
      >
        <path
          d="M23.5 18.5H9.5a4 4 0 0 1-.7-7.94A5.4 5.4 0 0 1 19.4 9.1a4 4 0 0 1 4.1 9.4Z"
          fill="rgba(245, 158, 11, 0.12)"
          stroke="#94a3b8"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="wi-cloud-drift-slow"
        />
        <path
          d="M17.2 17.5 13.4 23h3.2l-1.3 5 4.9-6.2h-3.3l1.3-4.3Z"
          fill="#fbbf24"
          stroke="#fde68a"
          strokeWidth="0.8"
          strokeLinejoin="round"
          className="wi-bolt"
        />
      </svg>
    );
  }

  // Default cloud
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={svgClass}
      aria-hidden="true"
    >
      <path
        d={CLOUD_PATH}
        fill="rgba(148, 163, 184, 0.14)"
        stroke="#94a3b8"
        strokeWidth="1.85"
        strokeLinejoin="round"
        className="wi-cloud-drift"
      />
    </svg>
  );
}
