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

/** Convert minutes-from-midnight to "H:MM am/pm" display string */
export function formatBedTime(minutes: number): string {
  // Normalize to 0–1439
  const m = ((minutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(m / 60);
  const mins = m % 60;
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}
