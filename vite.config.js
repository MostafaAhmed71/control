import dns from 'node:dns'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Windows: Node may bind Vite to IPv6 [::1] only. Then http://localhost:5173 hangs
// after a long session while 127.0.0.1 refuses. Force IPv4.
dns.setDefaultResultOrder('ipv4first')

const omrTarget = process.env.OMR_PROXY_TARGET || 'http://127.0.0.1:8000'

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
    host: '127.0.0.1',
    port: 5173,
    hmr: {
      host: '127.0.0.1',
      protocol: 'ws',
    },
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
    proxy: {
      '/api/omr': {
        target: omrTarget,
        changeOrigin: true,
        timeout: 20000,
        proxyTimeout: 20000,
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
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        timeout: 15000,
        proxyTimeout: 15000,
        rewrite: (path) => path.replace(/^\/api\/whatsapp/, ''),
      },
    },
  },
})
