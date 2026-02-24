import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Proxy management
  startProxy: (port: number) => ipcRenderer.invoke('proxy:start', port),
  stopProxy: () => ipcRenderer.invoke('proxy:stop'),
  updateProxyKeys: (keys: Record<string, string[]>) => ipcRenderer.send('proxy:updateKeys', keys),
  onProxyLog: (callback: (message: string) => void) => {
    ipcRenderer.on('proxy:log', (_event: any, message: any) => callback(message))
    return () => {
      ipcRenderer.removeAllListeners('proxy:log')
    }
  },

  // Agent tools
  execCommand: (command: string, cwd?: string) => ipcRenderer.invoke('agent:exec', command, cwd),
  readFile: (filePath: string) => ipcRenderer.invoke('agent:readFile', filePath),
  listDir: (dirPath: string) => ipcRenderer.invoke('agent:listDir', dirPath)
})

declare global {
  interface Window {
    electronAPI: {
      startProxy: (port: number) => Promise<{ success: boolean; error?: string }>
      stopProxy: () => Promise<{ success: boolean; error?: string }>
      updateProxyKeys: (keys: Record<string, string[]>) => void
      onProxyLog: (callback: (message: string) => void) => () => void

      execCommand: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; error?: string }>
      readFile: (filePath: string) => Promise<{ content: string; error?: string }>
      listDir: (dirPath: string) => Promise<{ files: string[]; error?: string }>
    }
  }
}
