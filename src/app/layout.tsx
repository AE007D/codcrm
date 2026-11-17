import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PixelTracker from "@/components/PixelTracker";
import NavigationProgress from "@/components/NavigationProgress";
import PushSubscriber from "@/components/PushSubscriber";
import { LangProvider } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#080B2C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (() => {
            let theme;
            try { theme = localStorage.getItem("codcrm-theme"); } catch {}
            document.documentElement.dataset.theme = theme === "dark" || theme === "light"
              ? theme
              : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
          })();
        ` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <LangProvider>
          <NavigationProgress />
          <PixelTracker />
          <PushSubscriber />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
