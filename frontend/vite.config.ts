import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from the root of momentum.praveendhra.com. Set BASE_PATH=/Momentum/ to serve from praveendhra.github.io/Momentum/ instead.
const base = process.env.BASE_PATH ?? '/'
// Native (Capacitor) builds are served from the app bundle: no service worker there.
const native = !!process.env.CAP_BUILD

// https://vite.dev/config/
export default defineConfig({
  base: native ? './' : base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: native,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Momentum',
        short_name: 'Momentum',
        description: 'Track your daily self-improvement progress',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Supabase API calls must always hit the network (auth + fresh data).
        navigateFallbackDenylist: [/^\/auth/],
      },
    }),
  ],
})
