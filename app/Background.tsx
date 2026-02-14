import { ImageBackground, StyleSheet, View } from "react-native";
import type { PropsWithChildren } from "react";

export const backgroundSource = require("../assets/background.png");

export default function Background({ children }: PropsWithChildren) {
  return (
    <View className="flex-1 bg-dark">
      <ImageBackground
        source={backgroundSource}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {children}
      </ImageBackground>
    </View>
  );
}
