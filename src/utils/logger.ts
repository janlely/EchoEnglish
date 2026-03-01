/**
 * Logger utility with level support
 * 
 * Usage:
 *   import logger from '../utils/logger';
 *   
 *   logger.debug('tag', 'Debug message');
 *   logger.info('tag', 'Info message');
 *   logger.warn('tag', 'Warning message');
 *   logger.error('tag', 'Error message');
 * 
 * Set log level (e.g., in app entry point):
 *   logger.setLevel('info'); // Only show info, warn, error
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = 'debug';

  /**
   * Set the minimum log level to display
   * @param level - The minimum log level ('debug' | 'info' | 'warn' | 'error')
   */
  setLevel(level: LogLevel): void {
    this.level = level;
    console.log(`[Logger] Log level set to: ${level}`);
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Check if a given level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  /**
   * Get timestamp for log messages
   */
  private getTimestamp(): string {
    return new Date().toISOString().slice(11, 23);
  }

  /**
   * Debug level log (lowest priority)
   */
  debug(tag: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[${this.getTimestamp()}] [DEBUG] [${tag}]`, ...args);
    }
  }

  /**
   * Info level log (normal operational messages)
   */
  info(tag: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[${this.getTimestamp()}] [INFO] [${tag}]`, ...args);
    }
  }

  /**
   * Warning level log (potential issues)
   */
  warn(tag: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[${this.getTimestamp()}] [WARN] [${tag}]`, ...args);
    }
  }

  /**
   * Error level log (errors and exceptions)
   */
  error(tag: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[${this.getTimestamp()}] [ERROR] [${tag}]`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;
