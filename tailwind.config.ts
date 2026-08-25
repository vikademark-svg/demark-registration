import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141210",       // майже чорний, теплий відтінок (як текст/хедер DeMark)
        paper: "#F7F4EF",     // теплий білий фон
        sand: "#EAE2D6",      // бежевий акцент (шкіра/взуття)
        clay: "#B08D57",      // акцент, "золото" для кнопок/лінків
        line: "#DCD3C4",      // тонкі роздільники
        muted: "#847C6E",     // другорядний текст
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
