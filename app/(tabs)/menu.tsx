import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Switch,
  Pressable,
  ScrollView,
  Linking,
  AppState,
  type AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "../components/Text";
import {
  loadSettings,
  saveSettings,
  formatBedTime,
  type Settings,
} from "../settings-storage";
import Background from "../Background";


/**
 * The slider maps a 0→1 range to 7:00 pm (19:00) → 3:00 am (27:00 = next day 03:00).
 * That's an 8-hour window: 19*60 = 1140 → 27*60 = 1620 minutes-from-midnight.
 * Values ≥ 1440 wrap to the next day (e.g. 1500 = 1:00 am).
 */
const SLIDER_MIN_MINUTES = 19 * 60; // 7:00 pm
const SLIDER_MAX_MINUTES = 27 * 60; // 3:00 am (next day)
const SLIDER_RANGE = SLIDER_MAX_MINUTES - SLIDER_MIN_MINUTES;

/** Snap to nearest 15-minute increment */
function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

function minutesToSlider(minutes: number): number {
  let m = minutes;
  if (m < SLIDER_MIN_MINUTES) m += 1440;
  const clamped = Math.max(SLIDER_MIN_MINUTES, Math.min(SLIDER_MAX_MINUTES, m));
  return (clamped - SLIDER_MIN_MINUTES) / SLIDER_RANGE;
}

function sliderToMinutes(value: number): number {
  const raw = SLIDER_MIN_MINUTES + value * SLIDER_RANGE;
  const snapped = snapTo15(raw);
  return snapped >= 1440 ? snapped - 1440 : snapped;
}

