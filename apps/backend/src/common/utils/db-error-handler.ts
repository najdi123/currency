import { Logger } from "@nestjs/common";

/**
 * Database Error Handler Utility
 *
 * Provides type-safe error handling for MongoDB operations.
 * Prevents application crashes from database disconnections or failures.
 * Implements graceful degradation patterns for resilient operation.
 */

export interface DbOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Wrap a database operation with error handling
 * Returns a type-safe result object instead of throwing
 *
 * @param operation - The database operation to execute
 * @param operationName - Human-readable name for logging
 * @param logger - NestJS Logger instance
 * @param context - Additional context for error logging
 */
export async function wrapDbOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  logger: Logger,
  context?: Record<string, unknown>,
): Promise<DbOperationResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log structured error with context
    logger.error(`Database operation failed: ${operationName}`, {
      error: errorMessage,
      context,
      stack: errorStack,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute a database read operation with fallback
 * Returns null on failure instead of throwing
 *
 * @param operation - The database read operation
 * @param operationName - Human-readable name for logging
 * @param logger - NestJS Logger instance
 * @param context - Additional context for error logging
 */
export async function safeDbRead<T>(
  operation: () => Promise<T | null>,
  operationName: string,
  logger: Logger,
  context?: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log error but don't throw - return null for graceful degradation
    logger.error(
      `Database read failed: ${operationName} - continuing with fallback`,
      {
        error: errorMessage,
        context,
        stack: errorStack,
      },
    );

    return null;
  }
}

/**
 * Execute a database write operation with error suppression
 * Logs errors but doesn't throw - useful for non-critical writes like caching
 *
 * @param operation - The database write operation
 * @param operationName - Human-readable name for logging
 * @param logger - NestJS Logger instance
 * @param context - Additional context for error logging
 * @param isCritical - If true, logs as error; if false, logs as warning
 */
export async function safeDbWrite<T>(
  operation: () => Promise<T>,
  operationName: string,
  logger: Logger,
  context?: Record<string, unknown>,
  isCritical: boolean = false,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const logLevel = isCritical ? "error" : "warn";
    const logMessage = `Database write failed: ${operationName} - operation skipped`;

    logger[logLevel](logMessage, {
      error: errorMessage,
      context,
      stack: errorStack,
    });

    return null;
  }
}

/**
 * Check if an error is a MongoDB connection error
 *
 * @param error - The error to check
 */
export function isMongoConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const name = error.name?.toLowerCase() || "";

  return (
    message.includes("mongoerror") ||
    message.includes("connection") ||
    message.includes("econnrefused") ||
    message.includes("topology") ||
    name.includes("mongoerror") ||
    name.includes("mongotimeouterror")
  );
}

/**
 * Extract meaningful error message from MongoDB error
 *
 * @param error - The error to extract message from
 */
export function extractDbErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for specific MongoDB error patterns
    if (error.message.includes("E11000")) {
      return "Duplicate key error - record already exists";
    }
    if (error.message.includes("validation failed")) {
      return "Validation error - invalid data format";
    }
    if (isMongoConnectionError(error)) {
      return "Database connection error - check MongoDB status";
    }
    return error.message;
  }
  return String(error);
}
