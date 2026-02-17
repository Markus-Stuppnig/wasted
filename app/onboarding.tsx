import { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { playWordPop, playTransition, playComplete } from "../lib/utils/sound-manager";
import appConfig from "../lib/config.json";

const BG_COLOR = "#fff";
const WORD_STAGGER = 200;
const WORD_FADE_DURATION = 400;
const SUBTITLE_DELAY = 600;
const TAP_HINT_DELAY = 4000;

interface Props {
  onComplete: () => void;
}

function AnimatedWord({
  word,
  delay,
  style,
  isLast,
}: {
  word: string;
  delay: number;
  style: object;
  isLast?: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      // Delay sound slightly so it lands when the word is becoming visible
      setTimeout(playWordPop, 50);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: WORD_FADE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: WORD_FADE_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.Text style={[style, { opacity, transform: [{ translateY }] }]}>
      {word}{isLast ? "" : " "}
    </Animated.Text>
  );
}

function AnimatedLine({
  text,
  baseDelay,
  isSubtitle,
}: {
  text: string;
  baseDelay: number;
  isSubtitle?: boolean;
}) {
  const words = text.split(" ");

  return (
    <View
      style={{
        flexDirection: "row",
        alignSelf: "center",
      }}
    >
      {words.map((word, i) => (
        <AnimatedWord
          key={i}
          word={word}
          delay={baseDelay + i * WORD_STAGGER}
          isLast={i === words.length - 1}
          style={
            isSubtitle
              ? {
                  fontFamily: "InstrumentSans_500Medium",
                  fontSize: 18,
                  color: "#4a5568",
                  lineHeight: 26,
                }
              : {
                  fontFamily: "InstrumentSans_700Bold",
                  fontSize: 34,
                  color: "#111",
                  lineHeight: 42,
                }
          }
        />
      ))}
    </View>
  );
}

export default function Onboarding({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [tapReady, setTapReady] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const screen = appConfig.onboarding.screens[index];
  const isLast = index === appConfig.onboarding.screens.length - 1;

  const titleWordCount = screen.title.split(" ").length;
  const subtitleBaseDelay =
    titleWordCount * WORD_STAGGER + WORD_FADE_DURATION + SUBTITLE_DELAY;

  // Fade in on mount and after each screen change
  useEffect(() => {
    screenFade.setValue(0);
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setTransitioning(false));
  }, [index]);

  // Show tap hint after 4 seconds
  useEffect(() => {
    setTapReady(false);
    hintOpacity.setValue(0);

    const timer = setTimeout(() => {
      setTapReady(true);
      Animated.timing(hintOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, TAP_HINT_DELAY);

    return () => clearTimeout(timer);
  }, [index]);

  const advance = useCallback(() => {
    if (!tapReady || transitioning) return;
    setTransitioning(true);

    if (isLast) {
      playComplete();
    } else {
      playTransition();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Fade out hint
    Animated.timing(hintOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Fade out screen
    Animated.timing(screenFade, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (isLast) {
        onComplete();
      } else {
        setIndex((i) => i + 1);
      }
    });
  }, [tapReady, isLast, transitioning]);

  return (
    <Pressable onPress={advance} style={{ flex: 1, backgroundColor: BG_COLOR }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 40,
          paddingBottom: insets.bottom,
        }}
      >
        <Animated.View
          key={index}
          style={{ opacity: screenFade, width: "100%", gap: 14 }}
        >
          <AnimatedLine text={screen.title} baseDelay={200} />
          <AnimatedLine
            text={screen.subtitle}
            baseDelay={subtitleBaseDelay}
            isSubtitle
          />
        </Animated.View>
      </View>

      {/* Tap hint */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: insets.bottom + 48,
          alignItems: "center",
          opacity: hintOpacity,
        }}
      >
        <Text
          style={{
            fontFamily: "InstrumentSans_500Medium",
            fontSize: 13,
            color: "#8a95a5",
            letterSpacing: 0.3,
          }}
        >
          tap to continue
        </Text>
      </Animated.View>
    </Pressable>
  );
}
