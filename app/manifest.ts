import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cómputo AAC",
    short_name: "Cómputo AAC",
    description: "Previsión y seguimiento del cómputo laboral AAC.",
    start_url: "/computo-aac/",
    display: "standalone",
    background_color: "#07151b",
    theme_color: "#07151b",
    lang: "es",
    icons: [
      {
        src: "/computo-aac/computo-192.png?v=2",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/computo-aac/computo-192.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
