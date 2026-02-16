import React from "react";
import {
  Platform,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const IS_IOS_26 =
  Platform.OS === "ios" &&
  parseInt(String(Platform.Version), 10) >= 26;

const TAB_CONFIG: {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: "index", title: "Home", icon: "home", iconOutline: "home-outline" },
  {
    name: "calendar",
    title: "Calendar",
    icon: "calendar",
    iconOutline: "calendar-outline",
  },
  {
    name: "menu",
    title: "Settings",
    icon: "settings",
    iconOutline: "settings-outline",
  },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarOuter, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabBarPill}>
        <BlurView
          tint="systemUltraThinMaterialDark"
          intensity={30}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.tabBarRow}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const config = TAB_CONFIG.find((t) => t.name === route.name);
            if (!config) return null;

            const color = focused
              ? "#fff"
              : "rgba(255,255,255,0.35)";

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({
                    type: "tabLongPress",
                    target: route.key,
                  });
                }}
                style={[
                  styles.tabItem,
                  focused && styles.tabItemFocused,
                ]}
              >
                <Ionicons
                  name={config.iconOutline}
                  size={24}
                  color={color}
                  style={{
                    textShadowColor: color,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 0.5,
                  }}
                />
                <Text style={[styles.tabLabel, { color }]}>
                  {config.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  if (IS_IOS_26) {
    return (
      <NativeTabs
        sidebarAdaptable={false}
        tintColor="#ffffff"
        iconColor={{ default: "rgba(255,255,255,0.35)", selected: "#ffffff" }}
        labelStyle={{
          default: { color: "rgba(255,255,255,0.35)" },
          selected: { color: "#ffffff" },
        }}
      >
        <NativeTabs.Trigger name="index">
          <Label>Home</Label>
          <Icon sf={{ default: "house", selected: "house" }} />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calendar">
          <Label>Calendar</Label>
          <Icon sf={{ default: "calendar", selected: "calendar" }} />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="menu">
          <Label>Settings</Label>
          <Icon sf={{ default: "gearshape", selected: "gearshape" }} />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="menu" options={{ title: "Settings" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  tabBarPill: {
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tabBarRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 5,
    gap: 4,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 999,
  },
  tabItemFocused: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
});
