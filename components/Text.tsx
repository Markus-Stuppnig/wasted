import React, { forwardRef } from "react";
import {
  Text as RNText,
  TextProps,
  StyleSheet,
  type TextStyle,
} from "react-native";

const CLASS_WEIGHT_MAP: [string, string][] = [
  ["font-black", "InstrumentSans_700Bold"],
  ["font-extrabold", "InstrumentSans_700Bold"],
  ["font-bold", "InstrumentSans_700Bold"],
  ["font-semibold", "InstrumentSans_600SemiBold"],
  ["font-medium", "InstrumentSans_500Medium"],
  ["font-normal", "InstrumentSans_400Regular"],
];

const WEIGHT_CLASS_NAMES = new Set(CLASS_WEIGHT_MAP.map(([cls]) => cls));

const STYLE_WEIGHT_MAP: Record<string, string> = {
  normal: "InstrumentSans_400Regular",
  "400": "InstrumentSans_400Regular",
  "500": "InstrumentSans_500Medium",
  "600": "InstrumentSans_600SemiBold",
  bold: "InstrumentSans_700Bold",
  "700": "InstrumentSans_700Bold",
  "800": "InstrumentSans_700Bold",
};

const DEFAULT_FONT = "InstrumentSans_400Regular";

export const Text = forwardRef<RNText, TextProps & { className?: string }>(
  ({ style, className, ...props }, ref) => {
    let fontFamily = DEFAULT_FONT;

    // Resolve font family from NativeWind className weight classes
    if (className) {
      const classes = className.split(/\s+/);
      for (const [cls, font] of CLASS_WEIGHT_MAP) {
        if (classes.includes(cls)) {
          fontFamily = font;
          break;
        }
      }
    }

    // Explicit style fontWeight overrides className
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    if (flat?.fontWeight != null) {
      fontFamily = STYLE_WEIGHT_MAP[String(flat.fontWeight)] ?? fontFamily;
    }

    // Strip weight classes so NativeWind doesn't generate a conflicting fontWeight
    const cleanedClassName = className
      ?.split(/\s+/)
      .filter((c) => !WEIGHT_CLASS_NAMES.has(c))
      .join(" ");

    // Strip fontWeight/fontFamily from explicit style to avoid conflicts
    const { fontWeight: _fw, fontFamily: _ff, ...restStyle } = flat ?? {};

    return (
      <RNText
        ref={ref}
        className={cleanedClassName}
        {...props}
        style={[restStyle, { fontFamily }]}
      />
    );
  },
);
