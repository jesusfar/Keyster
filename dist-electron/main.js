import electron from 'electron';
const { app, BrowserWindow, ipcMain } = electron;
import * as path from 'path';
import { fileURLToPath } from 'url';
import { startLocalProxy, stopLocalProxy, updateProxyKeys } from './proxyServer.js';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });
    // Determine if we're in dev mode looking at Vite env, or production
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (isDev) {
        // Vite dev server URL
        mainWindow?.loadURL('http://localhost:5173');
        mainWindow?.webContents.openDevTools();
    }
    else {
        // Production build
        mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// --- IPC Handlers for Proxy ---
ipcMain.handle('proxy:start', async (_event, port) => {
    try {
        const success = await startLocalProxy(port, (msg) => {
            // Send logs back to renderer via the main window
            mainWindow?.webContents.send('proxy:log', msg);
        });
        return { success };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
ipcMain.handle('proxy:stop', async () => {
    try {
        const success = await stopLocalProxy();
        return { success };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
// Listen to key updates
ipcMain.on('proxy:updateKeys', (_event, keys) => {
    updateProxyKeys(keys);
});
// --- IPC Handlers for Agent Tools ---
ipcMain.handle('agent:exec', async (_event, command, cwd) => {
    return new Promise((resolve) => {
        exec(command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({
                stdout,
                stderr,
                error: error ? error.message : undefined
            });
        });
    });
});
ipcMain.handle('agent:readFile', async (_event, filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { content };
    }
    catch (err) {
        return { content: '', error: err.message };
    }
});
ipcMain.handle('agent:listDir', async (_event, dirPath) => {
    try {
        const files = await fs.readdir(dirPath);
        return { files };
    }
    catch (err) {
        return { files: [], error: err.message };
    }
});
