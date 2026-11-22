export function getContrastTextColor(hex: string): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return '#090d16';
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.52 ? '#090d16' : '#ffffff';
}

export function getCalendarAbbrev(name: string, custom?: string): string {
  if (custom && custom.trim()) return custom.trim().slice(0, 2).toUpperCase();
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '•';
}
