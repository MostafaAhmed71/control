import electron from 'electron';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { app, BrowserWindow } = electron;

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let pythonProcess;
let whatsappProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Elite Control - نظام إدارة اختبارات نخبة الشمال",
    backgroundColor: '#0f172a',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackends() {
  console.log('🚀 Starting backends...');

  const pythonPath = 'e:/control/omr_engine/venv/Scripts/python.exe';
  pythonProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
    cwd: 'e:/control/omr_engine'
  });

  pythonProcess.stdout.on('data', (data) => console.log(`[Python] ${data}`));

  const whatsappPath = 'e:/control/wppconnect-master/whatsapp-server.js';
  whatsappProcess = spawn('node', [whatsappPath], {
    cwd: 'e:/control/wppconnect-master'
  });

  whatsappProcess.stdout.on('data', (data) => console.log(`[WhatsApp] ${data}`));
}

app.whenReady().then(() => {
  startBackends();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  if (whatsappProcess) whatsappProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
