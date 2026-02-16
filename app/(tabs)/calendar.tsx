import { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Dimensions,
  Pressable,
  AppState,
  type AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { getAllDayMinutes, loadToday, getFirstLogDate } from "../storage";
import { Text } from "../components/Text";
import config from "../config.json";
import Background from "../Background";


const { width: SCREEN_WIDTH } = Dimensions.get("window");

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const COL_COUNT = 7;

/** Max minutes we treat as a "full" circle */
const FULL_DAY_MINUTES = 8 * 60; // 8 hours = full ring

function formatTimeMs(totalMs: number): string {
  const totalSeconds = Math.floor(totalMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const s = totalSeconds % 60;
  if (h >= 1) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
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

const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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
  ms: number;
  isToday: boolean;
  isFuture: boolean;
  isCurrentMonth: boolean;
  isSelected: boolean;
}

function DayCircle({ size, ms, isToday, isFuture, isCurrentMonth, isSelected }: DayCircleProps) {
  const minutes = ms / 60_000;

  // Square-root scaling: early minutes fill faster, later minutes slower
  const fraction = Math.min(1, Math.pow(minutes / FULL_DAY_MINUTES, 0.5));

  const progressColor = config.accentColor;

  const circle = (() => {
    if (!isCurrentMonth) {
      // Out-of-month days: very faint, smaller dot
      return (
        <View className="items-center justify-center" style={{ width: size, height: size }}>
          <View
            style={{
              width: size * 0.45,
              height: size * 0.45,
              borderRadius: size * 0.225,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />
        </View>
      );
    }

    // Base circle opacity: today/future = bright, past = dimmer
    const baseBg = (isFuture || isToday)
      ? "rgba(255,255,255,0.65)"
      : "rgba(255,255,255,0.25)";

    // Inner progress ring (smaller than base circle)
    const innerRingSize = size * 0.67;
    const innerStrokeWidth = innerRingSize * 0.18;
    const innerRadius = (innerRingSize - innerStrokeWidth) / 2;
    const innerCircumference = 2 * Math.PI * innerRadius;
    const innerDashoffset = innerCircumference * (1 - fraction);

    const showProgress = minutes > 0 && !isFuture;

    return (
      <View className="items-center justify-center" style={{ width: size, height: size }}>
        <View
          style={{
            width: size - 2,
            height: size - 2,
            borderRadius: size / 2,
            backgroundColor: baseBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showProgress && (
            <Svg width={innerRingSize} height={innerRingSize}>
              <Circle
                cx={innerRingSize / 2}
                cy={innerRingSize / 2}
                r={innerRadius}
                stroke={progressColor}
                strokeWidth={innerStrokeWidth}
                fill="none"
                strokeDasharray={`${innerCircumference}`}
                strokeDashoffset={innerDashoffset}
                strokeLinecap="round"
                rotation={-90}
                origin={`${innerRingSize / 2}, ${innerRingSize / 2}`}
              />
            </Svg>
          )}
        </View>
      </View>
    );
  })();

  if (isSelected) {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
        }}
      >
        <View
          style={{
            position: "absolute",
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        />
        {circle}
      </View>
    );
  }

  if (isToday && isCurrentMonth) {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
        }}
      >
        <View
          style={{
            position: "absolute",
            width: size + 2,
            height: size + 2,
            borderRadius: (size + 2) / 2,
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.35)",
          }}
        />
        {circle}
      </View>
    );
  }

  return circle;
}

// ── Calendar grid ──

interface CalendarDay {
  date: number; // day of month
  key: string; // "YYYY-MM-DD"
  minutes: number;
  ms: number;
  isToday: boolean;
  isFuture: boolean;
  isCurrentMonth: boolean;
  isAfterInstall: boolean;
}

