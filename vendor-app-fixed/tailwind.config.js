export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surface2: "rgb(var(--color-surface-2) / <alpha-value>)",
        surface3: "rgb(var(--color-surface-3) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        green: {
          DEFAULT: "rgb(var(--color-green) / <alpha-value>)",
          400: "rgb(var(--color-green-400) / <alpha-value>)",
          500: "rgb(var(--color-green) / <alpha-value>)",
        },
        red: { DEFAULT: "rgb(var(--color-red) / <alpha-value>)" },
        blue: { DEFAULT: "rgb(var(--color-blue) / <alpha-value>)" },
        purple: { DEFAULT: "rgb(var(--color-purple) / <alpha-value>)" },
        text: {
          DEFAULT: "rgb(var(--color-text-primary) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
          faint: "rgb(var(--color-text-faint) / <alpha-value>)",
        },
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
