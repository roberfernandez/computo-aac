import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cómputo AAC",
  description: "Calculadora del calendario laboral AAC: cómputo diario, semanal, mensual y anual.",
  applicationName: "Cómputo AAC",
  manifest: "/computo-aac/manifest.webmanifest",
  icons: {
    icon: [{ url: "/computo-aac/computo-192.png?v=2", sizes: "192x192", type: "image/png" }],
    shortcut: "/computo-aac/computo-192.png?v=2",
    apple: [{ url: "/computo-aac/computo-192.png?v=2", sizes: "192x192", type: "image/png" }],
  },
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body><header className="tmb-return"><a href="https://roberfernandez.github.io/tmb-agent/">← TMB Agent</a></header>{children}</body></html>;
}
