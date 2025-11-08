import { Injectable, Logger } from '@nestjs/common';

export interface AuditEventData {
  action: string;
  userId?: string;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  success?: boolean;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Log an audit event with structured data
   *
   * This service logs security-sensitive events to help with:
   * - Security monitoring and threat detection
   * - Compliance requirements (audit trail)
   * - Debugging and troubleshooting
   * - User behavior analytics
   *
   * In production, this could be extended to:
   * - Store events in a dedicated audit database/collection
   * - Send events to external logging services (e.g., Elasticsearch, Splunk)
   * - Trigger alerts for suspicious activities
   * - Generate compliance reports
   */
  async logEvent(event: AuditEventData): Promise<void> {
    const auditEntry = {
      timestamp: event.timestamp || new Date(),
      action: event.action,
      userId: event.userId,
      performedBy: event.performedBy,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata,
      success: event.success ?? true,
      errorMessage: event.errorMessage,
    };

    // Log to console/file with structured format
    // In production, consider using a JSON formatter for log aggregation
    const logMessage = this.formatLogMessage(auditEntry);

    if (auditEntry.success) {
      this.logger.log(logMessage);
    } else {
      this.logger.warn(logMessage);
    }

    // Future enhancement: Store in database for compliance
    // await this.auditLogRepository.create(auditEntry);

    // Future enhancement: Send to external monitoring service
    // await this.sendToMonitoringService(auditEntry);
  }

  /**
   * Log a successful authentication event
   */
  async logSuccessfulLogin(userId: string, email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logEvent({
      action: 'USER_LOGIN_SUCCESS',
      userId,
      performedBy: email,
      ipAddress,
      userAgent,
      metadata: { email },
      success: true,
    });
  }

  /**
   * Log a failed authentication attempt
   */
  async logFailedLogin(email: string, reason: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logEvent({
      action: 'USER_LOGIN_FAILED',
      performedBy: email,
      ipAddress,
      userAgent,
      metadata: { email, reason },
      success: false,
      errorMessage: reason,
    });
  }

  /**
   * Log user registration
   */
  async logUserRegistration(userId: string, email: string, role: string, performedBy?: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      action: 'USER_REGISTRATION',
      userId,
      performedBy: performedBy || email,
      ipAddress,
      metadata: { email, role, registeredBy: performedBy },
      success: true,
    });
  }

  /**
   * Log password change
   */
  async logPasswordChange(userId: string, email: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      action: 'PASSWORD_CHANGE',
      userId,
      performedBy: email,
      ipAddress,
      metadata: { email },
      success: true,
    });
  }

  /**
   * Log user profile update
   */
  async logUserUpdate(userId: string, email: string, changedFields: string[], performedBy: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      action: 'USER_UPDATE',
      userId,
      performedBy,
      ipAddress,
      metadata: {
        email,
        changedFields,
        isSelfUpdate: userId === performedBy,
      },
      success: true,
    });
  }

  /**
   * Log sensitive data access (e.g., admin viewing user details)
   */
  async logUserAccess(userId: string, email: string, accessedBy: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      action: 'USER_DATA_ACCESS',
      userId,
      performedBy: accessedBy,
      ipAddress,
      metadata: { email, accessedBy },
      success: true,
    });
  }

  /**
   * Format audit entry as a readable log message
   */
  private formatLogMessage(entry: AuditEventData & { timestamp: Date; success: boolean }): string {
    const parts: string[] = [
      `[AUDIT]`,
      `Action: ${entry.action}`,
    ];

    if (entry.userId) {
      parts.push(`UserId: ${entry.userId}`);
    }

    if (entry.performedBy) {
      parts.push(`PerformedBy: ${entry.performedBy}`);
    }

    if (entry.ipAddress) {
      parts.push(`IP: ${entry.ipAddress}`);
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push(`Metadata: ${JSON.stringify(entry.metadata)}`);
    }

    if (entry.errorMessage) {
      parts.push(`Error: ${entry.errorMessage}`);
    }

    parts.push(`Timestamp: ${entry.timestamp.toISOString()}`);

    return parts.join(' | ');
  }
}
