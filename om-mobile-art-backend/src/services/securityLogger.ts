import { logger } from './logger.js';

export type SecuritySeverity = 'INFO' | 'WARN' | 'SECURITY_ALERT';

export interface SecurityEvent {
  action: string;
  severity: SecuritySeverity;
  ipAddress?: string;
  userId?: string;
  route?: string;
  details?: string | Record<string, any>;
  statusCode?: number;
}

export class SecurityLogger {
  public static log(event: SecurityEvent) {
    const logData = {
      timestamp: new Date().toISOString(),
      action: event.action,
      severity: event.severity,
      ip: event.ipAddress || 'UNKNOWN',
      userId: event.userId || null,
      route: event.route || null,
      statusCode: event.statusCode || null,
      details: event.details || null,
    };

    switch (event.severity) {
      case 'SECURITY_ALERT':
        logger.error({ msg: `🚨 SECURITY ALERT: ${event.action}`, ...logData });
        break;
      case 'WARN':
        logger.warn({ msg: `⚠️ SECURITY WARN: ${event.action}`, ...logData });
        break;
      case 'INFO':
      default:
        logger.info({ msg: `ℹ️ SECURITY INFO: ${event.action}`, ...logData });
        break;
    }
  }
}
