import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Cloud,
  CloudSun,
  Globe,
  HelpCircle,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  AppConfig,
  BoardSlideId,
  CalendarFeedConfig,
  CloudConfig,
  GeocodingResult,
  TempestStationSummary,
  WorldClockCity,
} from '../../../shared/types';

const DEFAULT_ROTATION_SLIDES_UI: BoardSlideId[] = [
  'calendar',
  'stocks',
  'world-clock',
  'forecast-radar',
];

const DEFAULT_WORLD_CLOCK_CITIES_UI: WorldClockCity[] = [
  { id: 'santa-fe', name: 'Santa Fe', timezone: 'America/Denver', subtitle: 'New Mexico' },
  { id: 'memphis', name: 'Memphis', timezone: 'America/Chicago', subtitle: 'Tennessee' },
  { id: 'miami', name: 'Miami', timezone: 'America/New_York', subtitle: 'Florida' },
];

const SLIDE_OPTIONS: Array<{ id: BoardSlideId; label: string }> = [
  { id: 'calendar', label: 'Calendar + Upcoming Agenda' },
  { id: 'stocks', label: 'Stocks / Market Indices' },
  { id: 'world-clock', label: 'World Clock' },
  { id: 'forecast-radar', label: '5-Day Forecast + Live Radar' },
];

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

const DEFAULT_CLOUD_UI: CloudConfig = {
  enabled: false,
  endpointUrl: '',
  pollSeconds: 120,
  modules: {
    weather: true,
    alerts: true,
    aqi: true,
    market: true,
    marketSymbols: ['SPY', 'QQQ'],
  },
};

interface SettingsPageProps {
  onBack: () => void;
}

const COLOR_SWATCHES = [
  '#f59e0b', // Amber / Terracotta
  '#38bdf8', // Turquoise Sky
  '#34d399', // Sage Emerald
  '#f472b6', // Desert Rose
  '#a78bfa', // Lavender
  '#fb7185', // Coral
  '#22d3ee', // Cyan
  '#facc15', // Sun Gold
];

