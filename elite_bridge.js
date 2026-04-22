import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 9000;

// IMPORTANT: لا تضع أسرار (Tokens) داخل الكود.
// استخدم متغيرات البيئة عند الحاجة (مثال):
// - NGROK_AUTH_TOKEN
// - STATIC_DOMAIN
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN || '';
const STATIC_DOMAIN = process.env.STATIC_DOMAIN || '';

// 1. توجيه طلبات محرك التصحيح (OMR Engine)
app.use('/api/omr', createProxyMiddleware({
    target: 'http://localhost:8000',
    changeOrigin: true,
    pathRewrite: { '^/api/omr': '' },
}));

// 2. توجيه طلبات محرك الواتساب (WhatsApp)
app.use('/api/whatsapp', createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: { '^/api/whatsapp': '' },
}));

// 3. توجيه باقي الطلبات إلى الموقع (Vite Frontend)
app.use('/', createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
}));

async function startBridge() {
    // تشغيل سيرفر الجسر المحلي فقط كـ Reverse Proxy صلب ومستقر
    app.listen(PORT, () => {
        console.log(`\n✅ "جسر النخبة الموحد" يعمل محلياً وكـ Proxy على البورت ${PORT}`);
        console.log(`🔗 ينتظر الآن الربط السحابي عبر Ngrok CLI...`);
    });
}

startBridge();
