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
        // The OpenCC dictionaries (~460 KB gzip) are only needed for Chinese banks,
        // so they stay out of the install-time precache: English-only users never
        // download them. They are cached on first fetch instead, and the app
        // prefetches them in idle time once a Chinese bank is open, so the
        // 简体/繁體 switch still works offline afterwards.
        globIgnores: ['**/opencc-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/opencc-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'opencc', expiration: { maxEntries: 32 } },
          },
        ],
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
  // The lazily loaded OpenCC phrase dictionary (Simplified->Traditional display)
  // is ~1 MB by itself; it never loads at startup, so don't warn about it.
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // A fixed prefix lets the service worker route these chunks (see workbox above).
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some((id) => id.includes('/node_modules/opencc-js/'))
            ? 'assets/opencc-[name]-[hash].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  server: { host: true, allowedHosts: ['.ts.net'] },
  preview: { host: true, allowedHosts: ['.ts.net'] },
})
