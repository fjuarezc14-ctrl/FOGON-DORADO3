import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    allowedHosts: true,
    host: true, // Listen on all local IPs (needed for Docker)
    port: 5176,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: 'http://backend:3002', // Points to the backend service inside Docker, or http://localhost:3002 if running locally
        changeOrigin: true,
        rewrite: (path) => path,
      }
    }
  }
})
