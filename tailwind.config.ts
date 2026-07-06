import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: { DEFAULT: "#4DAFEF", light: "#E8F6FD", mid: "#B8DFF6" },
        aqua: { DEFAULT: "#3ECFB2", light: "#E3F9F5", mid: "#A8EDE2" },
        orange: { DEFAULT: "#FF8C5A", light: "#FFF0EA", mid: "#FFD0BB" },
        purple: { DEFAULT: "#8B7CF8", light: "#F0EEFF" },
        yellow: { DEFAULT: "#FFD166", light: "#FFF8E7" },
        green: { DEFAULT: "#52C87A", light: "#E8F9EE" },
        ink: { DEFAULT: "#1A1D2E", 2: "#6B7280", 3: "#9CA3AF" },
        bg: "#F7F9FC",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "22px",
        xl: "28px",
      },
    },
  },
  plugins: [],
};
export default config;
