/**
 * Sanitize sensitive data from URLs to prevent API key leakage in logs
 */

/**
 * Sanitize API keys and other sensitive query parameters from URLs
 * @param url - URL string that may contain sensitive data
 * @returns Sanitized URL with sensitive parameters masked
 */
export function sanitizeUrl(url: string): string {
  if (!url) return url;

  try {
    // Handle both full URLs and relative paths with query strings
    const urlObj = url.includes("://")
      ? new URL(url)
      : new URL(`http://dummy${url}`);

    // List of sensitive query parameter names to mask
    const sensitiveParams = [
      "api_key",
      "apiKey",
      "token",
      "secret",
      "password",
      "key",
    ];

    // Mask sensitive parameters
    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        const value = urlObj.searchParams.get(param);
        // Show first 4 characters and mask the rest
        const masked =
          value && value.length > 4
            ? `${value.substring(0, 4)}${"*".repeat(Math.min(value.length - 4, 20))}`
            : "***REDACTED***";
        urlObj.searchParams.set(param, masked);
      }
    });

    // Return sanitized URL (remove dummy host if it was added)
    const sanitized = urlObj.toString();
    return url.includes("://")
      ? sanitized
      : sanitized.replace("http://dummy", "");
  } catch (error) {
    // If URL parsing fails, do basic string replacement
    return url.replace(
      /([?&])(api_key|apiKey|token|secret|password|key)=([^&]+)/gi,
      "$1$2=***REDACTED***",
    );
  }
}

/**
 * Sanitize error messages that may contain URLs with API keys
 * @param error - Error object or message
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "";

  const message = error instanceof Error ? error.message : String(error);

  // Replace any URLs in the error message with sanitized versions
  return message.replace(/(https?:\/\/[^\s]+)/gi, (match) =>
    sanitizeUrl(match),
  );
}

/**
 * Create a sanitized error object for logging
 * @param error - Original error
 * @returns Sanitized error with masked sensitive data
 */
export function sanitizeError(error: Error): Error {
  const sanitized = new Error(sanitizeErrorMessage(error.message));
  sanitized.name = error.name;

  // Sanitize stack trace if present
  if (error.stack) {
    sanitized.stack = error.stack.replace(/(https?:\/\/[^\s]+)/gi, (match) =>
      sanitizeUrl(match),
    );
  }

  return sanitized;
}