interface TestResult {
  ok: boolean;
  message: string;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showIcsHelp, setShowIcsHelp] = useState(false);

  // Location search
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<GeocodingResult[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);

  // Tempest station discovery & test
  const [tempestStations, setTempestStations] = useState<TempestStationSummary[]>([]);
  const [discoveringStations, setDiscoveringStations] = useState(false);
  const [testingTempest, setTestingTempest] = useState(false);
  const [tempestStatus, setTempestStatus] = useState<TestResult | null>(null);

  // Cloud Data Hub test & symbol input
  const [testingCloud, setTestingCloud] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<TestResult | null>(null);
  const [symbolsInput, setSymbolsInput] = useState('SPY, QQQ');

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: AppConfig) => {
        setConfig(data);
        setSymbolsInput((data.cloud?.modules?.marketSymbols ?? ['SPY', 'QQQ']).join(', '));
      })
      .catch(() => setErrorMessage('Could not load settings from server.'));
  }, []);

  if (!config) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <p>{errorMessage ?? 'Loading settings…'}</p>
        </div>
      </div>
    );
  }

  const updateCalendar = (id: string, patch: Partial<CalendarFeedConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        calendars: prev.calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      };
    });
  };

  const addCalendar = () => {
    const nextColor = COLOR_SWATCHES[config.calendars.length % COLOR_SWATCHES.length];
    const newCal: CalendarFeedConfig = {
      id: `cal-${Date.now()}`,
      name: '',
      url: '',
      color: nextColor,
      enabled: true,
    };
    setConfig((prev) => (prev ? { ...prev, calendars: [...prev.calendars, newCal] } : prev));
  };

  const removeCalendar = (id: string) => {
    setConfig((prev) =>
      prev ? { ...prev, calendars: prev.calendars.filter((c) => c.id !== id) } : prev
    );
  };

  const testCalendar = async (cal: CalendarFeedConfig) => {
    if (!cal.url.trim()) {
      setTestResults((prev) => ({
        ...prev,
        [cal.id]: { ok: false, message: 'Paste an ICS URL first.' },
      }));
      return;
    }
    setTestingId(cal.id);
    try {
      const res = await fetch('/api/calendars/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cal.url, name: cal.name }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        eventCount?: number;
        sampleTitles?: string[];
        error?: string;
      };
      if (data.ok) {
        const sample =
          data.sampleTitles && data.sampleTitles.length > 0
            ? ` (e.g. "${data.sampleTitles[0]}")`
            : '';
        setTestResults((prev) => ({
          ...prev,
          [cal.id]: {
            ok: true,
            message: `Connected! Found ${data.eventCount ?? 0} events in window${sample}`,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [cal.id]: { ok: false, message: data.error ?? 'Failed to load feed' },
        }));
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [cal.id]: { ok: false, message: 'Network error testing feed.' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleCitySearch = async () => {
    if (cityQuery.trim().length < 2) return;
    setSearchingCity(true);
    try {
      const res = await fetch(`/api/weather/search?q=${encodeURIComponent(cityQuery.trim())}`);
      const data = (await res.json()) as { results?: GeocodingResult[] };
      setCityResults(data.results ?? []);
    } catch {
      setCityResults([]);
    } finally {
      setSearchingCity(false);
    }
  };

  const selectCity = (city: GeocodingResult) => {
    const label = [city.name, city.admin1].filter(Boolean).join(', ');
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            weather: {
              ...prev.weather,
              name: label,
              latitude: city.latitude,
              longitude: city.longitude,
              timezone: city.timezone,
            },
          }
        : prev
    );
    setCityResults([]);
    setCityQuery('');
  };

  const handleDiscoverTempestStations = async () => {
    const token = config.weather.tempestToken?.trim();
    if (!token) {
      setTempestStatus({ ok: false, message: 'Paste your Tempest Personal Access Token first.' });
      return;
    }
    setDiscoveringStations(true);
    setTempestStatus(null);
    try {
      const res = await fetch('/api/weather/tempest/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as {
        stations?: TempestStationSummary[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const list = data.stations ?? [];
      setTempestStations(list);
      if (list.length === 0) {
        setTempestStatus({ ok: false, message: 'No stations found on this Tempest account.' });
      } else if (list.length === 1) {
        selectTempestStation(list[0]);
        setTempestStatus({
          ok: true,
          message: `Found station "${list[0].name}" (ID ${list[0].stationId})`,
        });
      }
    } catch (err: unknown) {
      setTempestStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'Could not load Tempest stations.',
      });
    } finally {
      setDiscoveringStations(false);
    }
  };

  const selectTempestStation = (station: TempestStationSummary) => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            weather: {
              ...prev.weather,
              provider: 'tempest',
              tempestStationId: station.stationId,
              name: station.name,
              latitude: station.latitude,
              longitude: station.longitude,
              timezone: station.timezone,
            },
          }
        : prev
    );
    setTempestStations([]);
  };

  const handleTestTempest = async () => {
    const token = config.weather.tempestToken?.trim();
    const stationId = config.weather.tempestStationId;
    if (!token || !stationId) {
      setTempestStatus({ ok: false, message: 'Enter both your Tempest token and Station ID.' });
      return;
    }
    setTestingTempest(true);
    setTempestStatus(null);
    try {
      const res = await fetch('/api/weather/tempest/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          stationId,
          unit: config.weather.unit,
          name: config.weather.name,
          timezone: config.weather.timezone,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        locationName?: string;
        temperature?: number;
        condition?: string;
        dailyCount?: number;
        error?: string;
      };
      if (data.ok) {
        const unitSym = config.weather.unit === 'celsius' ? '°C' : '°F';
        setTempestStatus({
          ok: true,
          message: `Connected! ${data.locationName}: ${data.temperature}${unitSym} · ${data.condition} (${data.dailyCount}-day hyperlocal forecast)`,
        });
      } else {
        setTempestStatus({ ok: false, message: data.error ?? 'Connection failed.' });
      }
    } catch {
      setTempestStatus({ ok: false, message: 'Network error testing Tempest station.' });
    } finally {
      setTestingTempest(false);
    }
  };

  const cloudConfig: CloudConfig = config.cloud ?? DEFAULT_CLOUD_UI;

  const updateCloud = (patch: Partial<CloudConfig>) => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            cloud: {
              ...(prev.cloud ?? DEFAULT_CLOUD_UI),
              ...patch,
            },
          }
        : prev
    );
  };

  const updateCloudModules = (patch: Partial<CloudConfig['modules']>) => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            cloud: {
              ...(prev.cloud ?? DEFAULT_CLOUD_UI),
              modules: {
                ...(prev.cloud?.modules ?? DEFAULT_CLOUD_UI.modules),
                ...patch,
              },
            },
          }
        : prev
    );
  };

  const handleTestCloud = async () => {
    if (!cloudConfig.endpointUrl.trim()) {
      setCloudStatus({ ok: false, message: 'Enter your Cloudflare Worker /v1/snapshot URL first.' });
      return;
    }
    setTestingCloud(true);
    setCloudStatus(null);
    try {
      const res = await fetch('/api/cloud/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather: config.weather, cloud: cloudConfig }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        weatherSource?: string;
        temperature?: number;
        alertsCount?: number;
        usAqi?: number | null;
        marketSymbols?: string[];
        error?: string;
      };
      if (data.ok) {
        const parts: string[] = [];
        if (data.weatherSource) {
          parts.push(`Weather: ${data.weatherSource} (${data.temperature ?? '?'}°)`);
        }
        if (typeof data.usAqi === 'number') {
          parts.push(`AQI ${data.usAqi}`);
        }
        if (typeof data.alertsCount === 'number') {
          parts.push(`${data.alertsCount} alert${data.alertsCount === 1 ? '' : 's'}`);
        }
        if (data.marketSymbols && data.marketSymbols.length > 0) {
          parts.push(`Market: ${data.marketSymbols.join(', ')}`);
        }
        setCloudStatus({
          ok: true,
          message: `Connected! ${parts.join(' · ') || 'Snapshot received.'}`,
        });
      } else {
        setCloudStatus({ ok: false, message: data.error ?? 'Cloud connection failed.' });
      }
    } catch {
      setCloudStatus({ ok: false, message: 'Network error testing Cloud Data Hub.' });
    } finally {
      setTestingCloud(false);
    }
  };

  const rotationSlides =
    config.display.rotationSlides && config.display.rotationSlides.length > 0
      ? config.display.rotationSlides
      : DEFAULT_ROTATION_SLIDES_UI;

  const worldClockCities =
    config.display.worldClockCities && config.display.worldClockCities.length > 0
      ? config.display.worldClockCities
      : DEFAULT_WORLD_CLOCK_CITIES_UI;

  const toggleRotationSlide = (slideId: BoardSlideId, checked: boolean) => {
    const next = checked
      ? DEFAULT_ROTATION_SLIDES_UI.filter((id) => id === slideId || rotationSlides.includes(id))
      : rotationSlides.filter((id) => id !== slideId);
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            display: {
              ...prev.display,
              rotationSlides: next.length > 0 ? next : ['calendar'],
            },
          }
        : prev
    );
  };

  const updateWorldClockCity = (id: string, patch: Partial<WorldClockCity>) => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            display: {
              ...prev.display,
              worldClockCities: worldClockCities.map((c) => (c.id === id ? { ...c, ...patch } : c)),
            },
          }
        : prev
    );
  };

  const addWorldClockCity = () => {
    const next: WorldClockCity = {
      id: `city-${Date.now()}`,
      name: '',
      timezone: 'America/New_York',
      subtitle: '',
    };
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            display: {
              ...prev.display,
              worldClockCities: [...worldClockCities, next],
            },
          }
        : prev
    );
  };

  const removeWorldClockCity = (id: string) => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            display: {
              ...prev.display,
              worldClockCities: worldClockCities.filter((c) => c.id !== id),
            },
          }
        : prev
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as AppConfig;
      setConfig(saved);
      setSaveMessage('Settings saved and board refreshed!');
      window.setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <header className="settings-header">
          <div className="settings-header-left">
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              <ArrowLeft size={16} /> Back to Board
            </button>
            <div>
              <h1>Homeboard Settings</h1>
              <p className="settings-subtitle">
                Configure family calendars, Santa Fe weather, and wall-display preferences.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save & Apply'}
          </button>
        </header>

        {saveMessage && <div className="banner banner-success">{saveMessage}</div>}
        {errorMessage && <div className="banner banner-error">{errorMessage}</div>}

        {/* Calendars Section */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <Calendar size={18} />
              <h2>Family Calendars (iCal / ICS)</h2>
            </div>
            <div className="settings-card-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowIcsHelp((v) => !v)}
              >
                <HelpCircle size={15} /> Where do I find ICS links?
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCalendar}>
                <Plus size={15} /> Add Calendar
              </button>
            </div>
          </div>

          {showIcsHelp && (
            <div className="ics-help-box">
              <p>
                <strong>Google Calendar:</strong> Open calendar.google.com → hover a calendar →{' '}
                <em>Settings and sharing</em> → scroll to <em>Integrate calendar</em> → copy{' '}
                <strong>Secret address in iCal format</strong>.
              </p>
              <p>
                <strong>Apple iCloud:</strong> Open icloud.com/calendar → click the share icon next
                to a calendar → enable <em>Public Calendar</em> → copy link (<code>webcal://</code>{' '}
                links are supported automatically).
              </p>
              <p>
                <strong>Outlook / Cozi:</strong> Go to Calendar sharing / publish settings and copy
                the <code>.ics</code> feed URL.
              </p>
            </div>
          )}

          {config.calendars.length === 0 ? (
            <div className="empty-calendars">
              <p>
                No calendar feeds configured yet. While empty, Homeboard displays sample Santa Fe
                family events when Demo Mode is enabled.
              </p>
              <button type="button" className="btn btn-secondary" onClick={addCalendar}>
                <Plus size={15} /> Add Your First Calendar
              </button>
            </div>
          ) : (
            <div className="calendar-feed-list">
              {config.calendars.map((cal) => {
                const test = testResults[cal.id];
                return (
                  <div key={cal.id} className="calendar-feed-row">
                    <div className="feed-row-top">
                      <label className="checkbox-inline" title="Enable/disable calendar">
                        <input
                          type="checkbox"
                          checked={cal.enabled}
                          onChange={(e) => updateCalendar(cal.id, { enabled: e.target.checked })}
                        />
                      </label>
                      <input
                        type="text"
                        className="input feed-name-input"
                        placeholder="Calendar name (e.g. Mom, Kids, Family)"
                        value={cal.name}
                        onChange={(e) => updateCalendar(cal.id, { name: e.target.value })}
                      />
                      <div className="swatch-row">
                        {COLOR_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            className={`swatch ${cal.color === hex ? 'swatch-active' : ''}`}
                            style={{ backgroundColor: hex }}
                            onClick={() => updateCalendar(cal.id, { color: hex })}
                            aria-label={`Color ${hex}`}
                          />
                        ))}
                        <input
                          type="color"
                          className="color-picker-native"
                          value={cal.color}
                          onChange={(e) => updateCalendar(cal.id, { color: e.target.value })}
                          title="Custom color"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger-ghost btn-sm"
                        onClick={() => removeCalendar(cal.id)}
                        title="Remove calendar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="feed-row-bottom">
                      <input
                        type="url"
                        className="input feed-url-input"
                        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                        value={cal.url}
                        onChange={(e) => updateCalendar(cal.id, { url: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void testCalendar(cal)}
                        disabled={testingId === cal.id}
                      >
                        {testingId === cal.id ? 'Testing…' : 'Test Feed'}
                      </button>
                    </div>

                    {test && (
                      <div className={`feed-test-result ${test.ok ? 'test-ok' : 'test-err'}`}>
                        {test.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        <span>{test.message}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Weather Section */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <CloudSun size={18} />
              <h2>Weather & Station</h2>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Weather Source</label>
              <select
                className="input"
                value={config.weather.provider ?? 'open-meteo'}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    weather: {
                      ...config.weather,
                      provider: e.target.value === 'tempest' ? 'tempest' : 'open-meteo',
                    },
                  })
                }
              >
                <option value="open-meteo">Open-Meteo (Free, no API key)</option>
                <option value="tempest">Tempest Weather Station (Live + Hyperlocal Forecast)</option>
              </select>
            </div>

            <div className="form-field">
              <label>Temperature Unit</label>
              <select
                className="input"
                value={config.weather.unit}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    weather: {
                      ...config.weather,
                      unit: e.target.value === 'celsius' ? 'celsius' : 'fahrenheit',
                    },
                  })
                }
              >
                <option value="fahrenheit">Fahrenheit (°F, mph)</option>
                <option value="celsius">Celsius (°C, km/h)</option>
              </select>
            </div>

            <div className="form-field">
              <label>Display Location Name</label>
              <input
                type="text"
                className="input"
                value={config.weather.name}
                onChange={(e) =>
                  setConfig({ ...config, weather: { ...config.weather, name: e.target.value } })
                }
              />
            </div>

            {config.weather.provider !== 'tempest' && (
              <>
                <div className="form-field">
                  <label>Latitude / Longitude</label>
                  <div className="coord-row">
                    <input
                      type="number"
                      step="0.0001"
                      className="input"
                      value={config.weather.latitude}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weather: { ...config.weather, latitude: Number(e.target.value) },
                        })
                      }
                    />
                    <input
                      type="number"
                      step="0.0001"
                      className="input"
                      value={config.weather.longitude}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weather: { ...config.weather, longitude: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Search Another City</label>
                  <div className="search-row">
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Santa Fe, Albuquerque, Taos"
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCitySearch();
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleCitySearch()}
                      disabled={searchingCity}
                    >
                      <Search size={14} /> Search
                    </button>
                  </div>
                  {cityResults.length > 0 && (
                    <div className="city-results">
                      {cityResults.map((city, i) => (
                        <button
                          key={`${city.latitude}-${city.longitude}-${i}`}
                          type="button"
                          className="city-result-btn"
                          onClick={() => selectCity(city)}
                        >
                          <span>
                            {[city.name, city.admin1, city.country].filter(Boolean).join(', ')}
                          </span>
                          <span className="city-tz">{city.timezone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {config.weather.provider === 'tempest' && (
            <div className="tempest-config-box">
              <p className="tempest-help-text">
                Create a free Personal Access Token at{' '}
                <strong>tempestwx.com → Settings → Data Authorizations</strong>, paste it below,
                and click <strong>Find My Stations</strong> to auto-fill your station details.
              </p>

              <div className="form-grid">
                <div className="form-field">
                  <label>Tempest Personal Access Token</label>
                  <div className="search-row">
                    <input
                      type="password"
                      className="input"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={config.weather.tempestToken ?? ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weather: { ...config.weather, tempestToken: e.target.value },
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleDiscoverTempestStations()}
                      disabled={discoveringStations}
                    >
                      {discoveringStations ? 'Finding…' : 'Find My Stations'}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label>Tempest Station ID</label>
                  <div className="search-row">
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 123456"
                      value={config.weather.tempestStationId ?? ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weather: {
                            ...config.weather,
                            tempestStationId: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleTestTempest()}
                      disabled={testingTempest}
                    >
                      {testingTempest ? 'Testing…' : 'Test Station'}
                    </button>
                  </div>
                </div>
              </div>

              {tempestStations.length > 0 && (
                <div className="city-results">
                  {tempestStations.map((st) => (
                    <button
                      key={st.stationId}
                      type="button"
                      className="city-result-btn"
                      onClick={() => selectTempestStation(st)}
                    >
                      <span>
                        {st.name} (ID {st.stationId})
                      </span>
                      <span className="city-tz">{st.timezone}</span>
                    </button>
                  ))}
                </div>
              )}

              {tempestStatus && (
                <div className={`feed-test-result ${tempestStatus.ok ? 'test-ok' : 'test-err'}`}>
                  {tempestStatus.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>{tempestStatus.message}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Cloud Data Hub Section */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <Cloud size={18} />
              <h2>Cloud Data Hub (Optional)</h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleTestCloud()}
              disabled={testingCloud}
            >
              {testingCloud ? 'Testing…' : 'Test Cloud Hub'}
            </button>
          </div>

          <p className="tempest-help-text">
            Route weather, NWS alerts, air quality, and market quotes through a unified Cloudflare
            Worker endpoint (<code>POST /v1/snapshot</code>). Leave disabled to keep the Pi
            fetching directly. When enabled, Tempest credentials automatically override Open-Meteo.
          </p>

          <div className="toggle-grid" style={{ marginBottom: 14 }}>
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={cloudConfig.enabled}
                onChange={(e) => updateCloud({ enabled: e.target.checked })}
              />
              <span>Enable Cloud Data Hub</span>
            </label>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Snapshot Endpoint URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://homeboard-cloud-api.your-subdomain.workers.dev/v1/snapshot"
                value={cloudConfig.endpointUrl}
                onChange={(e) => updateCloud({ endpointUrl: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>API Key (Optional Bearer Token)</label>
              <input
                type="password"
                className="input"
                placeholder="Leave blank if endpoint is open"
                value={cloudConfig.apiKey ?? ''}
                onChange={(e) => updateCloud({ apiKey: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>Poll Interval (Seconds)</label>
              <input
                type="number"
                min={30}
                max={900}
                className="input"
                value={cloudConfig.pollSeconds}
                onChange={(e) => updateCloud({ pollSeconds: Number(e.target.value) })}
              />
            </div>

            {cloudConfig.modules.market && (
              <div className="form-field">
                <label>Market Symbols (Comma-Separated)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="SPY, QQQ"
                  value={symbolsInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSymbolsInput(val);
                    const parsed = val
                      .split(/[,\s]+/)
                      .map((s) => s.trim().toUpperCase())
                      .filter(Boolean);
                    updateCloudModules({ marketSymbols: parsed });
                  }}
                />
              </div>
            )}
          </div>

          <div className="toggle-grid" style={{ marginTop: 14 }}>
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={cloudConfig.modules.weather}
                onChange={(e) => updateCloudModules({ weather: e.target.checked })}
              />
              <span>Weather (auto Tempest override → Open-Meteo fallback)</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={cloudConfig.modules.alerts}
                onChange={(e) => updateCloudModules({ alerts: e.target.checked })}
              />
              <span>NWS Severe Weather Alerts banner</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={cloudConfig.modules.aqi}
                onChange={(e) => updateCloudModules({ aqi: e.target.checked })}
              />
              <span>Air Quality (US AQI badge)</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={cloudConfig.modules.market}
                onChange={(e) => updateCloudModules({ market: e.target.checked })}
              />
              <span>Market Ticker quotes</span>
            </label>
          </div>

          {cloudStatus && (
            <div
              className={`feed-test-result ${cloudStatus.ok ? 'test-ok' : 'test-err'}`}
              style={{ marginTop: 12 }}
            >
              {cloudStatus.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <span>{cloudStatus.message}</span>
            </div>
          )}
        </section>

        {/* Board Rotation & World Clock */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <Globe size={18} />
              <h2>Board Rotation &amp; World Clock</h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addWorldClockCity}
              disabled={worldClockCities.length >= 6}
            >
              <Plus size={15} /> Add City
            </button>
          </div>

          <div className="form-grid" style={{ marginBottom: 14 }}>
            <div className="form-field">
              <label>Rotation Interval (Seconds)</label>
              <input
                type="number"
                min={10}
                max={300}
                className="input"
                value={config.display.rotationIntervalSeconds ?? 25}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: {
                      ...config.display,
                      rotationIntervalSeconds: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="toggle-grid" style={{ marginBottom: 16 }}>
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.rotationEnabled ?? true}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, rotationEnabled: e.target.checked },
                  })
                }
              />
              <span>Auto-rotate views below header</span>
            </label>

            {SLIDE_OPTIONS.map((slide) => (
              <label key={slide.id} className="toggle-item">
                <input
                  type="checkbox"
                  checked={rotationSlides.includes(slide.id)}
                  onChange={(e) => toggleRotationSlide(slide.id, e.target.checked)}
                />
                <span>Include: {slide.label}</span>
              </label>
            ))}
          </div>

          <div className="calendar-feed-list">
            {worldClockCities.map((city) => (
              <div key={city.id} className="calendar-feed-row">
                <div className="feed-row-top">
                  <input
                    type="text"
                    className="input feed-name-input"
                    placeholder="City name (e.g. Santa Fe)"
                    value={city.name}
                    onChange={(e) => updateWorldClockCity(city.id, { name: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Subtitle (e.g. New Mexico)"
                    value={city.subtitle ?? ''}
                    onChange={(e) => updateWorldClockCity(city.id, { subtitle: e.target.value })}
                  />
                  <select
                    className="input"
                    value={city.timezone}
                    onChange={(e) => updateWorldClockCity(city.id, { timezone: e.target.value })}
                  >
                    {!COMMON_TIMEZONES.includes(city.timezone) && (
                      <option value={city.timezone}>{city.timezone}</option>
                    )}
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => removeWorldClockCity(city.id)}
                    disabled={worldClockCities.length <= 1}
                    title="Remove city"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Display Preferences */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              <Monitor size={18} />
              <h2>Display & Kiosk Preferences</h2>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Board Theme</label>
              <select
                className="input"
                value={config.display.theme ?? 'dark'}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfig({
                    ...config,
                    display: {
                      ...config.display,
                      theme: val === 'light' || val === 'auto' ? val : 'dark',
                    },
                  });
                }}
              >
                <option value="dark">Midnight Glass (Dark)</option>
                <option value="light">Warm Paper (Daytime Light)</option>
                <option value="auto">Auto (Light by day, Dark after dusk)</option>
              </select>
            </div>

            <div className="form-field">
              <label>Calendar Grid Mode</label>
              <select
                className="input"
                value={config.display.gridMode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: {
                      ...config.display,
                      gridMode: e.target.value === 'month' ? 'month' : 'rolling-4w',
                    },
                  })
                }
              >
                <option value="rolling-4w">4-Week Rolling (Always shows 3+ weeks ahead)</option>
                <option value="month">Full Calendar Month</option>
              </select>
            </div>

            <div className="form-field">
              <label>Week Starts On</label>
              <select
                className="input"
                value={config.display.weekStartsOn}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: {
                      ...config.display,
                      weekStartsOn: Number(e.target.value) === 1 ? 1 : 0,
                    },
                  })
                }
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
              </select>
            </div>

            <div className="form-field">
              <label>Clock Format</label>
              <select
                className="input"
                value={config.display.clockFormat}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: {
                      ...config.display,
                      clockFormat: e.target.value === '24h' ? '24h' : '12h',
                    },
                  })
                }
              >
                <option value="12h">12-hour (8:30 AM)</option>
                <option value="24h">24-hour (08:30)</option>
              </select>
            </div>

            <div className="form-field">
              <label>Upcoming Agenda Lookahead (Days)</label>
              <input
                type="number"
                min={3}
                max={30}
                className="input"
                value={config.display.agendaDays}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, agendaDays: Number(e.target.value) },
                  })
                }
              />
            </div>

            <div className="form-field">
              <label>Night Dimming Hours (24h)</label>
              <div className="coord-row">
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="input"
                  value={config.display.nightDimStartHour}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      display: {
                        ...config.display,
                        nightDimStartHour: Number(e.target.value),
                      },
                    })
                  }
                  title="Start hour (e.g. 22 for 10 PM)"
                />
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="input"
                  value={config.display.nightDimEndHour}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      display: {
                        ...config.display,
                        nightDimEndHour: Number(e.target.value),
                      },
                    })
                  }
                  title="End hour (e.g. 6 for 6 AM)"
                />
              </div>
            </div>

            <div className="form-field">
              <label>Calendar Sync Interval (Minutes)</label>
              <input
                type="number"
                min={2}
                max={120}
                className="input"
                value={config.refresh.calendarMinutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    refresh: {
                      ...config.refresh,
                      calendarMinutes: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="toggle-grid">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.showHourlyWeather}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, showHourlyWeather: e.target.checked },
                  })
                }
              />
              <span>Show hourly weather strip in header</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.showSeconds}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, showSeconds: e.target.checked },
                  })
                }
              />
              <span>Show seconds on clock</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.nightDimEnabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, nightDimEnabled: e.target.checked },
                  })
                }
              />
              <span>Auto-dim display overnight</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.burnInShift}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, burnInShift: e.target.checked },
                  })
                }
              />
              <span>Subtle pixel shift for screen burn-in protection</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.ambientWeather ?? true}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, ambientWeather: e.target.checked },
                  })
                }
              />
              <span>Living sky & ambient weather backdrop</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.calendarWeather ?? true}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, calendarWeather: e.target.checked },
                  })
                }
              />
              <span>Show mini weather forecasts on calendar days</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.seasonalAccents ?? true}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, seasonalAccents: e.target.checked },
                  })
                }
              />
              <span>Subtle seasonal color accents</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.display.demoMode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, demoMode: e.target.checked },
                  })
                }
              />
              <span>Show sample events when no calendars are configured</span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
