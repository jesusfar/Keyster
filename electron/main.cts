import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { exec } from 'child_process'
import { promises as fs } from 'fs'
import { startLocalProxy, stopLocalProxy, updateProxyKeys } from './proxyServer.cjs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  // Determine if we're in dev mode looking at Vite env, or production
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    // Vite dev server URL
    mainWindow?.loadURL('http://localhost:5173')
    mainWindow?.webContents.openDevTools()
  } else {
    // Production build
    mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// --- IPC Handlers for Proxy ---
ipcMain.handle('proxy:start', async (_event: any, port: number) => {
  try {
    const success = await startLocalProxy(port, (msg: string) => {
      // Send logs back to renderer via the main window
      mainWindow?.webContents.send('proxy:log', msg)
    })
    return { success }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('proxy:stop', async () => {
  try {
    const success = await stopLocalProxy()
    return { success }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Listen to key updates
ipcMain.on('proxy:updateKeys', (_event: any, keys: Record<string, string[]>) => {
  updateProxyKeys(keys)
})

// --- IPC Handlers for Agent Tools ---
ipcMain.handle('agent:exec', async (_event: any, command: string, cwd?: string) => {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (error: any, stdout: string, stderr: string) => {
      resolve({
        stdout,
        stderr,
        error: error ? error.message : undefined
      })
    })
  })
})

ipcMain.handle('agent:readFile', async (_event: any, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { content }
  } catch (err: any) {
    return { content: '', error: err.message }
  }
})

ipcMain.handle('agent:listDir', async (_event: any, dirPath: string) => {
  try {
    const files = await fs.readdir(dirPath)
    return { files }
  } catch (err: any) {
    return { files: [], error: err.message }
  }
})
