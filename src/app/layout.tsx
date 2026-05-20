import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PixelTracker from "@/components/PixelTracker";
import NavigationProgress from "@/components/NavigationProgress";
import PushSubscriber from "@/components/PushSubscriber";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "COD CRM — Commandez. Expédiez. Encaissez.",
  description: "La plateforme tout-en-un pour les e-commerçants COD au Maroc — gestion des commandes, livraisons, équipe et finances.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "COD CRM",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavigationProgress />
        <PixelTracker />
        <PushSubscriber />
        {children}
      </body>
    </html>
  );
}
