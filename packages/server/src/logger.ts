import supportsColor from 'supports-color';

class Logger {
  private readonly appPrefix: string;
  private readonly errorPrefix: string;
  private readonly reqPrefix: string;
  private readonly getTimestamp: () => string;
  private logBuffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(isDev: boolean) {
    const hasColor = supportsColor.stdout;
    this.appPrefix = hasColor ? '\x1b[32m[APP]\x1b[0m' : '[APP]';
    this.errorPrefix = hasColor ? '\x1b[31m[ERR]\x1b[0m' : '[ERR]';
    this.reqPrefix = hasColor ? '\x1b[36m[REQ]\x1b[0m' : '[REQ]';
    this.getTimestamp = isDev ? () => `[${new Date().toISOString()}] ` : () => '';

    // Override console methods to capture all logging
    this.overrideConsole();
  }

  private overrideConsole() {
    console.log = (...args: unknown[]) => {
      const message = `${this.getTimestamp()}${this.appPrefix} ${args.join(' ')}\n`;
      this.writeToBuffer(message);
    };

    console.error = (...args: unknown[]) => {
      const message = `${this.getTimestamp()}${this.errorPrefix} ${args.join(' ')}\n`;
      this.writeToBuffer(message);
    };

    console.warn = (...args: unknown[]) => {
      const message = `${this.getTimestamp()}${this.appPrefix} [WARN] ${args.join(' ')}\n`;
      this.writeToBuffer(message);
    };
  }

  private writeToBuffer(message: string) {
    this.logBuffer.push(message);
    this.scheduleFlush();
  }

  private flush() {
    if (this.logBuffer.length === 0) return;

    const messages = this.logBuffer.splice(0);
    setImmediate(() => {
      messages.forEach(msg => process.stdout.write(msg));
    });
  }

  private scheduleFlush() {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, 0); // Flush on next tick
  }

  app(...args: unknown[]) {
    const message = `${this.getTimestamp()}${this.appPrefix} ${args.join(' ')}\n`;
    this.writeToBuffer(message);
  }

  error(...args: unknown[]) {
    const message = `${this.getTimestamp()}${this.errorPrefix} ${args.join(' ')}\n`;
    this.writeToBuffer(message);
  }

  request(message: string, requestId?: string) {
    const idSuffix = requestId ? ` [${requestId}]` : '';
    const fullMessage = `${this.getTimestamp()}${this.reqPrefix} ${message}${idSuffix}\n`;
    this.writeToBuffer(fullMessage);
  }

  timing(operation: string, duration: number, requestId?: string, isError = false) {
    const errorSuffix = isError ? ' (ERROR)' : '';
    const idSuffix = requestId ? ` [${requestId}]` : '';
    const message = `    ↳ ${operation}: ${duration.toFixed(2)}ms${errorSuffix}${idSuffix}`;
    this.app(message);
  }
}

let globalLogger: Logger;

export function initializeLogger(isDev: boolean): void {
  globalLogger = new Logger(isDev);
}

export function getLogger(): Logger {
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call initializeLogger() first.');
  }
  return globalLogger;
}
