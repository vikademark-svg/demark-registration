import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

// Оригінальні шрифти сайту demark.ua (Kepler для заголовків, DIN Next /
// Helvetica Neue для основного тексту) — комерційні, недоступні через Google
// Fonts. Cormorant Garamond і Inter — найближчі безкоштовні відповідники за
// характером (елегантний serif із засічками / нейтральний геометричний sans).
const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Реєстрація | DeMark",
  description: "Реєстрація відвідувачів магазинів DeMark",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DeMark",
  },
};

export const viewport: Viewport = {
  themeColor: "#434445",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body className={`${display.variable} ${body.variable} font-body bg-paper text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
