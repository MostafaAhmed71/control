import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This config is used when running the app in pure browser mode (non-Electron)
// For Electron mode, see electron.vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: false,
    allowedHosts: ['control0.northelite0.com'],
    watch: {
      ignored: [
        '**/omr_engine/debug_scans/**',
        '**/omr_engine/*.jsonl',
        '**/omr_engine/__pycache__/**',
        '**/omr_engine/*.pyc',
      ],
    },
    proxy: {
      '/api-omr': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-omr/, '')
      },
      '/api-whatsapp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-whatsapp/, '')
      }
    }
  }
})
