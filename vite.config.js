import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This config is used when running the app in pure browser mode (non-Electron)
// For Electron mode, see electron.vite.config.js
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'lucide-react',
    ],
  },
  server: {
    hmr: false,
    allowedHosts: ['control0.northelite0.com'],
    watch: {
      ignored: [
        '**/omr_engine/**',
        '**/local_data/**',
        '**/wppconnect-master/**',
        '**/release/**',
        '**/dist/**',
        '**/RENAME/**',
        '**/teacher-lookup-standalone/**',
        '**/student-portal-standalone/**',
        '**/.git/**',
        '**/node_modules/**',
      ],
    },
    warmup: {
      clientFiles: ['./src/main.jsx', './src/App.jsx', './src/index.css'],
    },
    proxy: {
      '/api/omr': {
        target: process.env.OMR_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/omr/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (!res || res.headersSent) return
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({
              detail: 'محرك OMR غير شغّال. شغّل omr_engine ثم أعد تحميل الصفحة.',
              error: String(err?.code || err?.message || 'proxy_error'),
            }))
          })
        },
      },
      '/api/whatsapp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/whatsapp/, '')
      }
    }
  }
})
