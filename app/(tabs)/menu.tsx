import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
  AppState,
  type AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import {
  loadSettings,
  saveSettings,
  formatBedTime,
  type Settings,
} from "../settings-storage";

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
  // Normalize: if stored value is 0–179 (12:00 am – 2:59 am), treat as next-day
  let m = minutes;
  if (m < SLIDER_MIN_MINUTES) m += 1440;
  const clamped = Math.max(SLIDER_MIN_MINUTES, Math.min(SLIDER_MAX_MINUTES, m));
  return (clamped - SLIDER_MIN_MINUTES) / SLIDER_RANGE;
}

function sliderToMinutes(value: number): number {
  const raw = SLIDER_MIN_MINUTES + value * SLIDER_RANGE;
  const snapped = snapTo15(raw);
  // Wrap back to 0-1439
  return snapped >= 1440 ? snapped - 1440 : snapped;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sliderValue, setSliderValue] = useState(0.5);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    const s = loadSettings();
    setSettings(s);
    setSliderValue(minutesToSlider(s.bedTimeMinutes));
    setDirty(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active" && !dirty) load();
      },
    );
    return () => sub.remove();
  }, [load, dirty]);

  if (!settings) return null;

  const displayMinutes = sliderToMinutes(sliderValue);

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    setDirty(true);
  };

  const handleSave = () => {
    const updated: Settings = {
      bedTimeMinutes: displayMinutes,
      analyticsEnabled: settings.analyticsEnabled,
    };
    saveSettings(updated);
    setSettings(updated);
    setDirty(false);
  };

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
        {/* ── Bed Time section ── */}
        <View style={styles.section}>
          <View style={styles.bedTimeHeader}>
            <Text style={styles.bedTimeLabel}>Bed Time</Text>
            <Text style={styles.bedTimeValue}>
              {formatBedTime(displayMinutes)}
            </Text>
          </View>

          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={sliderValue}
              onValueChange={handleSliderChange}
              minimumTrackTintColor="rgba(255,255,255,0.8)"
              maximumTrackTintColor="rgba(255,255,255,0.8)"
              thumbTintColor="#fff"
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>7:00 pm</Text>
              <Text style={styles.sliderLabel}>3:00 am</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Analytics toggle ── */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            Allow us to send{"\n"}anonymous Data for{"\n"}Development
          </Text>
          <Switch
            value={settings.analyticsEnabled}
            onValueChange={(value) => {
              setSettings({ ...settings, analyticsEnabled: value });
              setDirty(true);
            }}
            trackColor={{
              false: "rgba(255,255,255,0.2)",
              true: "rgba(255,255,255,0.6)",
            }}
            thumbColor={settings.analyticsEnabled ? "#fff" : "rgba(255,255,255,0.7)"}
          />
        </View>

        <View style={styles.divider} />

        {/* ── Widgets promo ── */}
        <Text style={styles.widgetsText}>
          Use our Widgets for{"\n"}better Results!
        </Text>

        {/* ── Spacer + Save button ── */}
        <View style={styles.spacer} />

        <View style={styles.saveRow}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
            ]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
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
    paddingHorizontal: 28,
  },

  /* ── Bed Time ── */
  section: {
    marginBottom: 8,
  },
  bedTimeHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 16,
    marginBottom: 12,
  },
  bedTimeLabel: {
    fontSize: 28,
    fontWeight: "700",
    color: "rgba(20,30,60,0.85)",
  },
  bedTimeValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "rgba(20,30,60,0.85)",
  },
  sliderContainer: {
    marginBottom: 4,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(20,30,60,0.6)",
  },

  /* ── Divider ── */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginVertical: 20,
  },

  /* ── Toggle ── */
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleText: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 26,
    flex: 1,
  },

  /* ── Widgets promo ── */
  widgetsText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 42,
  },

  /* ── Save ── */
  spacer: {
    flex: 1,
  },
  saveRow: {
    alignItems: "flex-end",
  },
  saveButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 16,
  },
  saveButtonPressed: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgba(20,30,60,0.85)",
  },
});