function buildMonth(
  year: number,
  month: number,
  todayStr: string,
  firstLogDate: string | null,
): CalendarDay[] {
  const now = new Date();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = mondayStart(firstDay.getDay());

  // Single disk read for all day minutes
  const allMinutes = getAllDayMinutes();
  const todayData = loadToday();

  const cells: CalendarDay[] = [];

  // Leading blanks from previous month
  if (startWeekday > 0) {
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const key = dateKey(prevYear, prevMonth, d);
      const mins = allMinutes[key] ?? 0;
      cells.push({
        date: d,
        key,
        minutes: mins,
        ms: mins * 60_000,
        isToday: key === todayStr,
        isFuture: new Date(prevYear, prevMonth, d) > now,
        isCurrentMonth: false,
        isAfterInstall: firstLogDate != null && key >= firstLogDate,
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
    let ms: number;
    if (key === todayStr) {
      minutes = todayData.wastedMinutes;
      ms = todayData.wastedMs;
    } else {
      minutes = allMinutes[key] ?? 0;
      ms = minutes * 60_000;
    }

    cells.push({
      date: d,
      key,
      minutes,
      ms,
      isToday: key === todayStr,
      isFuture,
      isCurrentMonth: true,
      isAfterInstall: firstLogDate != null && key >= firstLogDate,
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
      const mins = allMinutes[key] ?? 0;
      cells.push({
        date: d,
        key,
        minutes: mins,
        ms: mins * 60_000,
        isToday: key === todayStr,
        isFuture: true,
        isCurrentMonth: false,
        isAfterInstall: false,
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

  // Month navigation state
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

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

  // Refresh when tab gains focus (ensures calendar matches home timer)
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  // Navigation bounds
  const firstLog = useMemo(() => getFirstLogDate(), [refreshKey]);

  const cells = useMemo(
    () => buildMonth(viewYear, viewMonth, todayStr, firstLog),
    [viewYear, viewMonth, refreshKey, firstLog],
  );

  // Today's entry for the header display
  const todayCell = useMemo(
    () => cells.find((c) => c.isToday) ?? null,
    [cells],
  );

  // Auto-select today when viewing the current month
  useEffect(() => {
    if (isCurrentMonth && todayCell && !selectedDay) {
      setSelectedDay(todayCell);
    }
  }, [todayCell]);

  // Live-ticking ms for today when a session is running
  const todayData = useMemo(() => loadToday(), [refreshKey]);
  const [liveMs, setLiveMs] = useState(todayData.wastedMs);

  useEffect(() => {
    setLiveMs(todayData.wastedMs);
  }, [todayData.wastedMs]);

  useEffect(() => {
    if (!todayData.isWasting) return;
    const id = setInterval(() => {
      const { wastedMs: wms } = loadToday();
      setLiveMs(wms);
    }, 1_000);
    return () => clearInterval(id);
  }, [todayData.isWasting]);

  const displayDay = selectedDay ?? todayCell;
  const isDisplayToday = displayDay?.key === todayStr;
  const displayMs = isDisplayToday
    ? liveMs
    : (displayDay?.ms ?? 0);
  const displayDate = displayDay
    ? new Date(
        parseInt(displayDay.key.slice(0, 4)),
        parseInt(displayDay.key.slice(5, 7)) - 1,
        parseInt(displayDay.key.slice(8, 10)),
      )
    : now;

  // Grid sizing — based on actual card width, with enough padding for selection rings
  const cardWidth = SCREEN_WIDTH - 32;
  const gridInset = 20; // padding inside the card for the grid
  const gridWidth = cardWidth - gridInset * 2;
  const gap = 12;
  const cellSize = Math.floor((gridWidth - gap * (COL_COUNT - 1)) / COL_COUNT);
  const circleSize = Math.floor(cellSize * 0.95);

  const rows: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += COL_COUNT) {
    rows.push(cells.slice(i, i + COL_COUNT));
  }

  // Current day of week index (Mon-start) for highlighting header
  const currentWeekday = mondayStart(now.getDay());

  // Check if viewing current month
  const isCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const firstLogYear = firstLog ? parseInt(firstLog.slice(0, 4)) : now.getFullYear();
  const firstLogMonth = firstLog ? parseInt(firstLog.slice(5, 7)) - 1 : now.getMonth();

  const canGoNext = !isCurrentMonth;
  const canGoPrev =
    viewYear > firstLogYear ||
    (viewYear === firstLogYear && viewMonth > firstLogMonth);

  // Navigation
  const goToPrevMonth = () => {
    if (!canGoPrev) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (!canGoNext) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  };

  return (
    <Background>
      <View
        className="flex-1 items-center justify-end"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 80,
        }}
      >
        {/* ── Spacer to push everything to bottom ── */}
        <View className="flex-1" />

        {/* ── Info: time display ── */}
        <View className="items-start w-full px-7 mb-[60px]">
          <Text className="text-hero-sm font-extrabold text-white tracking-tight-2 mb-1">
            {formatTimeMs(displayMs)}
          </Text>
          <View className="flex-row justify-between items-start w-full">
            <Text
              className="text-xl font-extrabold leading-[26px]"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {displayDate.getDate()}. {MONTH_NAMES[displayDate.getMonth()]}
              {"\n"}
              <Text className="text-base font-bold text-white-40">
                {displayDate.getFullYear()}
              </Text>
            </Text>
            <Text
              className="text-xl font-extrabold"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {DAY_NAMES[displayDate.getDay()]}
            </Text>
          </View>
        </View>

        {/* ── Glass card behind calendar ── */}
        <View className="w-full rounded-card-lg overflow-hidden" style={{ marginHorizontal: 16, width: SCREEN_WIDTH - 32 }}>
          <BlurView
            className="rounded-card-lg overflow-hidden"
            tint="systemUltraThinMaterialDark"
            intensity={30}
            style={{ paddingTop: 20, paddingBottom: 28 }}
          >
            {/* ── Month navigation ── */}
            <View className="flex-row items-center justify-between w-full px-7 mb-4">
              {canGoPrev ? (
                <Pressable onPress={goToPrevMonth} hitSlop={16}>
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color="rgba(255,255,255,0.7)"
                  />
                </Pressable>
              ) : (
                <View style={{ width: 24 }} />
              )}
              <Pressable
                onPress={() => {
                  if (!isCurrentMonth) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setViewYear(now.getFullYear());
                    setViewMonth(now.getMonth());
                    setSelectedDay(null);
                  }
                }}
              >
                <Text className="text-xl font-extrabold text-white">
                  {MONTH_NAMES_FULL[viewMonth]} {viewYear}
                </Text>
              </Pressable>
              {canGoNext ? (
                <Pressable onPress={goToNextMonth} hitSlop={16}>
                  <Ionicons
                    name="chevron-forward"
                    size={24}
                    color="rgba(255,255,255,0.7)"
                  />
                </Pressable>
              ) : (
                <View style={{ width: 24 }} />
              )}
            </View>

            {/* ── Calendar grid ── */}
            <View className="w-full" style={{ paddingHorizontal: gridInset, overflow: "visible" }}>
              {/* Weekday headers */}
              <View className="flex-row justify-between mb-2">
                {WEEKDAY_LABELS.map((label, i) => (
                  <Text
                    key={i}
                    className={`text-center text-sm font-extrabold text-white-40 ${
                      isCurrentMonth && i === currentWeekday ? "text-accent" : ""
                    }`}
                    style={{ width: cellSize }}
                  >
                    {label}
                  </Text>
                ))}
              </View>

              {/* Day rows */}
              {rows.map((row, ri) => (
                <View key={ri} className="flex-row justify-between mb-3" style={{ overflow: "visible" }}>
                  {row.map((cell) => (
                    <Pressable
                      key={cell.key}
                      onPress={() => {
                        if (cell.isFuture || !cell.isCurrentMonth) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          return;
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        if (selectedDay?.key === cell.key) {
                          setSelectedDay(todayCell);
                        } else {
                          setSelectedDay(cell);
                        }
                      }}
                    >
                      <DayCircle
                        size={circleSize}
                        ms={cell.isCurrentMonth ? cell.ms : 0}
                        isToday={cell.isToday}
                        isFuture={cell.isFuture}
                        isCurrentMonth={cell.isCurrentMonth}
                        isSelected={selectedDay?.key === cell.key}
                      />
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          </BlurView>
        </View>
      </View>
    </Background>
  );
}
