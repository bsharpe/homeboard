import {
  Cake,
  GraduationCap,
  Mountain,
  Music,
  Plane,
  Sparkles,
  Stethoscope,
  Trophy,
  Utensils,
} from 'lucide-react';
import type { EventDelightKind } from '../utils/eventDelight';

interface EventDelightIconProps {
  kind: EventDelightKind;
  size?: number;
}

export function EventDelightIcon({ kind, size = 12 }: EventDelightIconProps) {
  const props = { size, strokeWidth: 2, className: `event-delight-icon event-delight-${kind}` };

  switch (kind) {
    case 'birthday':
      return <Cake {...props} />;
    case 'holiday':
      return <Sparkles {...props} />;
    case 'travel':
      return <Plane {...props} />;
    case 'outdoors':
      return <Mountain {...props} />;
    case 'sports':
      return <Trophy {...props} />;
    case 'music':
      return <Music {...props} />;
    case 'food':
      return <Utensils {...props} />;
    case 'health':
      return <Stethoscope {...props} />;
    case 'school':
      return <GraduationCap {...props} />;
  }
}
