import { useId } from 'react';

interface MoonPhaseIconProps {
  /** Normalized lunar phase [0, 1): 0 = New, 0.25 = First Quarter, 0.5 = Full, 0.75 = Last Quarter */
  phase: number;
  size?: number;
  title?: string;
  className?: string;
}

export function MoonPhaseIcon({ phase, size = 14, title, className }: MoonPhaseIconProps) {
  const clipId = useId();
  const normalized = ((phase % 1) + 1) % 1;
  const r = 9;
  const cx = 12;
  const cy = 12;

  const isNew = normalized < 0.025 || normalized > 0.975;
  const isFull = Math.abs(normalized - 0.5) < 0.025;
  const showDetail = size >= 30;

  let litPath: string | null = null;
  if (!isNew && !isFull) {
    const angle = normalized * 2 * Math.PI;
    const rx = Math.max(0.01, Math.abs(Math.cos(angle)) * r);
    const waxing = normalized < 0.5;
    const gibbous = normalized > 0.25 && normalized < 0.75;

    // Outer limb arc from top (12, 3) to bottom (12, 21)
    const outerSweep = waxing ? 1 : 0;
    // Inner terminator arc from bottom (12, 21) back to top (12, 3)
    const innerSweep = waxing ? (gibbous ? 1 : 0) : gibbous ? 0 : 1;

    litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`;
  }

  const classes = ['moon-phase-svg', isFull ? 'moon-phase-full' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={classes}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {showDetail && (isFull || litPath) && (
        <defs>
          <clipPath id={clipId}>
            {isFull ? <circle cx={cx} cy={cy} r={r} /> : <path d={litPath!} />}
          </clipPath>
        </defs>
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="rgba(15, 23, 42, 0.85)"
        stroke="rgba(203, 213, 225, 0.38)"
        strokeWidth={showDetail ? 1.1 : 1.4}
      />
      {isFull && (
        <circle cx={cx} cy={cy} r={r} fill="#e2e8f0" stroke="#f8fafc" strokeWidth="0.8" />
      )}
      {litPath && <path d={litPath} fill="#e2e8f0" />}
      {showDetail && (isFull || litPath) && (
        <g clipPath={`url(#${clipId})`} opacity="0.16" fill="#475569">
          <circle cx="9.2" cy="9.4" r="2.2" />
          <circle cx="15.2" cy="10.8" r="1.7" />
          <circle cx="11.6" cy="15.2" r="2.5" />
          <circle cx="15.6" cy="15.4" r="1.2" />
        </g>
      )}
    </svg>
  );
}