/** Format a fixed minutes-from-midnight value in system locale */
function formatFixedTime(minutes: number): string {
  const d = new Date();
  const m = ((minutes % 1440) + 1440) % 1440;
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sliderValue, setSliderValue] = useState(0.5);
  const [bedTimeTooltip, setBedTimeTooltip] = useState(false);
  const [analyticsTooltip, setAnalyticsTooltip] = useState(false);

  const dismissTooltips = useCallback(() => {
    setBedTimeTooltip(false);
    setAnalyticsTooltip(false);
  }, []);

  const load = useCallback(() => {
    const s = loadSettings();
    setSettings(s);
    setSliderValue(minutesToSlider(s.bedTimeMinutes));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") load();
      },
    );
    return () => sub.remove();
  }, [load]);

  if (!settings) return <Background><View className="flex-1" /></Background>;

  const displayMinutes = sliderToMinutes(sliderValue);

  // Auto-save helpers
  const persist = (updated: Settings) => {
    saveSettings(updated);
    setSettings(updated);
  };

  const handleSliderComplete = (value: number) => {
    setSliderValue(value);
    persist({
      ...settings,
      bedTimeMinutes: sliderToMinutes(value),
    });
  };

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
  };

  const handleToggleAnalytics = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    persist({ ...settings, analyticsEnabled: value });
  };

  return (
    <Background>
      <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          gap: 14,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={dismissTooltips}
      >
        {/* ── Bed Time ── */}
        <View className={`relative z-[1] ${bedTimeTooltip ? "z-10" : ""}`}>
          <View className="rounded-card overflow-hidden">
            <BlurView
              className="p-5"
              tint="systemUltraThinMaterialDark"
              intensity={30}
            >
              <View className="flex-row items-center gap-2.5 mb-3">
                <Ionicons
                  name="moon-outline"
                  size={22}
                  color="rgba(255,255,255,0.7)"
                />
                <Text className="text-lg font-extrabold text-white">Bed Time</Text>
                <View className="flex-1" />
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setBedTimeTooltip(!bedTimeTooltip);
                    setAnalyticsTooltip(false);
                  }}
                  hitSlop={12}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="rgba(255,255,255,0.4)"
                  />
                </Pressable>
              </View>
              <Text className="text-3xl-plus font-extrabold text-white mb-0.5">
                {formatBedTime(displayMinutes)}
              </Text>
              <Text className="text-xs font-semibold text-white-40 mb-4">
                Timer stops at this time
              </Text>
              <View className="mt-1">
                <Slider
                  style={{ width: "100%", height: 40 }}
                  minimumValue={0}
                  maximumValue={1}
                  value={sliderValue}
                  onValueChange={handleSliderChange}
                  onSlidingComplete={handleSliderComplete}
                  minimumTrackTintColor="rgba(255,255,255,0.6)"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#fff"
                />
                <View className="flex-row justify-between px-1 -mt-0.5">
                  <Text className="text-xs font-bold text-white-40">
                    {formatFixedTime(SLIDER_MIN_MINUTES)}
                  </Text>
                  <Text className="text-xs font-bold text-white-40">
                    {formatFixedTime(SLIDER_MAX_MINUTES % 1440)}
                  </Text>
                </View>
              </View>
            </BlurView>
          </View>
          {bedTimeTooltip && (
            <View
              className="absolute top-full left-3 right-3 mt-1.5 bg-tooltip-bg rounded-xl p-3 z-10"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Text
                className="text-xs font-semibold leading-[19px]"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                The timer will automatically stop tracking at your bed time.
                This prevents overnight sessions from inflating your data.
              </Text>
            </View>
          )}
        </View>

        {/* ── Analytics ── */}
        <View className={`relative z-[1] ${analyticsTooltip ? "z-10" : ""}`}>
          <View className="rounded-card overflow-hidden">
            <BlurView
              className="p-5"
              tint="systemUltraThinMaterialDark"
              intensity={30}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <Ionicons
                    name="analytics-outline"
                    size={22}
                    color="rgba(255,255,255,0.7)"
                  />
                  <View className="flex-1">
                    <Text className="text-lg font-extrabold text-white">Analytics</Text>
                    <Text className="text-xs font-semibold text-white-40 mt-0.5">
                      Anonymous usage data
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setAnalyticsTooltip(!analyticsTooltip);
                    setBedTimeTooltip(false);
                  }}
                  hitSlop={12}
                  className="mr-3"
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="rgba(255,255,255,0.4)"
                  />
                </Pressable>
                <Switch
                  value={settings.analyticsEnabled}
                  onValueChange={handleToggleAnalytics}
                  trackColor={{
                    false: "rgba(255,255,255,0.15)",
                    true: "rgba(255,255,255,0.45)",
                  }}
                  thumbColor="#fff"
                  style={{ alignSelf: "center" }}
                />
              </View>
            </BlurView>
          </View>
          {analyticsTooltip && (
            <View
              className="absolute top-full left-3 right-3 mt-1.5 bg-tooltip-bg rounded-xl p-3 z-10"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Text
                className="text-xs font-semibold leading-[19px]"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                We only collect anonymous data like app opens, session
                durations, and crash reports. No personal information,
                no tracking IDs, no data sold to third parties. Ever.
              </Text>
            </View>
          )}
        </View>

        {/* ── What's Wasted? card ── */}
        <View className="rounded-card overflow-hidden">
          <BlurView
            className="p-5"
            tint="systemUltraThinMaterialDark"
            intensity={30}
          >
            <Text className="text-xl font-extrabold text-white">What's Wasted?</Text>
            <Text className="text-sm font-semibold text-white-50 mt-1 leading-[20px]">
              A screen time awareness app. No restrictions, no judgement — just honest data about how you spend your time.
            </Text>

            <View className="mt-4 gap-3">
              <View className="flex-row items-start gap-3">
                <View className="w-[30px] h-[30px] rounded-full bg-white-08 items-center justify-center mt-0.5">
                  <Ionicons name="swap-vertical" size={15} color="rgba(255,255,255,0.5)" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-white">Swipe to track</Text>
                  <Text className="text-xs font-medium text-white-40 mt-0.5 leading-[17px]">
                    Swipe up when you start wasting time, swipe down when you stop.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-[30px] h-[30px] rounded-full bg-white-08 items-center justify-center mt-0.5">
                  <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.5)" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-white">See your patterns</Text>
                  <Text className="text-xs font-medium text-white-40 mt-0.5 leading-[17px]">
                    The calendar shows daily progress rings so you can spot trends over time.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-[30px] h-[30px] rounded-full bg-white-08 items-center justify-center mt-0.5">
                  <Ionicons name="lock-closed-outline" size={15} color="rgba(255,255,255,0.5)" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-white">Completely private</Text>
                  <Text className="text-xs font-medium text-white-40 mt-0.5 leading-[17px]">
                    All data stays on your device. No accounts, no cloud, no tracking.
                  </Text>
                </View>
              </View>
            </View>
          </BlurView>
        </View>

        {/* ── Widgets info ── */}
        <Pressable
          className="rounded-card overflow-hidden"
          onPress={() => Linking.openURL("https://support.apple.com/en-us/118610")}
        >
          <BlurView
            className="p-5"
            tint="systemUltraThinMaterialDark"
            intensity={30}
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2.5 flex-1">
                <Ionicons
                  name="grid-outline"
                  size={22}
                  color="rgba(255,255,255,0.7)"
                />
                <View className="flex-1">
                  <Text className="text-lg font-extrabold text-white">Widgets</Text>
                  <Text className="text-xs font-semibold text-white-40 mt-0.5">
                    Learn how to add widgets to your home screen
                  </Text>
                </View>
              </View>
              <Ionicons
                name="open-outline"
                size={18}
                color="rgba(255,255,255,0.35)"
              />
            </View>
          </BlurView>
        </Pressable>
      </ScrollView>

      {/* ── Tooltip dismiss overlay ── */}
      {(bedTimeTooltip || analyticsTooltip) && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissTooltips}
        />
      )}

      </View>
    </Background>
  );
}
