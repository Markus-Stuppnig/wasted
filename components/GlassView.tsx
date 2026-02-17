import { Platform } from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";

type GlassViewProps = Omit<BlurViewProps, "experimentalBlurMethod">;

export function GlassView(props: GlassViewProps) {
  const { tint, ...rest } = props;

  if (Platform.OS === "android") {
    return (
      <BlurView
        {...rest}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
      />
    );
  }

  return <BlurView {...rest} tint={tint} />;
}
