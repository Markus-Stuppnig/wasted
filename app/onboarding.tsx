import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import appConfig from "./config.json";

const CREAM = "#FAF7F2";

interface Props {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const screen = appConfig.onboarding.screens[index];
  const isLast = index === appConfig.onboarding.screens.length - 1;

  const advance = () => {
    if (isLast) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onComplete());
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIndex((i) => i + 1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <Pressable
      onPress={advance}
      className="flex-1"
      style={{ backgroundColor: CREAM }}
    >
      <View
        className="flex-1 justify-center items-center px-10"
        style={{ paddingBottom: insets.bottom }}
      >
        <Animated.View
          className="items-center"
          style={{ opacity: fadeAnim }}
        >
          <Text
            className="text-[32px] text-center mb-3"
            style={{
              fontFamily: "InstrumentSans_700Bold",
              color: "#1a1a1a",
            }}
          >
            {screen.title}
          </Text>
          <Text
            className="text-lg text-center leading-6"
            style={{
              fontFamily: "InstrumentSans_600SemiBold",
              color: "#555",
            }}
          >
            {screen.subtitle}
          </Text>
        </Animated.View>
      </View>

      {/* Bottom indicator area */}
      <View
        className="absolute left-0 right-0 items-center gap-4"
        style={{ bottom: insets.bottom + 40 }}
      >
        {/* Dots */}
        <View className="flex-row gap-2">
          {appConfig.onboarding.screens.map((_, i) => (
            <View
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: i === index ? "#1a1a1a" : "#ccc",
              }}
            />
          ))}
        </View>

        {/* Hint text */}
        <Text
          className="text-xs"
          style={{
            fontFamily: "InstrumentSans_600SemiBold",
            color: "#aaa",
          }}
        >
          tap anywhere to continue
        </Text>
      </View>
    </Pressable>
  );
}
