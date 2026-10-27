import type { MetadataRoute } from "next";

// TRAMA — le sole pagine pubbliche da far trovare (20/10/2026). Vedi app/robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://tramapp.it/benvenuto", changeFrequency: "weekly", priority: 1 },
    { url: "https://tramapp.it/centri", changeFrequency: "monthly", priority: 0.8 },
    { url: "https://tramapp.it/privacy", changeFrequency: "monthly", priority: 0.3 },
    { url: "https://tramapp.it/terms", changeFrequency: "monthly", priority: 0.3 },
  ];
}
