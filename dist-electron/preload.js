import electronPkg from 'electron';
const { contextBridge, ipcRenderer } = electronPkg;
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Proxy management
    startProxy: (port) => ipcRenderer.invoke('proxy:start', port),
    stopProxy: () => ipcRenderer.invoke('proxy:stop'),
    updateProxyKeys: (keys) => ipcRenderer.send('proxy:updateKeys', keys),
    onProxyLog: (callback) => {
        ipcRenderer.on('proxy:log', (_event, message) => callback(message));
        return () => {
            ipcRenderer.removeAllListeners('proxy:log');
        };
    },
    // Agent tools
    execCommand: (command, cwd) => ipcRenderer.invoke('agent:exec', command, cwd),
    readFile: (filePath) => ipcRenderer.invoke('agent:readFile', filePath),
    listDir: (dirPath) => ipcRenderer.invoke('agent:listDir', dirPath)
});
