import type { CalendarEvent } from '../../../shared/types';

export type EventDelightKind =
  | 'birthday'
  | 'holiday'
  | 'travel'
  | 'outdoors'
  | 'sports'
  | 'music'
  | 'food'
  | 'health'
  | 'school';

export interface EventDelight {
  kind: EventDelightKind;
  isCelebration: boolean;
}

interface DelightRule {
  kind: EventDelightKind;
  isCelebration: boolean;
  pattern: RegExp;
}

const DELIGHT_RULES: DelightRule[] = [
  {
    kind: 'birthday',
    isCelebration: true,
    pattern: /\b(birthday|b-?day|anniversary|party|celebrat\w*|graduation|wedding|baby shower)\b/i,
  },
  {
    kind: 'holiday',
    isCelebration: true,
    pattern:
      /\b(thanksgiving|christmas|xmas|holiday|new year(?:'s)?|halloween|easter|hanukkah|chanukah|diwali|valentine(?:'s)?|independence day|4th of july|memorial day|labor day|mother'?s day|father'?s day)\b/i,
  },
  {
    kind: 'travel',
    isCelebration: false,
    pattern: /\b(flight|airport|vacation|road ?trip|getaway|hotel|airbnb|fly to|depart|trip to)\b/i,
  },
  {
    kind: 'outdoors',
    isCelebration: false,
    pattern: /\b(hike|hiking|trail|ski|skiing|snowboard|camp|camping|kayak|rafting|mountain|park)\b/i,
  },
  {
    kind: 'sports',
    isCelebration: false,
    pattern:
      /\b(soccer|basketball|baseball|softball|football|tennis|swim\w*|volleyball|lacrosse|hockey|track|practice|tournament|game|match|gym|yoga|workout)\b/i,
  },
  {
    kind: 'music',
    isCelebration: false,
    pattern:
      /\b(piano|guitar|violin|cello|drums|music|concert|recital|symphony|opera|choir|band|orchestra|ballet|dance|theater|theatre)\b/i,
  },
  {
    kind: 'food',
    isCelebration: false,
    pattern:
      /\b(dinner|lunch|breakfast|brunch|coffee|farmers market|bbq|barbecue|potluck|picnic|tacos|pizza|enchilada|restaurant|supper)\b/i,
  },
  {
    kind: 'health',
    isCelebration: false,
    pattern:
      /\b(dentist|dental|doctor|dr\.|checkup|check-up|orthodont\w*|clinic|vet|veterinar\w*|therapy|physical|vaccine|optometrist|eye exam)\b/i,
  },
  {
    kind: 'school',
    isCelebration: false,
    pattern:
      /\b(school|teacher|parent-?teacher|pta|spirit day|field trip|class|exam|homework|science fair|assembly|preschool|kindergarten)\b/i,
  },
];

export function getEventDelight(title: string): EventDelight | null {
  for (const rule of DELIGHT_RULES) {
    if (rule.pattern.test(title)) {
      return { kind: rule.kind, isCelebration: rule.isCelebration };
    }
  }
  return null;
}

export function dayHasCelebration(events: CalendarEvent[]): boolean {
  return events.some((ev) => getEventDelight(ev.title)?.isCelebration === true);
}
