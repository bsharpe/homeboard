export type CalendarGridMode = 'rolling-4w' | 'month';
export type TemperatureUnit = 'fahrenheit' | 'celsius';
export type BoardTheme = 'dark' | 'light' | 'auto';
export type WeatherProvider = 'open-meteo' | 'tempest';
export type BoardSlideId = 'calendar' | 'stocks' | 'world-clock' | 'forecast-radar';
export type CloudModuleId = 'weather' | 'alerts' | 'aqi' | 'market';

export interface WorldClockCity {
  id: string;
  name: string;
  timezone: string;
  subtitle?: string;
}
export type WeatherAlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
export type AirQualityCategory =
  | 'Good'
  | 'Moderate'
  | 'Sensitive'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export interface CalendarFeedConfig {
  id: string;
  name: string;
  url: string;
  color: string;
  abbreviation?: string;
  enabled: boolean;
}

export interface WeatherLocationConfig {
  provider: WeatherProvider;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  unit: TemperatureUnit;
  tempestToken?: string;
  tempestStationId?: number;
}

export interface DisplayConfig {
  title: string;
  gridMode: CalendarGridMode;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  clockFormat: '12h' | '24h';
  showSeconds: boolean;
  showHourlyWeather: boolean;
  agendaDays: number;
  demoMode: boolean;
  nightDimEnabled: boolean;
  nightDimStartHour: number; // 0-23
  nightDimEndHour: number;   // 0-23
  nightDimOpacity: number;   // 0.15 - 1.0
  burnInShift: boolean;
  theme: BoardTheme;
  seasonalAccents: boolean;
  ambientWeather: boolean;
  calendarWeather: boolean;
  rotationEnabled?: boolean;
  rotationIntervalSeconds?: number;
  rotationSlides?: BoardSlideId[];
  worldClockCities?: WorldClockCity[];
}

export interface RefreshConfig {
  calendarMinutes: number;
  weatherMinutes: number;
}

export interface CloudModulesConfig {
  weather: boolean;
  alerts: boolean;
  aqi: boolean;
  market: boolean;
  marketSymbols: string[];
}

export interface CloudConfig {
  enabled: boolean;
  endpointUrl: string;
  apiKey?: string;
  pollSeconds: number;
  modules: CloudModulesConfig;
}

export interface AppConfig {
  weather: WeatherLocationConfig;
  display: DisplayConfig;
  refresh: RefreshConfig;
  calendars: CalendarFeedConfig[];
  cloud?: CloudConfig;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string or YYYY-MM-DD for allDay
  end: string;   // ISO string or YYYY-MM-DD (exclusive) for allDay
  allDay: boolean;
  location?: string;
  description?: string;
  calendarId: string;
  calendarName: string;
  calendarAbbrev?: string;
  color: string;
}

export interface CalendarSyncStatus {
  id: string;
  name: string;
  abbreviation?: string;
  color: string;
  enabled: boolean;
  ok: boolean;
  eventCount: number;
  lastSyncedAt: string | null;
  error?: string;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  uvIndex: number;
  precipToday?: number;
  pressureTrend?: string;
  lightningCount?: number;
  lightningLastDist?: number;
}

export interface HourlyForecastItem {
  time: string; // ISO string in local time
  temperature: number;
  weatherCode: number;
  condition: string;
  precipitationProbability: number;
  isDay: boolean;
}

export interface DailyForecastItem {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  condition: string;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  source?: WeatherProvider;
  locationName: string;
  unit: TemperatureUnit;
  timezone: string;
  fetchedAt: string;
  stale: boolean;
  current: CurrentWeather;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
}

export interface MarketQuote {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: number;
  tradingDate: string; // YYYY-MM-DD (America/New_York)
  isMarketOpen: boolean;
}

export interface MarketData {
  fetchedAt: string;
  stale: boolean;
  isMarketOpen: boolean;
  tradingDate: string;
  quotes: MarketQuote[];
}

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  severity: WeatherAlertSeverity;
  urgency?: string;
  startsAt?: string;
  expiresAt?: string;
  areaDesc?: string;
}

export interface AirQualityData {
  usAqi: number;
  category: AirQualityCategory;
  pm25?: number;
  pm10?: number;
  ozone?: number;
  fetchedAt: string;
}

export interface CloudSnapshotRequest {
  include: CloudModuleId[];
  location: {
    name: string;
    lat: number;
    lon: number;
    timezone: string;
    unit: TemperatureUnit;
    tempestStationId?: number;
  };
  market?: {
    symbols: string[];
  };
  force?: boolean;
}

export interface CloudSnapshotResponse {
  schemaVersion: 1;
  generatedAt: string;
  weather?: WeatherData;
  alerts?: WeatherAlert[];
  aqi?: AirQualityData | null;
  market?: MarketData;
  errors?: Partial<Record<CloudModuleId, string>>;
}

export interface BoardPayload {
  serverTime: string;
  timezone: string;
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  display: DisplayConfig;
  weather: WeatherData | null;
  weatherError?: string;
  weatherAlerts?: WeatherAlert[];
  airQuality?: AirQualityData | null;
  market: MarketData | null;
  events: CalendarEvent[];
  calendarStatus: CalendarSyncStatus[];
  usingDemoData: boolean;
  lastCalendarSyncAt: string | null;
  cloudEnabled?: boolean;
  cloudError?: string;
}

export interface GeocodingResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface TempestStationSummary {
  stationId: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
