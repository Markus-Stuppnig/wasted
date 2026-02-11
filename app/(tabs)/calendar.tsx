import { useState, useMemo, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Pressable,
  AppState,
  type AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { getDayMinutes, loadToday } from "../storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const COL_COUNT = 7;

/** Max minutes we treat as a "full" circle */
const FULL_DAY_MINUTES = 8 * 60; // 8 hours = full ring

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Returns the day of week for Monday-start (0=Mon … 6=Sun) */
function mondayStart(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ── Circle indicator ──

interface DayCircleProps {
  size: number;
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
  isCurrentMonth: boolean;
}

function DayCircle({ size, minutes, isToday, isFuture, isCurrentMonth }: DayCircleProps) {
  const strokeWidth = size * 0.12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction = Math.min(1, minutes / FULL_DAY_MINUTES);
  const strokeDashoffset = circumference * (1 - fraction);

  // Colors
  const trackColor = isCurrentMonth
    ? "rgba(255,255,255,0.12)"
    : "rgba(255,255,255,0.05)";
  const progressColor = "#e8602c"; // warm orange-red from screenshot
  const filledBg =
    minutes > 0 && !isFuture
      ? "rgba(255,255,255,0.08)"
      : "transparent";

  if (isFuture) {
    // Future days: just a faint outline circle
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  if (minutes === 0) {
    // No data: filled white circle (past days) or outline (today with 0)
    if (isToday) {
      return (
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={strokeWidth}
              fill="none"
            />
          </Svg>
        </View>
      );
    }
    // Past day with no data: solid muted circle
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: size - 2,
            height: size - 2,
            borderRadius: size / 2,
            backgroundColor: "rgba(255,255,255,0.65)",
          }}
        />
      </View>
    );
  }

  // Has data: show progress ring
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill={filledBg}
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
    </View>
  );
}

// ── Calendar grid ──

interface CalendarDay {
  date: number; // day of month
  key: string; // "YYYY-MM-DD"
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
  isCurrentMonth: boolean;
}

function buildMonth(
  year: number,
  month: number,
  todayStr: string,
): CalendarDay[] {
  const now = new Date();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = mondayStart(firstDay.getDay());

  const cells: CalendarDay[] = [];

  // Leading blanks from previous month
  if (startWeekday > 0) {
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const key = dateKey(prevYear, prevMonth, d);
      cells.push({
        date: d,
        key,
        minutes: getDayMinutes(key),
        isToday: key === todayStr,
        isFuture: new Date(prevYear, prevMonth, d) > now,
        isCurrentMonth: false,
      });
    }
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(year, month, d);
    const dayDate = new Date(year, month, d);
    const isFuture =
      dayDate.getFullYear() > now.getFullYear() ||
      (dayDate.getFullYear() === now.getFullYear() &&
        dayDate.getMonth() > now.getMonth()) ||
      (dayDate.getFullYear() === now.getFullYear() &&
        dayDate.getMonth() === now.getMonth() &&
        d > now.getDate());

    let minutes: number;
    if (key === todayStr) {
      const { wastedMinutes } = loadToday();
      minutes = wastedMinutes;
    } else {
      minutes = getDayMinutes(key);
    }

    cells.push({
      date: d,
      key,
      minutes,
      isToday: key === todayStr,
      isFuture,
      isCurrentMonth: true,
    });
  }

  // Trailing blanks from next month
  const remainder = cells.length % COL_COUNT;
  if (remainder > 0) {
    const needed = COL_COUNT - remainder;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let d = 1; d <= needed; d++) {
      const key = dateKey(nextYear, nextMonth, d);
      cells.push({
        date: d,
        key,
        minutes: getDayMinutes(key),
        isToday: key === todayStr,
        isFuture: true,
        isCurrentMonth: false,
      });
    }
  }

  return cells;
}

// ── Main screen ──

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const todayStr = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") setRefreshKey((k) => k + 1);
      },
    );
    return () => sub.remove();
  }, []);

  const cells = useMemo(
    () => buildMonth(now.getFullYear(), now.getMonth(), todayStr),
    [refreshKey],
  );

  // Today's entry for the header display
  const todayCell = useMemo(
    () => cells.find((c) => c.isToday) ?? null,
    [cells],
  );

  const displayDay = selectedDay ?? todayCell;
  const displayMinutes = displayDay?.minutes ?? 0;
  const displayDate = displayDay
    ? new Date(
        parseInt(displayDay.key.slice(0, 4)),
        parseInt(displayDay.key.slice(5, 7)) - 1,
        parseInt(displayDay.key.slice(8, 10)),
      )
    : now;

  // Grid sizing
  const gridPadding = 24;
  const gridWidth = SCREEN_WIDTH - gridPadding * 2;
  const gap = 8;
  const circleSize = Math.floor((gridWidth - gap * (COL_COUNT - 1)) / COL_COUNT);

  const rows: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += COL_COUNT) {
    rows.push(cells.slice(i, i + COL_COUNT));
  }

  // Current day of week index (Mon-start) for highlighting header
  const currentWeekday = mondayStart(now.getDay());

  return (
    <LinearGradient
      colors={["#c0cfe0", "#7a92b5", "#3a5278", "#152238", "#0a1628"]}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      style={styles.fill}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 80,
          },
        ]}
      >
        {/* ── Header: time display ── */}
        <View style={styles.header}>
          <Text style={styles.bigTime}>{formatTime(displayMinutes)}</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>
              {displayDate.getDate()}. {MONTH_NAMES[displayDate.getMonth()]}
              {"\n"}
              <Text style={styles.yearText}>{displayDate.getFullYear()}</Text>
            </Text>
            <Text style={styles.dayName}>
              {DAY_NAMES[displayDate.getDay()]}
            </Text>
          </View>
        </View>

        {/* ── Calendar grid ── */}
        <View style={[styles.gridContainer, { paddingHorizontal: gridPadding }]}>
          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text
                key={i}
                style={[
                  styles.weekdayLabel,
                  { width: circleSize },
                  i === currentWeekday && styles.weekdayLabelActive,
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          {/* Day rows */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((cell) => (
                <Pressable
                  key={cell.key}
                  onPress={() => {
                    if (!cell.isFuture) {
                      setSelectedDay(
                        selectedDay?.key === cell.key ? null : cell,
                      );
                    }
                  }}
                >
                  <DayCircle
                    size={circleSize}
                    minutes={cell.minutes}
                    isToday={cell.isToday}
                    isFuture={cell.isFuture}
                    isCurrentMonth={cell.isCurrentMonth}
                  />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  screen: {
    flex: 1,
    alignItems: "center",
  },

  /* ── Header ── */
  header: {
    alignItems: "flex-start",
    width: "100%",
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  bigTime: {
    fontSize: 64,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
  },
  dateText: {
    fontSize: 20,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 26,
  },
  yearText: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },
  dayName: {
    fontSize: 20,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },

  /* ── Grid ── */
  gridContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekdayLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
  },
  weekdayLabelActive: {
    color: "#e8602c",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
});
