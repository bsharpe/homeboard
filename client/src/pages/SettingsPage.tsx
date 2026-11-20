import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CloudSun,
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
  CalendarFeedConfig,
  GeocodingResult,
} from '../../../shared/types';

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

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: AppConfig) => setConfig(data))
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
              <h2>Weather Location</h2>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Current Location</label>
              <input
                type="text"
                className="input"
                value={config.weather.name}
                onChange={(e) =>
                  setConfig({ ...config, weather: { ...config.weather, name: e.target.value } })
                }
              />
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
