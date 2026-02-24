"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Proxy management
    startProxy: (port) => electron_1.ipcRenderer.invoke('proxy:start', port),
    stopProxy: () => electron_1.ipcRenderer.invoke('proxy:stop'),
    updateProxyKeys: (keys) => electron_1.ipcRenderer.send('proxy:updateKeys', keys),
    onProxyLog: (callback) => {
        electron_1.ipcRenderer.on('proxy:log', (_event, message) => callback(message));
        return () => {
            electron_1.ipcRenderer.removeAllListeners('proxy:log');
        };
    },
    // Agent tools
    execCommand: (command, cwd) => electron_1.ipcRenderer.invoke('agent:exec', command, cwd),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('agent:readFile', filePath),
    listDir: (dirPath) => electron_1.ipcRenderer.invoke('agent:listDir', dirPath)
});
