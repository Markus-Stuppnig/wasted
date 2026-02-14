const config = require("./app/config.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        dark: "#0a1628",
        accent: config.accentColor,
        "white-65": "rgba(255,255,255,0.65)",
        "white-50": "rgba(255,255,255,0.5)",
        "white-45": "rgba(255,255,255,0.45)",
        "white-40": "rgba(255,255,255,0.4)",
        "white-35": "rgba(255,255,255,0.35)",
        "white-30": "rgba(255,255,255,0.3)",
        "white-25": "rgba(255,255,255,0.25)",
        "white-20": "rgba(255,255,255,0.2)",
        "white-15": "rgba(255,255,255,0.15)",
        "white-12": "rgba(255,255,255,0.12)",
        "white-08": "rgba(255,255,255,0.08)",
        "white-06": "rgba(255,255,255,0.06)",
        "white-04": "rgba(255,255,255,0.04)",
        "modal-top": "#2a4a72",
        "modal-mid": "#1a3355",
        "modal-bot": "#0e1f3a",
        "tooltip-bg": "rgba(30,50,80,1.0)",
      },
      borderRadius: {
        card: "22px",
        "card-lg": "28px",
      },
      fontSize: {
        hero: ["72px", { lineHeight: "1" }],
        "hero-sm": ["64px", { lineHeight: "1" }],
        "3xl-plus": ["38px", { lineHeight: "1" }],
        "2xl": ["32px", { lineHeight: "1.2" }],
        xl: ["20px", { lineHeight: "1.3" }],
        "lg-plus": ["18px", { lineHeight: "1.3" }],
        lg: ["17px", { lineHeight: "1.3" }],
        base: ["16px", { lineHeight: "1.3" }],
        "base-sm": ["15px", { lineHeight: "1.3" }],
        sm: ["14px", { lineHeight: "1.3" }],
        xs: ["13px", { lineHeight: "1.46" }],
        "2xs": ["11px", { lineHeight: "1.3" }],
      },
      letterSpacing: {
        "tight-2": "-2px",
      },
    },
  },
  plugins: [],
};
