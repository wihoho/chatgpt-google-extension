import Browser from 'webextension-polyfill'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  component: string
  message: string
  data?: any
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private maxLogEntries = 1000
  private logStorageKey = 'extension_logs'

  async log(level: LogLevel, component: string, message: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }

    // Console logging for development
    const consoleMessage = `[${entry.timestamp}] [${level.toUpperCase()}] [${component}] ${message}`
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage, data, error)
        break
      case LogLevel.INFO:
        console.info(consoleMessage, data, error)
        break
      case LogLevel.WARN:
        console.warn(consoleMessage, data, error)
        break
      case LogLevel.ERROR:
        console.error(consoleMessage, data, error)
        break
    }

    // Store in extension storage for debugging
    try {
      const { [this.logStorageKey]: existingLogs = [] } = await Browser.storage.local.get(this.logStorageKey)
      const logs = Array.isArray(existingLogs) ? existingLogs : []
      
      logs.push(entry)
      
      // Keep only the most recent entries
      if (logs.length > this.maxLogEntries) {
        logs.splice(0, logs.length - this.maxLogEntries)
      }
      
      await Browser.storage.local.set({ [this.logStorageKey]: logs })
    } catch (storageError) {
      console.error('Failed to store log entry:', storageError)
    }
  }

  debug(component: string, message: string, data?: any) {
    return this.log(LogLevel.DEBUG, component, message, data)
  }

  info(component: string, message: string, data?: any) {
    return this.log(LogLevel.INFO, component, message, data)
  }

  warn(component: string, message: string, data?: any, error?: Error) {
    return this.log(LogLevel.WARN, component, message, data, error)
  }

  error(component: string, message: string, data?: any, error?: Error) {
    return this.log(LogLevel.ERROR, component, message, data, error)
  }

  async getLogs(limit?: number): Promise<LogEntry[]> {
    try {
      const { [this.logStorageKey]: logs = [] } = await Browser.storage.local.get(this.logStorageKey)
      const logArray = Array.isArray(logs) ? logs : []
      
      if (limit && limit > 0) {
        return logArray.slice(-limit)
      }
      
      return logArray
    } catch (error) {
      console.error('Failed to retrieve logs:', error)
      return []
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await Browser.storage.local.remove(this.logStorageKey)
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  async exportLogs(): Promise<string> {
    const logs = await this.getLogs()
    return JSON.stringify(logs, null, 2)
  }
}

// Create singleton instance
export const logger = new Logger()

// Error tracking utilities
export class ErrorTracker {
  static async trackError(component: string, error: Error, context?: any) {
    await logger.error(component, `Unhandled error: ${error.message}`, context, error)
    
    // Could integrate with external error tracking services here
    // e.g., Sentry, Rollbar, etc.
  }

  static async trackUserAction(component: string, action: string, data?: any) {
    await logger.info(component, `User action: ${action}`, data)
  }

  static async trackPerformance(component: string, operation: string, duration: number, data?: any) {
    await logger.info(component, `Performance: ${operation} took ${duration}ms`, data)
  }
}

// Global error handler setup
export function setupGlobalErrorHandling(component: string) {
  // Handle unhandled promise rejections
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      ErrorTracker.trackError(component, new Error(event.reason), {
        type: 'unhandledrejection',
        reason: event.reason
      })
    })

    // Handle general errors
    window.addEventListener('error', (event) => {
      ErrorTracker.trackError(component, event.error || new Error(event.message), {
        type: 'error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    })
  }
}
