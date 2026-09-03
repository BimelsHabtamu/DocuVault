import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',   // listen on all interfaces — required for ngrok and LAN access
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // Forward ngrok's bypass header to the backend so it doesn't get dropped
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Pass through the ngrok-skip-browser-warning header if present
            if (req.headers['ngrok-skip-browser-warning']) {
              proxyReq.setHeader('ngrok-skip-browser-warning', req.headers['ngrok-skip-browser-warning']);
            }
          });
        },
      },
    },
  },
})
