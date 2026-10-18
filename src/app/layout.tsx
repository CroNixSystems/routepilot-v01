import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoutePilot | Deine Route. Deine Kosten.",
  description: "Echte Straßenrouten vergleichen, Kraftstoffkosten transparent schätzen und Autobahnmeldungen prüfen.",
  applicationName: "RoutePilot",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b1015",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
