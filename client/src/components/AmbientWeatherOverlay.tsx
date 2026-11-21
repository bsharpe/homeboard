import type { ResolvedTheme, SkyPhase, WeatherMood } from '../utils/atmosphere';

interface AmbientWeatherOverlayProps {
  mood: WeatherMood;
  skyPhase: SkyPhase;
  theme: ResolvedTheme;
}

// Deterministic particle positions so renders stay pure and zero-allocation
const RAIN_STREAKS = [
  { left: 6, delay: 0.0, dur: 1.5 },
  { left: 12, delay: 0.7, dur: 1.35 },
  { left: 19, delay: 0.3, dur: 1.6 },
  { left: 26, delay: 1.1, dur: 1.4 },
  { left: 33, delay: 0.2, dur: 1.55 },
  { left: 41, delay: 0.9, dur: 1.3 },
  { left: 48, delay: 0.5, dur: 1.65 },
  { left: 55, delay: 1.2, dur: 1.45 },
  { left: 62, delay: 0.1, dur: 1.5 },
  { left: 70, delay: 0.8, dur: 1.35 },
  { left: 77, delay: 0.4, dur: 1.6 },
  { left: 84, delay: 1.0, dur: 1.4 },
  { left: 91, delay: 0.6, dur: 1.55 },
  { left: 96, delay: 0.25, dur: 1.45 },
];

const SNOW_FLAKES = [
  { left: 5, size: 4, delay: 0.0, dur: 11 },
  { left: 13, size: 3, delay: 3.2, dur: 13 },
  { left: 21, size: 5, delay: 1.4, dur: 10 },
  { left: 29, size: 3, delay: 5.5, dur: 14 },
  { left: 37, size: 4, delay: 2.1, dur: 12 },
  { left: 45, size: 3, delay: 6.8, dur: 13 },
  { left: 53, size: 5, delay: 0.8, dur: 11 },
  { left: 61, size: 3, delay: 4.1, dur: 14 },
  { left: 69, size: 4, delay: 7.4, dur: 12 },
  { left: 77, size: 5, delay: 1.9, dur: 10.5 },
  { left: 85, size: 3, delay: 5.0, dur: 13.5 },
  { left: 93, size: 4, delay: 2.8, dur: 11.5 },
];

const NIGHT_STARS = [
  { left: 8, top: 6, size: 2, delay: 0 },
  { left: 17, top: 14, size: 1.5, delay: 1.2 },
  { left: 29, top: 5, size: 2, delay: 2.5 },
  { left: 43, top: 11, size: 1.5, delay: 0.7 },
  { left: 58, top: 7, size: 2, delay: 3.1 },
  { left: 72, top: 4, size: 1.5, delay: 1.8 },
  { left: 84, top: 12, size: 2, delay: 2.2 },
  { left: 92, top: 6, size: 1.5, delay: 0.4 },
];

export function AmbientWeatherOverlay({
  mood,
  skyPhase,
  theme,
}: AmbientWeatherOverlayProps) {
  if (mood === 'rain' || mood === 'storm') {
    return (
      <div
        className={`ambient-overlay ambient-rain ${mood === 'storm' ? 'ambient-storm' : ''}`}
        aria-hidden="true"
      >
        {RAIN_STREAKS.map((drop, i) => (
          <span
            key={i}
            className="ambient-rain-drop"
            style={{
              left: `${drop.left}%`,
              animationDelay: `${drop.delay}s`,
              animationDuration: `${drop.dur}s`,
            }}
          />
        ))}
        {mood === 'storm' && <div className="ambient-lightning-flash" />}
      </div>
    );
  }

  if (mood === 'snow') {
    return (
      <div className="ambient-overlay ambient-snow" aria-hidden="true">
        {SNOW_FLAKES.map((flake, i) => (
          <span
            key={i}
            className="ambient-snow-flake"
            style={{
              left: `${flake.left}%`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              animationDelay: `${flake.delay}s`,
              animationDuration: `${flake.dur}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (mood === 'fog') {
    return (
      <div className="ambient-overlay ambient-fog" aria-hidden="true">
        <div className="ambient-fog-band ambient-fog-band-1" />
        <div className="ambient-fog-band ambient-fog-band-2" />
      </div>
    );
  }

  if (mood === 'clear' && skyPhase === 'night' && theme === 'dark') {
    return (
      <div className="ambient-overlay ambient-stars" aria-hidden="true">
        {NIGHT_STARS.map((star, i) => (
          <span
            key={i}
            className="ambient-star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}
