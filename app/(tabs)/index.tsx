import { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  AppState,
  type AppStateStatus,
} from "react-native";
import { GlassView } from "../../components/GlassView";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

const AnimatedText = Animated.createAnimatedComponent(Text);
import {
  PanGestureHandler,
  TapGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
  type TapGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import {
  loadToday,
  startWasting,
  stopWasting,
  adjustMinutes,
  get7dAverage,
  checkAndStopAtBedTime,
  pushWidgetData,
  getRunningSessionStart,
  getTodayCompletedMinutes,
  consumePendingWidgetAction,
} from "../../lib/storage";
import { loadSettings } from "../../lib/settings-storage";
import Background from "../Background";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.82;

const MAX_MINUTES = 24 * 60;
const INNER_PADDING = 20;

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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [wastedMs, setWastedMs] = useState(0);
  const [isWasting, setIsWasting] = useState(false);
  const [averageMs, setAverageMs] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // ── Load persisted data on mount & app foreground ──
  const refresh = useCallback(() => {
    // Consume any pending widget toggle actions first
    consumePendingWidgetAction();

    // Auto-stop if bed time passed while app was backgrounded
    const settings = loadSettings();
    checkAndStopAtBedTime(settings.bedTimeMinutes);

    const { wastedMs: wms, isWasting: iw } = loadToday();
    setWastedMs(wms);
    setIsWasting(iw);
    isWastingRef.current = iw;
    if (iw) {
      pillY.setValue(-pillTravelRef.current);
    }
    const { averageMs: avg } = get7dAverage(settings.firstOpenedAt);
    setAverageMs(avg);
    setLoaded(true);

    // Push latest state to widget
    pushWidgetData(
      getTodayCompletedMinutes(),
      iw,
      getRunningSessionStart(),
      avg !== null ? Math.floor(avg / 60_000) : 0,
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when app comes to foreground (recalculates from timestamps)
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") refresh();
      },
    );
    return () => sub.remove();
  }, [refresh]);

  // Recalculate displayed time every second when wasting
  // Also check if bed time has arrived and auto-stop
  useEffect(() => {
    if (!isWasting) return;
    const id = setInterval(() => {
      const { bedTimeMinutes } = loadSettings();
      const stopped = checkAndStopAtBedTime(bedTimeMinutes);
      if (stopped) {
        // Bed time reached — snap pill back to "Living"
        setIsWasting(false);
        isWastingRef.current = false;
        Animated.spring(pillY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
          mass: 1,
        }).start();
        const { wastedMs: wms } = loadToday();
        setWastedMs(wms);
        const { firstOpenedAt } = loadSettings();
        const { averageMs: avg } = get7dAverage(firstOpenedAt);
        setAverageMs(avg);
        pushWidgetData(
          getTodayCompletedMinutes(),
          false,
          0,
          avg !== null ? Math.floor(avg / 60_000) : 0,
        );
        return;
      }
      const { wastedMs: wms } = loadToday();
      setWastedMs(wms);
    }, 1_000);
    return () => clearInterval(id);
  }, [isWasting]);

  // ── Measured sizes for dynamic travel distance ──
  const [cardHeight, setCardHeight] = useState(0);
  const [pillHeight, setPillHeight] = useState(0);
  const pillTravel = Math.max(0, cardHeight - pillHeight - INNER_PADDING * 2);
  const pillTravelRef = useRef(0);
  useEffect(() => {
    pillTravelRef.current = pillTravel;
  }, [pillTravel]);

  // ── Shiny glow animation ──
  const glowAnim = useRef(new Animated.Value(0)).current;
  const glowRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isWasting) {
      glowRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      glowRef.current.start();
    } else {
      if (glowRef.current) glowRef.current.stop();
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
    return () => {
      if (glowRef.current) glowRef.current.stop();
    };
  }, [isWasting, glowAnim]);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.16)"],
  });

  // ── Pill gesture ──
  const isWastingRef = useRef(false);
  const panRef = useRef<PanGestureHandler>(null);
  const pillY = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const combinedY = Animated.add(pillY, dragY);

  const clampedPillY =
    pillTravel > 0
      ? combinedY.interpolate({
          inputRange: [-pillTravel - 30, -pillTravel, 0, 30],
          outputRange: [-pillTravel - 8, -pillTravel, 0, 8],
          extrapolate: "clamp",
        })
      : combinedY;

  const livingOpacity =
    pillTravel > 0
      ? combinedY.interpolate({
          inputRange: [-pillTravel, -pillTravel * 0.3, 0],
          outputRange: [0, 0.3, 1],
          extrapolate: "clamp",
        })
      : 1;

  const wastingOpacity =
    pillTravel > 0
      ? combinedY.interpolate({
          inputRange: [-pillTravel, -pillTravel * 0.7, 0],
          outputRange: [1, 0.3, 0],
          extrapolate: "clamp",
        })
      : 0;

  const arrowRotation =
    pillTravel > 0
      ? pillY.interpolate({
          inputRange: [-pillTravel, 0],
          outputRange: ["180deg", "0deg"],
          extrapolate: "clamp",
        })
      : "0deg";

  const arrowOpacity =
    pillTravel > 0
      ? combinedY.interpolate({
          inputRange: [-pillTravel, -pillTravel * 0.5, 0],
          outputRange: [0.3, 0.15, 0.3],
          extrapolate: "clamp",
        })
      : 0.3;

  const onGestureEvent = Animated.event<PanGestureHandlerGestureEvent>(
    [{ nativeEvent: { translationY: dragY } }],
    { useNativeDriver: true },
  );

  const snapTo = useCallback(
    (wasting: boolean, releaseVelocity = 0) => {
      const wasWasting = isWastingRef.current;
      isWastingRef.current = wasting;
      setIsWasting(wasting);
      const target = wasting ? -pillTravelRef.current : 0;

      Animated.parallel([
        Animated.spring(pillY, {
          toValue: target,
          velocity: releaseVelocity,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
          mass: 1,
        }),
        Animated.spring(dragY, {
          toValue: 0,
          velocity: releaseVelocity,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
          mass: 1,
        }),
      ]).start();

      // Haptic feedback on state change
      if (wasting !== wasWasting) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      // Persist state change
      if (wasting && !wasWasting) {
        startWasting();
        const { wastedMs: wms } = loadToday();
        setWastedMs(wms);
        const { firstOpenedAt } = loadSettings();
        const { averageMs: avg } = get7dAverage(firstOpenedAt);
        pushWidgetData(
          getTodayCompletedMinutes(),
          true,
          getRunningSessionStart(),
          avg !== null ? Math.floor(avg / 60_000) : 0,
        );
      } else if (!wasting && wasWasting) {
        stopWasting();
        const { wastedMs: wms } = loadToday();
        setWastedMs(wms);
        const { firstOpenedAt } = loadSettings();
        const { averageMs: avg } = get7dAverage(firstOpenedAt);
        setAverageMs(avg);
        pushWidgetData(
          getTodayCompletedMinutes(),
          false,
          0,
          avg !== null ? Math.floor(avg / 60_000) : 0,
        );
      }
    },
    [pillY, dragY],
  );

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      const { translationY: ty, velocityY } = e.nativeEvent;
      const wasWasting = isWastingRef.current;
      const travel = pillTravelRef.current;

      // Project where the gesture would land based on current velocity
      // This makes flicks feel natural — a fast swipe that only moved 10%
      // of the way will still trigger if the momentum would carry it past 50%
      const projected = ty + velocityY * 0.15;
      const threshold = travel * 0.5;

      // Convert velocity from px/ms to px/s for the spring animation
      const vel = velocityY / 1000;

      if (wasWasting) {
        snapTo(projected <= threshold, vel);
      } else {
        snapTo(projected < -threshold, vel);
      }
    }
  };

  const onTapStateChange = (e: TapGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state === State.ACTIVE) {
      snapTo(!isWastingRef.current);
    }
  };

  const handleAdjust = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    adjustMinutes(delta);
    const { wastedMs: wms, isWasting: iw } = loadToday();
    setWastedMs(wms);
    const { firstOpenedAt } = loadSettings();
    const { averageMs: avg } = get7dAverage(firstOpenedAt);
    pushWidgetData(
      getTodayCompletedMinutes(),
      iw,
      getRunningSessionStart(),
      avg !== null ? Math.floor(avg / 60_000) : 0,
    );
  };

  // Sync pill position when loaded with active session
  useEffect(() => {
    if (loaded && isWasting && pillTravel > 0) {
      pillY.setValue(-pillTravel);
    }
  }, [loaded, pillTravel]);

  return (
    <Background>
      <View
        className="flex-1 items-center"
        style={{
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 80,
        }}
      >
        {/* ── Header ── */}
        <View className="items-center mb-7 py-2 px-6 rounded-[20px] w-full">
          <Text className="text-xl font-semibold text-white tracking-wide mb-4">time wasted</Text>
          <Text
            className="font-bold text-white tracking-tight-2"
            numberOfLines={1}
            style={{ fontSize: 80, lineHeight: 80 }}
          >
            {formatTimeMs(wastedMs)}
          </Text>
          <Text className="text-xl font-extrabold text-white mt-4">7d average</Text>
          <Text className="text-xl font-extrabold text-white mt-[1px]">{averageMs !== null ? formatTimeMs(averageMs) : "---"}</Text>
        </View>

        {/* ── -5m / +5m ── */}
        <View className="flex-row justify-between w-full px-8 mb-7">
          <Pressable onPress={() => handleAdjust(-5)}>
            <View style={{ width: 76, height: 76, borderRadius: 24, overflow: "hidden" }}>
              <GlassView
                className="flex-1 items-center justify-center"
                tint="systemUltraThinMaterialDark"
                intensity={30}
              >
                <Text className="text-xl font-extrabold text-white-65">{"\u2013"}5m</Text>
              </GlassView>
            </View>
          </Pressable>
          <Pressable onPress={() => handleAdjust(5)}>
            <View style={{ width: 76, height: 76, borderRadius: 24, overflow: "hidden" }}>
              <GlassView
                className="flex-1 items-center justify-center"
                tint="systemUltraThinMaterialDark"
                intensity={30}
              >
                <Text className="text-xl font-extrabold text-white-65">+5m</Text>
              </GlassView>
            </View>
          </Pressable>
        </View>

        {/* ── Outer static glass card ── */}
        <View style={{ flex: 1, width: CARD_WIDTH, maxHeight: 240, marginTop: "auto", marginBottom: 40 }}>
          <TapGestureHandler
            onHandlerStateChange={onTapStateChange}
            waitFor={panRef}
          >
            <Animated.View
              className="flex-1 rounded-card-lg"
              style={{
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                shadowColor: isWasting ? "#8ab4f8" : "transparent",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
              }}
            >
              <GlassView
                className="flex-1 rounded-card-lg items-center justify-center overflow-hidden"
                tint="systemUltraThinMaterialDark"
                intensity={30}
                onLayout={(e: {
                  nativeEvent: { layout: { height: number } };
                }) => setCardHeight(e.nativeEvent.layout.height)}
              >
                {/* Shiny border overlay */}
                <Animated.View
                  className="absolute inset-0 rounded-card-lg border-[1.5px] border-transparent"
                  style={{ borderColor: glowColor }}
                  pointerEvents="none"
                />

                {/* Swipe hint arrow */}
                <Animated.View className="items-center px-10 py-4" style={{ opacity: arrowOpacity }}>
                  <Animated.View
                    style={{ transform: [{ rotate: arrowRotation }] }}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={22}
                      color="rgba(255,255,255,0.5)"
                    />
                  </Animated.View>
                </Animated.View>

                {/* ── Inner sliding pill ── */}
                <Animated.View
                  style={{
                    position: "absolute",
                    bottom: INNER_PADDING,
                    left: INNER_PADDING,
                    right: INNER_PADDING,
                  }}
                >
                  <PanGestureHandler
                    ref={panRef}
                    onGestureEvent={onGestureEvent}
                    onHandlerStateChange={onHandlerStateChange}
                    activeOffsetY={[-10, 10]}
                    failOffsetX={[-20, 20]}
                  >
                    <Animated.View
                      className="items-center"
                      onLayout={(e: {
                        nativeEvent: { layout: { height: number } };
                      }) => setPillHeight(e.nativeEvent.layout.height)}
                      style={{ transform: [{ translateY: clampedPillY }] }}
                    >
                      <View
                        className="rounded-card w-full overflow-hidden"
                        style={{
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.25)",
                        }}
                      >
                        <GlassView
                          className="px-10 py-[28px] items-center justify-center w-full"
                          tint="systemThinMaterialDark"
                          intensity={50}
                        >
                          <View className="items-center justify-center">
                            <AnimatedText
                              className="text-lg-plus font-extrabold text-white"
                              style={{ opacity: livingOpacity }}
                            >
                              Living
                            </AnimatedText>
                            <AnimatedText
                              className="text-lg-plus font-extrabold text-white absolute"
                              style={{ opacity: wastingOpacity }}
                            >
                              Wasting
                            </AnimatedText>
                          </View>
                        </GlassView>
                      </View>
                    </Animated.View>
                  </PanGestureHandler>
                </Animated.View>
              </GlassView>
            </Animated.View>
          </TapGestureHandler>
        </View>
      </View>
    </Background>
  );
}
