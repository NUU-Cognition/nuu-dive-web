/**
 * Simple logger abstraction to centralize logging and make it easy to
 * integrate with external services (Sentry, Datadog, etc.) later.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env["NODE_ENV"] === "development";
  private isTest = process.env["NODE_ENV"] === "test";
  private isProduction = process.env["NODE_ENV"] === "production";

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isProduction && !this.isTest) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (!this.isTest) {
      console.info(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
    
    // In production, you might want to send this to a monitoring service
    if (this.isProduction) {
      // Example: Sentry.captureMessage(message, "warning");
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullContext = {
      ...context,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    };
    
    console.error(this.formatMessage("error", message, fullContext));
    
    // In production, send to error tracking service
    if (this.isProduction) {
      // Example: Sentry.captureException(error);
    }
  }

  /**
   * Log performance metrics
   */
  metric(name: string, value: number, unit: string = "ms", tags?: Record<string, string>): void {
    if (!this.isTest) {
      const message = `Metric: ${name}=${value}${unit}`;
      const context = tags ? { tags } : undefined;
      this.info(message, context);
      
      // In production, send to metrics service
      if (this.isProduction) {
        // Example: statsd.gauge(name, value, tags);
      }
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return {
      debug: (msg: string, ctx?: LogContext) => this.debug(msg, { ...context, ...ctx }),
      info: (msg: string, ctx?: LogContext) => this.info(msg, { ...context, ...ctx }),
      warn: (msg: string, ctx?: LogContext) => this.warn(msg, { ...context, ...ctx }),
      error: (msg: string, err?: Error | unknown, ctx?: LogContext) => 
        this.error(msg, err, { ...context, ...ctx }),
      metric: this.metric.bind(this),
      child: (ctx: LogContext) => this.child({ ...context, ...ctx }),
    } as Logger;
  }
}

// Export singleton instance
export const log = new Logger();

// Export for testing or custom instances
export { Logger };

// Convenience exports for common use cases
export const logApi = log.child({ component: "api" });
export const logAuth = log.child({ component: "auth" });
export const logDb = log.child({ component: "database" });
export const logLLM = log.child({ component: "llm" });