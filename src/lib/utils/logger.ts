/**
 * Conditional logger that only logs in development
 */

import { CONFIG } from '../config'

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private enabled: boolean

  constructor() {
    this.enabled = CONFIG.DEV.ENABLE_LOGGING
  }

  private log(level: LogLevel, ...args: unknown[]) {
    if (!this.enabled) return
    console[level](...args)
  }

  info(...args: unknown[]) {
    this.log('info', '[Keyster]', ...args)
  }

  warn(...args: unknown[]) {
    this.log('warn', '[Keyster]', ...args)
  }

  error(...args: unknown[]) {
    this.log('error', '[Keyster]', ...args)
  }

  debug(...args: unknown[]) {
    this.log('debug', '[Keyster]', ...args)
  }
}

export const logger = new Logger()
