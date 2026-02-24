"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const proxyServer_cjs_1 = require("./proxyServer.cjs");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });
    // Determine if we're in dev mode looking at Vite env, or production
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
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
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// --- IPC Handlers for Proxy ---
electron_1.ipcMain.handle('proxy:start', async (_event, port) => {
    try {
        const success = await (0, proxyServer_cjs_1.startLocalProxy)(port, (msg) => {
            // Send logs back to renderer via the main window
            mainWindow?.webContents.send('proxy:log', msg);
        });
        return { success };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
electron_1.ipcMain.handle('proxy:stop', async () => {
    try {
        const success = await (0, proxyServer_cjs_1.stopLocalProxy)();
        return { success };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
// Listen to key updates
electron_1.ipcMain.on('proxy:updateKeys', (_event, keys) => {
    (0, proxyServer_cjs_1.updateProxyKeys)(keys);
});
// --- IPC Handlers for Agent Tools ---
electron_1.ipcMain.handle('agent:exec', async (_event, command, cwd) => {
    return new Promise((resolve) => {
        (0, child_process_1.exec)(command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({
                stdout,
                stderr,
                error: error ? error.message : undefined
            });
        });
    });
});
electron_1.ipcMain.handle('agent:readFile', async (_event, filePath) => {
    try {
        const content = await fs_1.promises.readFile(filePath, 'utf-8');
        return { content };
    }
    catch (err) {
        return { content: '', error: err.message };
    }
});
electron_1.ipcMain.handle('agent:listDir', async (_event, dirPath) => {
    try {
        const files = await fs_1.promises.readdir(dirPath);
        return { files };
    }
    catch (err) {
        return { files: [], error: err.message };
    }
});
