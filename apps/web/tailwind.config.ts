import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#f8f5ef",
        rail: "#9f1239",
        moss: "#155e63",
        brass: "#a16207"
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 18px 70px rgb(17 24 39 / 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
