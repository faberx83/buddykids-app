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
        // Accento del tenant "Partner" (gestori centro) — sottodominio partner.*
        partner: { DEFAULT: "#1FA88E", light: "#E3F5F1", mid: "#9FDCCF" },
        // Sfondo scuro del tenant "Admin" (piattaforma) — sottodominio admin.*
        navy: { DEFAULT: "#1A1D2E", 2: "#242A40", 3: "#343B57", text2: "#9CA6C4" },
        // Rebrand TRAMA (richiesta di Fabrizio, handoff design "TRAMA Design
        // Handoff.zip") — namespace dedicato per non toccare i token LEGACY
        // sopra (sky/aqua/orange/purple/yellow/green/ink/navy restano
        // invariati finché non restyling schermata per schermata nelle
        // prossime sprint). Significato colore: navy = ink/testi/primario,
        // coral = Sport, green = Natura/successo, violet = Arte/CTA
        // primaria, orange = Formazione/attenzione, lilac = Socialità.
        trama: {
          navy: "#172A4D",
          coral: "#F66B5E",
          green: "#2DBA8C",
          violet: "#6F63C5",
          orange: "#F6A623",
          lilac: "#B7A4E3",
          error: "#E8543E",
          "error-light": "#FFEBE8",
          card: "#F7F9FC",
          page: "#FDFCFA",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        // Titoli/hero del rebrand TRAMA (Poppins SemiBold 18-34px) — vedi
        // "TRAMA - Dev Handoff.dc.html" sezione 3. Inter resta il font di
        // default per tutto il resto (invariato).
        poppins: ["Poppins", "sans-serif"],
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
