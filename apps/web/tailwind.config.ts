import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sampled from the CareStack hero: deep forest green + electric lime
        forest: {
          950: "#0B2A1C", // page background
          900: "#0E3120", // cards / panels
          800: "#143C28", // raised surfaces
          700: "#1B4A32", // borders / hovers
        },
        brand: {
          DEFAULT: "#C8F169", // lime CTA + eyebrow text
          hover: "#D9FA87",
          ink: "#0B2A1C", // text on lime
        },
        cream: "#F4F7F2", // primary text
        sage: "#A9BFAE", // muted text
      },
      fontFamily: {
        display: ["var(--font-display)", "Poppins", "sans-serif"],
        sans: ["var(--font-body)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
