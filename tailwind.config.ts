import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Кольори звірені напряму з офіційного лого demark.ua (семпл пікселів
        // з favicon сайту) + реальних hex-значень з CSS сайту, а не підібрані
        // "на око" — див. нотатку в README.
        ink: "#434445",       // фірмовий графітовий (фон лого-монограми, кнопки/хедер сайту)
        paper: "#FFFFFF",     // чистий білий — домінантний фон сайту demark.ua
        sand: "#EEEEEE",      // світло-сірий, секції/розділювачі сайту
        line: "#E3E3E3",      // тонкі роздільники
        muted: "#6B6B6B",     // другорядний текст
        success: "#0F7A46",   // позитивне підтвердження (автовизначення магазину)
        sale: "#DF3131",      // акцент знижки/акції — той самий червоний, що й на сайті для sale-міток
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.22em",
      },
      borderRadius: {
        sm: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
