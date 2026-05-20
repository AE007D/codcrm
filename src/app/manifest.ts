import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COD CRM",
    short_name: "COD CRM",
    description: "Gestion des commandes COD au Maroc",
    start_url: "/",
    display: "standalone",
    background_color: "#F0F4FF",
    theme_color: "#2563EB",
    orientation: "portrait",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
