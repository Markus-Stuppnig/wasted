import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Switch,
  Pressable,
  Modal,
  ScrollView,
  AppState,
  type AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
// GlassView removed — caused dark background artifacts on re-render
import { Ionicons } from "@expo/vector-icons";
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
  const [infoVisible, setInfoVisible] = useState(false);
  const [bedTimeTooltip, setBedTimeTooltip] = useState(false);
  const [analyticsTooltip, setAnalyticsTooltip] = useState(false);

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

  if (!settings) return null;

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
    persist({ ...settings, analyticsEnabled: value });
  };

  return (
    <LinearGradient
      colors={["#c0cfe0", "#7a92b5", "#3a5278", "#152238", "#0a1628"]}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      style={styles.fill}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.screen,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── What's Wasted? card ── */}
        <Pressable onPress={() => setInfoVisible(true)}>
          <View style={styles.card}>
            <View style={styles.infoCardContent}>
              <View style={styles.infoCardLeft}>
                <Text style={styles.infoCardTitle}>What's Wasted?</Text>
                <Text style={styles.infoCardSubtitle}>
                  Tap to learn how the app works
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color="rgba(255,255,255,0.5)"
              />
            </View>
          </View>
        </Pressable>

        {/* ── Bed Time ── */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="moon-outline"
                size={22}
                color="rgba(255,255,255,0.7)"
              />
              <Text style={styles.cardLabel}>Bed Time</Text>
              <View style={styles.headerSpacer} />
              <Pressable
                onPress={() => {
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
            <Text style={styles.bedTimeValue}>
              {formatBedTime(displayMinutes)}
            </Text>
            <Text style={styles.bedTimeHint}>
              Timer stops at this time
            </Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={sliderValue}
                onValueChange={handleSliderChange}
                onSlidingComplete={handleSliderComplete}
                minimumTrackTintColor="rgba(255,255,255,0.6)"
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor="#fff"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>
                  {formatFixedTime(SLIDER_MIN_MINUTES)}
                </Text>
                <Text style={styles.sliderLabel}>
                  {formatFixedTime(SLIDER_MAX_MINUTES % 1440)}
                </Text>
              </View>
            </View>
          </View>
          {bedTimeTooltip && (
            <View style={styles.tooltipOverlay}>
              <Text style={styles.tooltipText}>
                The timer will automatically stop tracking at your bed time.
                This prevents overnight sessions from inflating your data.
              </Text>
            </View>
          )}
        </View>

        {/* ── Analytics ── */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons
                  name="analytics-outline"
                  size={22}
                  color="rgba(255,255,255,0.7)"
                />
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.cardLabel}>Analytics</Text>
                  <Text style={styles.toggleDescription}>
                    Anonymous usage data
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setAnalyticsTooltip(!analyticsTooltip);
                  setBedTimeTooltip(false);
                }}
                hitSlop={12}
                style={styles.infoIconBtn}
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
              />
            </View>
          </View>
          {analyticsTooltip && (
            <View style={styles.tooltipOverlay}>
              <Text style={styles.tooltipText}>
                We only collect anonymous data like app opens, session
                durations, and crash reports. No personal information,
                no tracking IDs, no data sold to third parties. Ever.
              </Text>
            </View>
          )}
        </View>

        {/* ── Widgets info ── */}
        <View style={styles.card}>
          <View style={styles.infoCardContent}>
            <View style={styles.widgetInfoLeft}>
              <Ionicons
                name="grid-outline"
                size={22}
                color="rgba(255,255,255,0.7)"
              />
              <View style={styles.toggleTextGroup}>
                <Text style={styles.cardLabel}>Widgets</Text>
                <Text style={styles.toggleDescription}>
                  Add a home screen widget to track time at a glance
                </Text>
              </View>
            </View>
            <Ionicons
              name="open-outline"
              size={18}
              color="rgba(255,255,255,0.35)"
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Info Bottom Sheet ── */}
      <Modal
        visible={infoVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: 0 },
            ]}
          >
            <LinearGradient
              colors={["#2a4a72", "#1a3355", "#0e1f3a"]}
              locations={[0, 0.5, 1]}
              style={styles.modalGradient}
            >
              {/* Close button */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderSpacer} />
                <Pressable
                  onPress={() => setInfoVisible(false)}
                  hitSlop={16}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.closeButtonPressed,
                  ]}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}
              >
                <Text style={styles.modalTitle}>
                  Welcome to Wasted
                </Text>
                <Text style={styles.modalEmoji}>⏱</Text>

                <Text style={styles.modalText}>
                  Wasted helps you become more aware of how you spend your
                  screen time — not by restricting you, but by showing you
                  the truth.
                </Text>

                <Text style={styles.modalText}>
                  Whenever you catch yourself mindlessly scrolling, just
                  swipe the pill up to start tracking. When you put your
                  phone down, swipe it back. It's that simple.
                </Text>

                <Text style={styles.modalText}>
                  Over time, you'll build a picture of your habits on the
                  calendar. There's no judgement here — just honest data
                  to help you make better choices.
                </Text>

                <View style={styles.modalFeatures}>
                  <View style={styles.featureRow}>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.featureText}>
                      Track wasted time with a simple swipe
                    </Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.featureText}>
                      Review your habits on the calendar
                    </Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons
                      name="moon-outline"
                      size={20}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.featureText}>
                      Set a bed time to auto-stop tracking
                    </Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons
                      name="hand-left-outline"
                      size={20}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.featureText}>
                      No judgement — just awareness
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalFooter}>
                  Your data stays on your device. Always.
                </Text>
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: 20,
    gap: 14,
  },

  /* ── Cards ── */
  card: {
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  /* ── Info card ── */
  infoCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  infoCardLeft: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  infoCardSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },

  /* ── Card shared ── */
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  headerSpacer: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },

  /* ── Card wrapper (for tooltip positioning) ── */
  cardWrapper: {
    position: "relative",
    zIndex: 1,
  },

  /* ── Tooltips ── */
  tooltipOverlay: {
    position: "absolute",
    top: "100%",
    left: 12,
    right: 12,
    marginTop: 6,
    backgroundColor: "rgba(30,50,80,1.0)",
    borderRadius: 12,
    padding: 12,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipText: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 19,
  },

  /* ── Bed Time ── */
  bedTimeValue: {
    fontSize: 38,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 2,
  },
  bedTimeHint: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  sliderContainer: {
    marginTop: 4,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: -2,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },

  /* ── Toggle ── */
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  toggleTextGroup: {
    flex: 1,
  },
  toggleDescription: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  infoIconBtn: {
    marginRight: 12,
  },

  /* ── Widgets ── */
  widgetInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    height: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  modalGradient: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  modalHeaderSpacer: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: 24,
  },
  modalText: {
    fontSize: 17,
    fontWeight: "400",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 26,
    marginBottom: 16,
  },
  modalFeatures: {
    marginTop: 12,
    marginBottom: 24,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    flex: 1,
  },
  modalFooter: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    marginTop: 8,
  },
});
