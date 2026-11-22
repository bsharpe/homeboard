import type { HolidayId } from '../utils/holidays';

interface HolidayAnimationProps {
  holiday: HolidayId;
}

export function HolidayAnimation({ holiday }: HolidayAnimationProps) {
  switch (holiday) {
    case 'halloween':
      return (
        <div className="holiday-scene holiday-scene-halloween" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Tiny drifting bats */}
            <path
              d="M14 14c2-2.5 4.5-2.5 6 0 1.5-2.5 4-2.5 6 0-2.2.8-3.8 1.5-6 3-2.2-1.5-3.8-2.2-6-3Z"
              fill="#a78bfa"
              opacity="0.7"
              className="hol-bat-1"
            />
            <path
              d="M34 8c1.5-1.8 3.2-1.8 4.4 0 1.2-1.8 2.9-1.8 4.4 0-1.6.6-2.8 1.1-4.4 2.2-1.6-1.1-2.8-1.6-4.4-2.2Z"
              fill="#c4b5fd"
              opacity="0.55"
              className="hol-bat-2"
            />
            {/* Glowing Jack-o'-Lantern */}
            <g className="hol-pumpkin">
              <ellipse cx="56" cy="46" rx="16" ry="13" fill="rgba(249, 115, 22, 0.22)" className="hol-candle-glow" />
              <path d="M55 30c0-3 2-5 4-5" stroke="#4ade80" strokeWidth="2.4" strokeLinecap="round" />
              <ellipse cx="56" cy="46" rx="13" ry="11" fill="#ea580c" stroke="#fb923c" strokeWidth="1.2" />
              <ellipse cx="56" cy="46" rx="6.5" ry="10.6" fill="none" stroke="rgba(124, 45, 18, 0.45)" strokeWidth="1.2" />
              {/* Flickering eyes & grin */}
              <g className="hol-candle-flicker" fill="#fef08a">
                <polygon points="50,43 53,40 54,44" />
                <polygon points="62,43 59,40 58,44" />
                <path d="M49.5 49.5q3 3.2 6.5 3.2t6.5-3.2l-2 1.2-2-1.3-2.5 1.4-2.5-1.4-2 1.3Z" />
              </g>
            </g>
          </svg>
        </div>
      );

    case 'thanksgiving':
      return (
        <div className="holiday-scene holiday-scene-thanksgiving" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Falling swaying autumn leaves */}
            <g className="hol-leaf hol-leaf-1">
              <path
                d="M24 14c4 1 6 5 4 9-4 1-7-2-8-6 1-2 2-3 4-3Z"
                fill="#f59e0b"
                opacity="0.8"
              />
              <path d="M22 15l5 7" stroke="#fde68a" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            <g className="hol-leaf hol-leaf-2">
              <path
                d="M52 10c5 2 7 6 4 10-5 1-8-2-9-6 1-2 3-4 5-4Z"
                fill="#ea580c"
                opacity="0.82"
              />
              <path d="M50 12l5 7" stroke="#fed7aa" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            <g className="hol-leaf hol-leaf-3">
              <path
                d="M64 26c4 1 6 4 4 8-4 1-7-1-8-5 1-2 2-3 4-3Z"
                fill="#ef4444"
                opacity="0.72"
              />
              <path d="M62 27l4 6" stroke="#fecaca" strokeWidth="0.8" strokeLinecap="round" />
            </g>
            {/* Warm harvest wheat / leaf cluster in corner */}
            <path
              d="M56 58c1-9 5-15 11-20"
              stroke="#d97706"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.65"
            />
            <ellipse cx="64" cy="44" rx="4.5" ry="2.2" transform="rotate(-32 64 44)" fill="#f59e0b" opacity="0.65" />
            <ellipse cx="60" cy="49" rx="4.5" ry="2.2" transform="rotate(-25 60 49)" fill="#ea580c" opacity="0.6" />
          </svg>
        </div>
      );

    case 'christmas':
      return (
        <div className="holiday-scene holiday-scene-christmas" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Gentle snowflakes */}
            <circle cx="18" cy="14" r="1.5" fill="#e0f2fe" className="hol-flake hol-flake-1" />
            <circle cx="34" cy="10" r="1.2" fill="#bae6fd" className="hol-flake hol-flake-2" />
            <circle cx="26" cy="24" r="1.3" fill="#e0f2fe" className="hol-flake hol-flake-3" />
            {/* Evergreen tree */}
            <rect x="55" y="52" width="4" height="7" rx="1" fill="#92400e" />
            <polygon points="57,17 44,36 70,36" fill="#15803d" stroke="#22c55e" strokeWidth="0.9" />
            <polygon points="57,26 41,45 73,45" fill="#166534" stroke="#22c55e" strokeWidth="0.9" />
            <polygon points="57,34 39,54 75,54" fill="#14532d" stroke="#22c55e" strokeWidth="0.9" />
            {/* Glowing star */}
            <polygon
              points="57,11 58.6,14.8 62.6,15.1 59.5,17.6 60.5,21.5 57,19.4 53.5,21.5 54.5,17.6 51.4,15.1 55.4,14.8"
              fill="#fde047"
              className="hol-star-glow"
            />
            {/* Twinkling fairy lights */}
            <circle cx="53" cy="32" r="1.6" fill="#fb7185" className="hol-light hol-light-1" />
            <circle cx="62" cy="34" r="1.6" fill="#fde047" className="hol-light hol-light-2" />
            <circle cx="49" cy="42" r="1.7" fill="#38bdf8" className="hol-light hol-light-3" />
            <circle cx="58" cy="43" r="1.7" fill="#fb7185" className="hol-light hol-light-1" />
            <circle cx="66" cy="49" r="1.6" fill="#fde047" className="hol-light hol-light-2" />
            <circle cx="47" cy="50" r="1.6" fill="#34d399" className="hol-light hol-light-3" />
          </svg>
        </div>
      );

    case 'new-years':
    case 'independence': {
      const c1 = holiday === 'independence' ? '#fb7185' : '#fde047';
      const c2 = holiday === 'independence' ? '#f8fafc' : '#38bdf8';
      const c3 = holiday === 'independence' ? '#38bdf8' : '#f472b6';
      return (
        <div className={`holiday-scene holiday-scene-${holiday}`} aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Firework burst 1 */}
            <g className="hol-firework hol-firework-1" style={{ transformOrigin: '56px 26px' }} stroke={c1} strokeWidth="1.6" strokeLinecap="round">
              <line x1="56" y1="15" x2="56" y2="20" />
              <line x1="56" y1="32" x2="56" y2="37" />
              <line x1="45" y1="26" x2="50" y2="26" />
              <line x1="62" y1="26" x2="67" y2="26" />
              <line x1="48" y1="18" x2="52" y2="22" />
              <line x1="60" y1="30" x2="64" y2="34" />
              <line x1="64" y1="18" x2="60" y2="22" />
              <line x1="52" y1="30" x2="48" y2="34" />
            </g>
            {/* Firework burst 2 */}
            <g className="hol-firework hol-firework-2" style={{ transformOrigin: '30px 42px' }} stroke={c2} strokeWidth="1.4" strokeLinecap="round">
              <line x1="30" y1="34" x2="30" y2="38" />
              <line x1="30" y1="46" x2="30" y2="50" />
              <line x1="22" y1="42" x2="26" y2="42" />
              <line x1="34" y1="42" x2="38" y2="42" />
              <line x1="24.5" y1="36.5" x2="27.2" y2="39.2" />
              <line x1="32.8" y1="44.8" x2="35.5" y2="47.5" />
              <line x1="35.5" y1="36.5" x2="32.8" y2="39.2" />
              <line x1="27.2" y1="44.8" x2="24.5" y2="47.5" />
            </g>
            {/* Sparkle accents */}
            <circle cx="64" cy="48" r="1.6" fill={c3} className="hol-star-glow" />
            <circle cx="42" cy="14" r="1.3" fill={c3} className="hol-star-glow" />
          </svg>
        </div>
      );
    }

    case 'valentines':
      return (
        <div className="holiday-scene holiday-scene-valentines" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            <path
              d="M58 50c-6-5-11-9-11-14a5.5 5.5 0 0 1 11-1.2A5.5 5.5 0 0 1 69 36c0 5-5 9-11 14Z"
              fill="rgba(251, 113, 133, 0.72)"
              className="hol-heart hol-heart-1"
            />
            <path
              d="M36 42c-4-3.2-7-6-7-9.2a3.6 3.6 0 0 1 7-.8 3.6 3.6 0 0 1 7 .8c0 3.2-3 6-7 9.2Z"
              fill="rgba(244, 114, 182, 0.65)"
              className="hol-heart hol-heart-2"
            />
            <path
              d="M66 26c-2.6-2-4.6-3.8-4.6-6a2.4 2.4 0 0 1 4.6-.5 2.4 2.4 0 0 1 4.6.5c0 2.2-2 4-4.6 6Z"
              fill="rgba(253, 164, 175, 0.75)"
              className="hol-heart hol-heart-3"
            />
          </svg>
        </div>
      );

    case 'st-patricks':
      return (
        <div className="holiday-scene holiday-scene-st-patricks" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            <g className="hol-shamrock" style={{ transformOrigin: '56px 46px' }}>
              <circle cx="56" cy="34" r="6" fill="#22c55e" opacity="0.78" />
              <circle cx="49" cy="43" r="6" fill="#16a34a" opacity="0.78" />
              <circle cx="63" cy="43" r="6" fill="#34d399" opacity="0.78" />
              <path d="M56 44c0 6-2 10-5 13" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" />
            </g>
            <circle cx="40" cy="22" r="1.5" fill="#fde047" className="hol-star-glow" />
            <circle cx="68" cy="24" r="1.2" fill="#fde047" className="hol-star-glow" />
          </svg>
        </div>
      );

    case 'easter':
      return (
        <div className="holiday-scene holiday-scene-easter" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            <g className="hol-egg" style={{ transformOrigin: '56px 54px' }}>
              <path
                d="M56 26c6.5 0 11 9.5 11 17.5S62.5 56 56 56s-11-4.5-11-12.5S49.5 26 56 26Z"
                fill="rgba(167, 139, 250, 0.62)"
                stroke="#c4b5fd"
                strokeWidth="1.2"
              />
              <path d="M46 41c3.5-2.5 6.5 2.5 10 0s6.5 2.5 10 0" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />
              <path d="M47 48c3 2 6-2 9 0s6-2 9 0" stroke="#f9a8d4" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle cx="38" cy="22" r="1.6" fill="#fde68a" className="hol-star-glow" />
          </svg>
        </div>
      );

    case 'spring-equinox':
      return (
        <div className="holiday-scene holiday-scene-spring-equinox" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Soft rising sun at equinox horizon */}
            <circle cx="56" cy="48" r="15" fill="rgba(253, 224, 71, 0.16)" className="hol-sun-pulse" />
            <path d="M44 48a12 12 0 0 1 24 0Z" fill="#fde047" opacity="0.82" />
            {/* Horizon line */}
            <line x1="28" y1="48" x2="74" y2="48" stroke="#6ee7b7" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
            {/* Fresh spring sprout & leaves */}
            <g className="hol-sprout" style={{ transformOrigin: '42px 54px' }}>
              <path d="M42 54c0-7 1.5-13 4-18" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M43 44c-6-1-9-5-8-9 4-1 8 2 9 7" fill="#4ade80" opacity="0.85" />
              <path d="M44.5 39c5-2 9-1 10 3-3 3-7 3-10 0" fill="#34d399" opacity="0.85" />
            </g>
            {/* Drifting spring blossom petals */}
            <ellipse cx="26" cy="20" rx="3.2" ry="1.8" transform="rotate(-24 26 20)" fill="#f9a8d4" opacity="0.85" className="hol-petal hol-petal-1" />
            <ellipse cx="62" cy="16" rx="2.8" ry="1.6" transform="rotate(28 62 16)" fill="#fbcfe8" opacity="0.8" className="hol-petal hol-petal-2" />
            <ellipse cx="48" cy="12" rx="2.4" ry="1.4" transform="rotate(-14 48 12)" fill="#f9a8d4" opacity="0.75" className="hol-petal hol-petal-3" />
          </svg>
        </div>
      );

    case 'summer-solstice':
      return (
        <div className="holiday-scene holiday-scene-summer-solstice" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Warm golden corona */}
            <circle cx="56" cy="36" r="20" fill="rgba(251, 191, 36, 0.16)" className="hol-sun-pulse" />
            <circle cx="56" cy="36" r="14" fill="rgba(251, 146, 60, 0.22)" className="hol-sun-pulse" />
            {/* Rotating sunburst rays */}
            <g className="hol-sun-spin" style={{ transformOrigin: '56px 36px' }} stroke="#fde047" strokeWidth="1.8" strokeLinecap="round">
              <line x1="56" y1="15" x2="56" y2="21" />
              <line x1="56" y1="51" x2="56" y2="57" />
              <line x1="35" y1="36" x2="41" y2="36" />
              <line x1="71" y1="36" x2="77" y2="36" />
              <line x1="41.2" y1="21.2" x2="45.4" y2="25.4" />
              <line x1="66.6" y1="46.6" x2="70.8" y2="50.8" />
              <line x1="70.8" y1="21.2" x2="66.6" y2="25.4" />
              <line x1="45.4" y1="46.6" x2="41.2" y2="50.8" />
            </g>
            {/* Radiant sun disc */}
            <circle cx="56" cy="36" r="9.5" fill="#fbbf24" stroke="#fef08a" strokeWidth="1.4" />
            {/* Sunbeam sparkles */}
            <circle cx="28" cy="20" r="1.5" fill="#fde047" className="hol-star-glow" />
            <circle cx="34" cy="48" r="1.3" fill="#fb923c" className="hol-star-glow" />
          </svg>
        </div>
      );

    case 'autumn-equinox':
      return (
        <div className="holiday-scene holiday-scene-autumn-equinox" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Balanced equinox sun & twilight reflection */}
            <circle cx="56" cy="44" r="15" fill="rgba(245, 158, 11, 0.16)" className="hol-sun-pulse" />
            <path d="M44 44a12 12 0 0 1 24 0Z" fill="#f59e0b" opacity="0.82" />
            <path d="M44 44a12 12 0 0 0 24 0Z" fill="#6366f1" opacity="0.48" />
            <line x1="32" y1="44" x2="74" y2="44" stroke="#fcd34d" strokeWidth="1.3" strokeLinecap="round" opacity="0.78" />
            {/* Falling swaying autumn leaves */}
            <g className="hol-leaf hol-leaf-1">
              <path d="M26 14c4 1 6 5 4 9-4 1-7-2-8-6 1-2 2-3 4-3Z" fill="#f59e0b" opacity="0.82" />
              <path d="M24 15l5 7" stroke="#fde68a" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            <g className="hol-leaf hol-leaf-2">
              <path d="M46 10c4.5 1.5 6.5 5.5 3.8 9.2-4.5 1-7.5-2-8.2-5.8 1-2 2.4-3.4 4.4-3.4Z" fill="#ea580c" opacity="0.8" />
              <path d="M44.5 11.5l4.5 6.5" stroke="#fed7aa" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            {/* Dusk star */}
            <circle cx="67" cy="22" r="1.4" fill="#c7d2fe" className="hol-star-glow" />
          </svg>
        </div>
      );

    case 'winter-solstice':
      return (
        <div className="holiday-scene holiday-scene-winter-solstice" aria-hidden="true">
          <svg viewBox="0 0 80 64" fill="none" className="holiday-svg">
            {/* Crisp crescent moon for longest night */}
            <path
              d="M36 16a9.5 9.5 0 1 0 10.5 13.8A7.6 7.6 0 1 1 36 16Z"
              fill="#fef08a"
              opacity="0.78"
              className="hol-moon-rock"
              style={{ transformOrigin: '36px 24px' }}
            />
            {/* Twinkling winter stars */}
            <circle cx="20" cy="18" r="1.3" fill="#e0f2fe" className="hol-star-glow" />
            <circle cx="66" cy="16" r="1.5" fill="#bae6fd" className="hol-star-glow" />
            {/* Geometric 6-point winter crystal */}
            <g className="hol-crystal-glow" style={{ transformOrigin: '58px 42px' }} stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round">
              <line x1="58" y1="29" x2="58" y2="55" />
              <line x1="46.7" y1="35.5" x2="69.3" y2="48.5" />
              <line x1="69.3" y1="35.5" x2="46.7" y2="48.5" />
              <path d="M55.5 32.5L58 35l2.5-2.5M55.5 51.5L58 49l2.5 2.5" strokeWidth="1.1" />
              <circle cx="58" cy="42" r="2.2" fill="#e0f2fe" stroke="none" />
            </g>
            {/* Gentle winter flurries */}
            <circle cx="26" cy="34" r="1.3" fill="#e0f2fe" className="hol-flake hol-flake-1" />
            <circle cx="42" cy="30" r="1.1" fill="#bae6fd" className="hol-flake hol-flake-2" />
          </svg>
        </div>
      );
  }
}
