import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Blackridge brand palette
        carbon: {
          950: "#080808",
          900: "#0d0d0d",
          800: "#141414",
          700: "#1c1c1c",
          600: "#242424",
          500: "#2e2e2e",
        },
        chrome: {
          50: "#f8f8f8",
          100: "#e8e8e8",
          200: "#d0d0d0",
          300: "#b0b0b0",
          400: "#888888",
          500: "#666666",
        },
        racing: {
          red: "#e8001c",
          "red-dark": "#a0001a",
          "red-glow": "#ff1a35",
          gold: "#c9a84c",
          "gold-light": "#e8c970",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "carbon-texture": "url('/textures/carbon.svg')",
        "grid-fine":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-fine": "24px 24px",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-in-right": "slideInRight 0.5s ease forwards",
        "pulse-red": "pulseRed 2s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "scan-line": "scanLine 3s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseRed: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(232, 0, 28, 0)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(232, 0, 28, 0.3)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      boxShadow: {
        "red-glow": "0 0 20px rgba(232, 0, 28, 0.4)",
        "red-glow-sm": "0 0 10px rgba(232, 0, 28, 0.3)",
        "chrome-glow": "0 0 20px rgba(255, 255, 255, 0.1)",
        inner: "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
