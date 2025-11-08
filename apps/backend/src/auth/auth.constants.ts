/**
 * Authentication constants for security features
 */
export const AUTH_CONSTANTS = {
  /**
   * Maximum number of failed login attempts before account lockout
   * After 5 failed attempts, the account will be temporarily locked
   */
  MAX_FAILED_ATTEMPTS: 5,

  /**
   * Duration of account lockout in minutes
   * Account will be locked for 15 minutes after exceeding max failed attempts
   */
  LOCKOUT_DURATION_MINUTES: 15,

  /**
   * Time window in minutes to reset the failed login attempt counter
   * If no login attempts occur within 60 minutes, the counter resets
   * Note: This is not currently implemented but reserved for future use
   */
  ATTEMPT_RESET_MINUTES: 60,
};
