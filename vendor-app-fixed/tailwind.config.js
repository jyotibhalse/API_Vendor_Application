export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#f4a623",
        surface: "#141618",
        surface2: "#1c1e22",
        surface3: "#242729",
        border: "#252830",
        bg: "#0c0d0f",
        green: { DEFAULT: "#22c55e", 400: "#4ade80", 500: "#22c55e" },
        red: { DEFAULT: "#ef4444" },
        blue: { DEFAULT: "#3b82f6" },
        purple: { DEFAULT: "#a855f7" },
        text: { DEFAULT: "#f0f0f0", muted: "#9ca3af", faint: "#6b7280" },
      },
      fontFamily: {
        syne: ["Syne", "sans-serif"],
        dm: ["DM Sans", "sans-serif"],
        sans: ["DM Sans", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
      },
      animation: {
        blink: "blink 1.5s ease-in-out infinite",
        fadeUp: "fadeUp 0.25s ease forwards",
      },
      keyframes: {
        blink: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
        fadeUp: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
}
