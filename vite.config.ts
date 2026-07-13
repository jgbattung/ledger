import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { APP_NAME } from './src/config/app.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Precache the built app shell plus every vendored exercise image
      // (LG-004); the exercise JSON itself rides inside the JS bundle,
      // which globPatterns already covers via the js extension.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}', 'exercises/**/*.jpg'],
      },
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0075b3',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
