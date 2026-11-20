import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';

interface WeatherIconProps {
  code: number;
  isDay?: boolean;
  size?: number;
  className?: string;
}

export function WeatherIcon({ code, isDay = true, size = 24, className }: WeatherIconProps) {
  const props = { size, strokeWidth: 1.85, className };

  if (code === 0 || code === 1) {
    return isDay ? (
      <Sun {...props} color="#fbbf24" />
    ) : (
      <Moon {...props} color="#cbd5e1" />
    );
  }
  if (code === 2) {
    return isDay ? (
      <CloudSun {...props} color="#fcd34d" />
    ) : (
      <CloudMoon {...props} color="#94a3b8" />
    );
  }
  if (code === 3) {
    return <Cloud {...props} color="#94a3b8" />;
  }
  if (code === 45 || code === 48) {
    return <CloudFog {...props} color="#94a3b8" />;
  }
  if (code >= 51 && code <= 57) {
    return <CloudDrizzle {...props} color="#7dd3fc" />;
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain {...props} color="#38bdf8" />;
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return <CloudSnow {...props} color="#e0f2fe" />;
  }
  if (code >= 95) {
    return <CloudLightning {...props} color="#f59e0b" />;
  }

  return <Cloud {...props} color="#94a3b8" />;
}
