// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { AstroPWAIntegration as AstroPWA } from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  site: "https://fileshush.com",
  integrations: [
    AstroPWA({
      registerType: "autoUpdate",
      manifest: false, // we ship public/site.webmanifest ourselves
      workbox: {
        navigateFallback: "/404.html",
        globPatterns: ["**/*.{html,js,css,svg,png,ico,woff2,wasm,mjs,webmanifest}"],
        runtimeCaching: [
          {
            // ffmpeg converter code (code only, never user files)
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@ffmpeg\/core@/,
            handler: "CacheFirst",
            options: {
              cacheName: "ffmpeg-core",
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    sitemap({
      // The 404 page is not a real page for search engines.
      filter: (page) => !/\/404(\/|\.html)?$/.test(page),
    }),
  ],
});
