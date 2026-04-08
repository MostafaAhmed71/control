module.exports = {
  apps: [
    {
      name: 'elite-omr-engine',
      script: 'e:/control/omr_engine/venv/Scripts/python.exe',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      cwd: 'e:/control/omr_engine',
      interpreter: 'none', // السماح لمسار البايثون المباشر بالعمل
      autorestart: true,
      watch: false
    },
    {
      name: 'elite-whatsapp',
      script: 'whatsapp-server.js',
      cwd: 'e:/control/wppconnect-master',
      autorestart: true,
      watch: false
    },
    {
      name: 'elite-frontend',
      script: 'pm2-vite-server.js',
      cwd: 'e:/control',
      autorestart: true,
      watch: false
    },
    {
      name: 'elite-bridge',
      script: 'node',
      args: 'elite_bridge.js',
      cwd: 'e:/control',
      autorestart: true,
      watch: false
    },
    {
      name: 'elite-ngrok',
      script: 'node',
      args: 'start-ngrok.js',
      cwd: 'e:/control',
      autorestart: true,
      watch: false
    }
  ]
};
