import type { Config } from "tailwindcss";

const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: withAlpha("--cr-bg"),
        "bg-2": withAlpha("--cr-bg-2"),
        panel: withAlpha("--cr-panel"),
        "panel-2": withAlpha("--cr-panel-2"),
        "panel-3": withAlpha("--cr-panel-3"),
        line: withAlpha("--cr-line"),
        "line-soft": withAlpha("--cr-line-soft"),
        accent: withAlpha("--cr-accent"),
        up: withAlpha("--cr-up"),
        down: withAlpha("--cr-down"),
        voltage: withAlpha("--cr-voltage"),
        cyan: withAlpha("--cr-cyan"),
        text: withAlpha("--cr-text"),
        muted: withAlpha("--cr-muted"),
        faint: withAlpha("--cr-faint"),
        warn: withAlpha("--cr-warn"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "PingFang SC", "Microsoft YaHei", "sans-serif"],
        mono: ['"JetBrains Mono"', "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        pixel: ['"Courier New"', "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "13px" }],
        xs: ["11px", { lineHeight: "15px" }],
        sm: ["12px", { lineHeight: "17px" }],
        base: ["13px", { lineHeight: "19px" }],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "5px",
        md: "7px",
        lg: "10px",
      },
      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "18": "4.5rem",
      },
      keyframes: {
        "flash-up": {
          "0%": { backgroundColor: "rgba(57,255,136,0.30)" },
          "100%": { backgroundColor: "rgba(57,255,136,0)" },
        },
        "flash-down": {
          "0%": { backgroundColor: "rgba(255,59,107,0.30)" },
          "100%": { backgroundColor: "rgba(255,59,107,0)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "flash-up": "flash-up 700ms ease-out",
        "flash-down": "flash-down 700ms ease-out",
        "fade-in": "fade-in 180ms ease-out",
        pulse: "pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
