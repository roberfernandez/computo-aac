import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cómputo AAC",
  description: "Calculadora del calendario laboral AAC: cómputo diario, semanal, mensual y anual.",
  applicationName: "Cómputo AAC",
  manifest: "/computo-aac/manifest-train-v3.webmanifest",
  icons: {
    icon: [
      { url: "/computo-aac/train-shortcut-v4.ico", sizes: "any", type: "image/x-icon" },
      { url: "/computo-aac/train-icon-v3.svg", type: "image/svg+xml" },
      { url: "/computo-aac/train-icon-192-v3.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/computo-aac/train-shortcut-v4.ico",
    apple: [{ url: "/computo-aac/train-apple-v3.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body><header className="tmb-return"><a href="https://roberfernandez.github.io/tmb-agent/">← TMB Agent</a></header>{children}</body></html>;
}
