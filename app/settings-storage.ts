import { File, Paths } from "expo-file-system";

// ── Types ──

export interface Settings {
  /** Bed time in minutes from midnight (e.g. 23:00 = 23*60 = 1380) */
  bedTimeMinutes: number;
  /** Whether anonymous analytics are enabled */
  analyticsEnabled: boolean;
}

const DEFAULTS: Settings = {
  bedTimeMinutes: 23 * 60, // 11:00 pm
  analyticsEnabled: true,
};

// ── File handle ──

const file = new File(Paths.document, "wasted-settings.json");

// ── Read / Write ──

export function loadSettings(): Settings {
  try {
    if (!file.exists) return { ...DEFAULTS };
    const raw = file.textSync();
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
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
