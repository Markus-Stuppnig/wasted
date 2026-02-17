import { File, Paths } from "expo-file-system";

// ── Types ──

export interface Settings {
  /** Bed time in minutes from midnight (e.g. 23:00 = 23*60 = 1380) */
  bedTimeMinutes: number;
  /** Whether anonymous analytics are enabled */
  analyticsEnabled: boolean;
  /** ISO 8601 timestamp of the first time the app was opened */
  firstOpenedAt: string | null;
  /** Whether the onboarding has been completed */
  onboardingCompleted: boolean;
}

const DEFAULTS: Settings = {
  bedTimeMinutes: 23 * 60, // 11:00 pm
  analyticsEnabled: false,
  firstOpenedAt: null,
  onboardingCompleted: false,
};

// ── File handle ──

const file = new File(Paths.document, "wasted-settings.json");

// ── Read / Write ──

export function loadSettings(): Settings {
  try {
    if (!file.exists) {
      const settings = { ...DEFAULTS, firstOpenedAt: new Date().toISOString() };
      saveSettings(settings);
      return settings;
    }
    const raw = file.textSync();
    const parsed = JSON.parse(raw);
    const settings = { ...DEFAULTS, ...parsed };
    if (!settings.firstOpenedAt) {
      settings.firstOpenedAt = new Date().toISOString();
      saveSettings(settings);
    }
    return settings;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings): void {
  file.write(JSON.stringify(settings));
}

// ── Helpers ──

/** Convert minutes-from-midnight to a display string using the system hour format */
export function formatBedTime(minutes: number): string {
  // Build a Date at the given time today so Intl picks up the system locale
  const m = ((minutes % 1440) + 1440) % 1440;
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  // undefined locale = system default → respects 12h / 24h device setting
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
