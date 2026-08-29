import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.jpg'],
      manifest: {
        name: 'Fogón Dorado ERP 3 - Local 3',
        short_name: 'FogónDorado3',
        description: 'Sistema ERP de Gestión para Restaurante Fogón Dorado Local 3',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: '/logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg}'],
        cleanupOutdatedCaches: true
      }
    })
  ],
  server: {
    allowedHosts: ['fogon.valetec.pe', 'localhost', '127.0.0.1', '192.168.100.93', true],
    host: true, // Escucha en todas las IPs locales y de red (necesario para Docker)
    port: 5176,
    hmr: {
      overlay: false // 🚫 Desactiva por completo la pantalla roja de advertencias de Vite HMR en pantalla
    },
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: 'http://backend:3002', // Points to the backend service inside Docker
        changeOrigin: true,
        rewrite: (path) => path,
      }
    }
  }
})
