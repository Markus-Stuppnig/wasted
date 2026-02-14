import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  if (Platform.OS === "ios") {
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
          <Icon sf={{ default: "house", selected: "house.fill" }} />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calendar">
          <Label>Calendar</Label>
          <Icon sf={{ default: "calendar", selected: "calendar.circle.fill" }} />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="menu">
          <Label>Settings</Label>
          <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "rgba(255,255,255,0.35)",
        tabBarStyle: {
          backgroundColor: "rgba(10,22,40,0.95)",
          borderTopColor: "rgba(255,255,255,0.1)",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
