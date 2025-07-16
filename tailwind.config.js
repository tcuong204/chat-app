/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        manrope: ["Manrope"],
        roboto: ["Roboto"],
        nunito: ["Nunito"],
      },
      colors: {
        primary: "#a855f7",
        secondary: "#111827",
        tertiary: "#1f2937",
        accent: "#007bff",
        neutral: "#6b7280",
        "base-100": "#f3f4f6",
        "base-200": "#e5e7eb",
        "base-300": "#d1d5db",
        "base-400": "#9ca3af",
        "base-500": "#6b7280",
        "base-600": "#4b5563",
        "base-700": "#374151",
        "base-800": "#1f2937",
      },
    },
  },
  plugins: [],
};
