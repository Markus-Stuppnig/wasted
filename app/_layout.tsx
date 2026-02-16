import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Asset } from "expo-asset";
import {
  useFonts,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import { loadSettings, saveSettings } from "./settings-storage";
import { checkAndStopAtBedTime } from "./storage";
import Onboarding from "./onboarding";
import { backgroundSource } from "./Background";
import { initializeSounds } from "./utils/sound-manager";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  const [bgReady, setBgReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const onboardingOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Asset.loadAsync(backgroundSource).then(() => setBgReady(true));
  }, []);

  useEffect(() => {
    const settings = loadSettings();
    // Auto-stop any running session if bed time passed while app was closed
    checkAndStopAtBedTime(settings.bedTimeMinutes);
    setShowOnboarding(!settings.onboardingCompleted);
    if (!settings.onboardingCompleted) {
      initializeSounds();
    }
  }, []);

  const handleOnboardingComplete = () => {
    const settings = loadSettings();
    settings.onboardingCompleted = true;
    saveSettings(settings);
    Animated.timing(onboardingOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowOnboarding(false);
    });
  };

  if (!fontsLoaded || !bgReady || showOnboarding === null) {
    return (
      <View className="flex-1 bg-dark items-center justify-center">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <StatusBar style={showOnboarding ? "dark" : "light"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a1628' } }} />
      {showOnboarding && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: onboardingOpacity }]}>
          <Onboarding onComplete={handleOnboardingComplete} />
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}
