import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DeMark",
    short_name: "DeMark",
    description: "Ваші дані, знижка та новини магазинів DeMark",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#434445",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
