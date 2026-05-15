import type { Config } from "tailwindcss";

// Blue-violet (periwinkle) palette.  Every surface lives somewhere on the
// blue → indigo → violet axis.  No pure-white surfaces anywhere.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1a205a",   // deep indigo for headings + primary buttons
          muted: "#4b54a3",     // secondary text
          subtle: "#7e85c4",    // labels / placeholders
        },
        paper: "#dde4f7",       // softer page background tile
        surface: "#d8def3",     // primary card surface — clearly blue-violet
        "surface-soft": "#e6eafa", // inner panels / inputs / hover (still tinted)
        "surface-strong": "#c5cdec", // active state / pressed
        line: "#bcc7e6",        // borders
        accent: "#4338ca",      // bright indigo accent (chart lines)
        safe: "#16a34a",
        watch: "#d97706",
        risk: "#dc2626",
        neutral: "#6b7280",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card:
          "0 1px 2px rgba(26, 32, 90, 0.08), 0 8px 24px -10px rgba(26, 32, 90, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
