import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cómputo laboral AAC",
  description: "Calculadora del calendario laboral AAC: cómputo diario, semanal, mensual y anual.",
  applicationName: "Cómputo AAC",
  manifest: "/manifest-train-v3.webmanifest",
  icons: {
    icon: [
      { url: "/train-shortcut-v4.ico", sizes: "any", type: "image/x-icon" },
      { url: "/train-icon-v3.svg", type: "image/svg+xml" },
      { url: "/train-icon-192-v3.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/train-shortcut-v4.ico",
    apple: [{ url: "/train-apple-v3.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>{children}</body></html>;
}
