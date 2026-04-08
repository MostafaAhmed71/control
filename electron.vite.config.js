import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    entry: 'src/main/index.js',
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    entry: 'src/preload/index.js',
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: 'index.html'
        }
      }
    },
    plugins: [react()],
    server: {
      hmr: false,
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
          rewrite: (p) => p.replace(/^\/api-omr/, '')
        },
        '/api-whatsapp': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api-whatsapp/, '')
        }
      }
    }
  }
})
