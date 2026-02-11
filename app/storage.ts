import { File, Paths } from "expo-file-system";

// ── Types ──

/** A single wasting session: start → end timestamps (ms since epoch) */
export interface WasteSession {
  start: number;
  end: number | null; // null = still running
}

/** A manual adjustment from +5m / -5m buttons */
export interface Adjustment {
  timestamp: number; // ms since epoch — when the button was pressed
  delta: number; // minutes added (positive) or removed (negative)
}

/** One day's data */
export interface DayEntry {
  date: string; // "YYYY-MM-DD"
  sessions: WasteSession[];
  adjustments?: Adjustment[]; // manual +5m / -5m presses
}

/** Root JSON shape stored on disk */
interface StorageData {
  days: DayEntry[];
}

// ── File handle ──

const file = new File(Paths.document, "wasted-data.json");

// ── Read / Write ──

function readData(): StorageData {
  try {
    if (!file.exists) return { days: [] };
    const raw = file.textSync();
    return JSON.parse(raw) as StorageData;
  } catch {
    return { days: [] };
  }
}

function writeData(data: StorageData): void {
  file.write(JSON.stringify(data));
}

// ── Helpers ──

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getOrCreateDay(data: StorageData, dateKey: string): DayEntry {
  let day = data.days.find((d) => d.date === dateKey);
  if (!day) {
    day = { date: dateKey, sessions: [] };
    data.days.push(day);
  }
  return day;
}

/** Milliseconds wasted in completed sessions for a given day */
function completedMs(day: DayEntry): number {
  return day.sessions.reduce((sum, s) => {
    if (s.end === null) return sum;
    return sum + (s.end - s.start);
  }, 0);
}

/** Total adjustment milliseconds for a given day */
function adjustmentMs(day: DayEntry): number {
  if (!day.adjustments) return 0;
  return day.adjustments.reduce((sum, a) => sum + a.delta * 60_000, 0);
}

/** Total milliseconds for a day (sessions + adjustments), clamped to ≥ 0 */
function totalDayMs(day: DayEntry): number {
  return Math.max(0, completedMs(day) + adjustmentMs(day));
}

/** Find the open (running) session across all days, if any */
function findOpenSession(data: StorageData): {
  day: DayEntry;
  session: WasteSession;
} | null {
  for (const day of data.days) {
    for (const s of day.sessions) {
      if (s.end === null) return { day, session: s };
    }
  }
  return null;
}

// ── Public API ──

/**
 * Load today's state. Returns:
 * - wastedMinutes: total wasted minutes for today (including a running session)
 * - isWasting: whether there's an open session right now
 */
export function loadToday(): {
  wastedMinutes: number;
  isWasting: boolean;
} {
  const data = readData();
  const now = Date.now();
  const today = todayKey();

  // Close any open session that spans across midnight into previous days
  const open = findOpenSession(data);
  if (open && open.day.date !== today) {
    // Split: close old session at midnight, open new one at midnight
    const midnightOfToday = new Date(today + "T00:00:00").getTime();
    open.session.end = midnightOfToday;
    // Create a new open session starting at midnight on today
    const todayDay = getOrCreateDay(data, today);
    todayDay.sessions.push({ start: midnightOfToday, end: null });
    writeData(data);
  }

  const day = getOrCreateDay(data, today);
  let totalMs = completedMs(day) + adjustmentMs(day);

  // If there's an open session today, add elapsed time
  const runningSession = day.sessions.find((s) => s.end === null);
  if (runningSession) {
    totalMs += now - runningSession.start;
  }

  const wastedMinutes = Math.min(
    1440,
    Math.max(0, Math.floor(totalMs / 60_000)),
  );

  return { wastedMinutes, isWasting: runningSession != null };
}

/** Start a new wasting session right now */
export function startWasting(): void {
  const data = readData();
  const today = todayKey();
  const day = getOrCreateDay(data, today);

  // Safety: close any lingering open session
  for (const d of data.days) {
    for (const s of d.sessions) {
      if (s.end === null) s.end = Date.now();
    }
  }

  day.sessions.push({ start: Date.now(), end: null });
  writeData(data);
}

/** Stop the current wasting session */
export function stopWasting(): void {
  const data = readData();
  const open = findOpenSession(data);
  if (open) {
    open.session.end = Date.now();
    writeData(data);
  }
}

/** Adjust today's wasted time by recording an explicit +/- adjustment */
export function adjustMinutes(delta: number): number {
  const data = readData();
  const now = Date.now();
  const today = todayKey();
  const day = getOrCreateDay(data, today);

  // Compute current total (sessions + existing adjustments + running)
  let totalMs = completedMs(day) + adjustmentMs(day);
  const runningSession = day.sessions.find((s) => s.end === null);
  if (runningSession) {
    totalMs += now - runningSession.start;
  }

  const deltaMs = delta * 60_000;
  const newTotalMs = Math.max(0, Math.min(1440 * 60_000, totalMs + deltaMs));
  const actualDelta = newTotalMs - totalMs; // clamped difference in ms

  if (actualDelta === 0) {
    return Math.floor(newTotalMs / 60_000);
  }

  // Store the adjustment as an explicit record
  if (!day.adjustments) day.adjustments = [];
  day.adjustments.push({
    timestamp: now,
    delta: actualDelta / 60_000, // store in minutes
  });

  writeData(data);
  return Math.floor(newTotalMs / 60_000);
}

/** Get a specific day's total wasted minutes */
export function getDayMinutes(dateKey: string): number {
  const data = readData();
  const day = data.days.find((d) => d.date === dateKey);
  if (!day) return 0;
  return Math.max(0, Math.floor(totalDayMs(day) / 60_000));
}

/** Get the 7-day average (excluding today) */
export function get7dAverage(): number {
  const data = readData();
  const last7: number[] = [];

  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const day = data.days.find((entry) => entry.date === key);
    last7.push(day ? Math.max(0, Math.floor(totalDayMs(day) / 60_000)) : 0);
  }

  if (last7.length === 0) return 0;
  return Math.round(last7.reduce((a, b) => a + b, 0) / last7.length);
}

/** Get all stored day entries (for calendar view) */
export function getAllDays(): DayEntry[] {
  const data = readData();
  return data.days;
}
