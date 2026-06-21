import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // apple-touch-icon isn't a manifest icon, so include it explicitly. The
      // manifest icons (192/512/maskable) are auto-precached by the plugin, so
      // they're intentionally NOT in globPatterns below (would double-precache).
      // apple-touch-icon + the bundled sample bank are precached explicitly so
      // "Load sample" works offline (a .json/.zip isn't matched by globPatterns).
      includeAssets: ['apple-touch-icon.png', 'samples/demo.quizbank.json'],
      workbox: {
        // Only app shell here; the manifest + its icons are auto-precached by the plugin.
        globPatterns: ['**/*.{js,css,html}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Quizer',
        short_name: 'Quizer',
        description: 'Offline quiz trainer — import your own question banks',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { host: true, allowedHosts: ['.ts.net'] },
  preview: { host: true, allowedHosts: ['.ts.net'] },
})
