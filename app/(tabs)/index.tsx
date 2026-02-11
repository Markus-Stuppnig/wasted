import { useRef, useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  AppState,
  type AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import {
  loadToday,
  startWasting,
  stopWasting,
  adjustMinutes,
  get7dAverage,
} from "../storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.82;

const MAX_MINUTES = 24 * 60;
const INNER_PADDING = 8;

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [wastedMinutes, setWastedMinutes] = useState(0);
  const [isWasting, setIsWasting] = useState(false);
  const [averageMinutes, setAverageMinutes] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // ── Load persisted data on mount & app foreground ──
  const refresh = useCallback(() => {
    const { wastedMinutes: wm, isWasting: iw } = loadToday();
    setWastedMinutes(wm);
    setIsWasting(iw);
    isWastingRef.current = iw;
    if (iw) {
      pillY.setValue(-pillTravelRef.current);
    }
    const avg = get7dAverage();
    setAverageMinutes(avg);
    setLoaded(true);
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

  // Recalculate displayed minutes every 15s from timestamps when wasting
  useEffect(() => {
    if (!isWasting) return;
    const id = setInterval(() => {
      const { wastedMinutes: wm } = loadToday();
      setWastedMinutes(wm);
    }, 15_000);
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

  // ── Breathing animation for timer text ──
  const BREATH_MAX = 1.04;
  const BREATH_DURATION = 1500;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const breathRef = useRef<Animated.CompositeAnimation | null>(null);
  const breathValueRef = useRef(1);

  useEffect(() => {
    const id = breathAnim.addListener(({ value }) => {
      breathValueRef.current = value;
    });
    return () => breathAnim.removeListener(id);
  }, [breathAnim]);

  useEffect(() => {
    if (isWasting) {
      breathRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: BREATH_MAX,
            duration: BREATH_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 1,
            duration: BREATH_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      breathRef.current.start();
    } else {
      if (breathRef.current) breathRef.current.stop();
      const current = breathValueRef.current;
      const fraction = (current - 1) / (BREATH_MAX - 1);
      const exhaleMs = Math.max(50, fraction * BREATH_DURATION);
      Animated.timing(breathAnim, {
        toValue: 1,
        duration: exhaleMs,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
    return () => {
      if (breathRef.current) breathRef.current.stop();
    };
  }, [isWasting, breathAnim]);

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
    (wasting: boolean) => {
      const wasWasting = isWastingRef.current;
      isWastingRef.current = wasting;
      setIsWasting(wasting);
      const target = wasting ? -pillTravelRef.current : 0;

      Animated.parallel([
        Animated.spring(pillY, {
          toValue: target,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
          mass: 1,
        }),
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
          mass: 1,
        }),
      ]).start();

      // Persist state change
      if (wasting && !wasWasting) {
        startWasting();
        const { wastedMinutes: wm } = loadToday();
        setWastedMinutes(wm);
      } else if (!wasting && wasWasting) {
        stopWasting();
        const { wastedMinutes: wm } = loadToday();
        setWastedMinutes(wm);
        const avg = get7dAverage();
        setAverageMinutes(avg);
      }
    },
    [pillY, dragY],
  );

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      const { translationY: ty, velocityY } = e.nativeEvent;
      const wasWasting = isWastingRef.current;
      const travel = pillTravelRef.current;

      // Percentage-based threshold: 25% of travel distance or velocity
      const threshold = Math.max(travel * 0.25, 30);

      if (wasWasting) {
        if (ty > threshold || velocityY > 300) {
          snapTo(false);
        } else {
          snapTo(true);
        }
      } else {
        if (ty < -threshold || velocityY < -300) {
          snapTo(true);
        } else {
          snapTo(false);
        }
      }
    }
  };

  const handleAdjust = (delta: number) => {
    const newMinutes = adjustMinutes(delta);
    setWastedMinutes(newMinutes);
  };

  // Sync pill position when loaded with active session
  useEffect(() => {
    if (loaded && isWasting && pillTravel > 0) {
      pillY.setValue(-pillTravel);
    }
  }, [loaded, pillTravel]);

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
            paddingTop: insets.top + 48,
            paddingBottom: insets.bottom + 80,
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>time wasted</Text>
          <Animated.Text
            style={[
              styles.bigTime,
              { transform: [{ scale: breathAnim }] },
            ]}
          >
            {formatTime(wastedMinutes)}
          </Animated.Text>
          <Text style={styles.avgLabel}>7d average</Text>
          <Text style={styles.avgValue}>{formatTime(averageMinutes)}</Text>
        </View>

        {/* ── -5m / +5m ── */}
        <View style={styles.adjustRow}>
          <Pressable onPress={() => handleAdjust(-5)}>
            <BlurView style={styles.adjustBtn} tint="systemUltraThinMaterialDark" intensity={40}>
              <Text style={styles.adjustText}>{"\u2013"}5m</Text>
            </BlurView>
          </Pressable>
          <Pressable onPress={() => handleAdjust(5)}>
            <BlurView style={styles.adjustBtn} tint="systemUltraThinMaterialDark" intensity={40}>
              <Text style={styles.adjustText}>+5m</Text>
            </BlurView>
          </Pressable>
        </View>

        {/* ── Outer static glass card ── */}
        <View style={styles.outerCardWrapper}>
          <Animated.View
            style={[
              styles.outerCardGlow,
              { shadowColor: isWasting ? "#8ab4f8" : "transparent" },
            ]}
          >
            <BlurView
              style={styles.outerCard}
              tint="systemUltraThinMaterialDark"
              intensity={30}
              onLayout={(e: {
                nativeEvent: { layout: { height: number } };
              }) => setCardHeight(e.nativeEvent.layout.height)}
            >
              {/* Shiny border overlay */}
              <Animated.View
                style={[styles.shinyBorder, { borderColor: glowColor }]}
                pointerEvents="none"
              />

              {/* Swipe hint — centered */}
              <Animated.View style={[styles.swipeHint, { opacity: arrowOpacity }]}>
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
              <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
                activeOffsetY={[-10, 10]}
                failOffsetX={[-20, 20]}
              >
                <Animated.View
                  onLayout={(e: {
                    nativeEvent: { layout: { height: number } };
                  }) => setPillHeight(e.nativeEvent.layout.height)}
                  style={[
                    styles.innerPillTrack,
                    { transform: [{ translateY: clampedPillY }] },
                  ]}
                >
                  <BlurView
                    style={styles.innerPill}
                    tint="systemThinMaterialDark"
                    intensity={50}
                >
                    <View style={styles.pillTextContainer}>
                      <Animated.Text
                        style={[
                          styles.innerPillText,
                          { opacity: livingOpacity },
                        ]}
                      >
                        Living
                      </Animated.Text>
                      <Animated.Text
                        style={[
                          styles.innerPillText,
                          styles.pillTextOverlay,
                          { opacity: wastingOpacity },
                        ]}
                      >
                        Wasting
                      </Animated.Text>
                    </View>
                  </BlurView>
                </Animated.View>
              </PanGestureHandler>
            </BlurView>
          </Animated.View>
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
    alignItems: "center",
    marginBottom: 28,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  headerLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1,
    marginBottom: 2,
  },
  bigTime: {
    fontSize: 72,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
  },
  avgLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    marginTop: 2,
  },
  avgValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    marginTop: 1,
  },

  /* ── Adjust buttons ── */
  adjustRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 32,
    marginBottom: 28,
  },
  adjustBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  adjustText: {
    fontSize: 17,
    fontWeight: "700",
    color: "rgba(255,255,255,0.65)",
  },

  /* ── Outer card (static) ── */
  outerCardWrapper: {
    flex: 1,
    width: CARD_WIDTH,
    maxHeight: 250,
    marginTop: 20,
  },
  outerCardGlow: {
    flex: 1,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  outerCard: {
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shinyBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  swipeHint: {
    alignItems: "center",
  },

  /* ── Inner pill (slides from bottom to top) ── */
  innerPillTrack: {
    position: "absolute",
    bottom: INNER_PADDING,
    left: INNER_PADDING,
    right: INNER_PADDING,
    alignItems: "center",
  },
  innerPill: {
    borderRadius: 22,
    paddingHorizontal: 40,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    overflow: "hidden",
  },
  pillTextContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  innerPillText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  pillTextOverlay: {
    position: "absolute",
  },
});
