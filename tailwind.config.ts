import type { Config } from "tailwindcss";

// Blue-themed palette.  All "ink" tokens map to deep navy/blue so the
// existing className surface (`bg-ink`, `text-ink`, `text-ink-muted`,
// `bg-paper`, `border-line`) automatically takes on the new look.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0b2a6b",   // primary deep blue (headlines, primary buttons)
          muted: "#3b5d9e",     // secondary text
          subtle: "#7c92b8",    // labels, hints
        },
        paper: "#eaf1fb",       // soft blue page / surface tint
        line: "#cfdcef",        // borders
        accent: "#1d4ed8",      // brand accent (bright blue)
        safe: "#16a34a",        // semantic — kept green for clarity
        watch: "#d97706",       // semantic amber
        risk: "#dc2626",        // semantic red
        neutral: "#6b7280",
      },
      backgroundImage: {
        "page-blue":
          "radial-gradient(at 0% 0%, rgba(99,120,255,0.10) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(59,130,246,0.08) 0px, transparent 50%), linear-gradient(180deg, #eaf1fb 0%, #f4f8ff 100%)",
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
          "0 1px 2px rgba(11, 42, 107, 0.06), 0 6px 18px -8px rgba(11, 42, 107, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
