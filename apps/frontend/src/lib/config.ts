/**
 * Environment Configuration & Validation
 *
 * This module validates all required environment variables at startup
 * and provides a type-safe config object for use throughout the app.
 *
 * IMPORTANT: All variables that need to be available to the browser
 * must be prefixed with NEXT_PUBLIC_
 */

/**
 * Environment variable configuration
 */
interface EnvConfig {
  /** Backend API URL (required) */
  apiUrl: string
  /** Current environment */
  nodeEnv: 'development' | 'production' | 'test'
  /** Is development mode */
  isDevelopment: boolean
  /** Is production mode */
  isProduction: boolean
  /** Is test mode */
  isTest: boolean
}

/**
 * Validate a required environment variable
 * @throws Error if variable is missing or empty
 */
function validateRequired(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ Missing required environment variable: ${name}\n\n` +
      `Please ensure you have created a .env.local file in apps/frontend/\n` +
      `with the following variable:\n\n` +
      `${name}=<value>\n\n` +
      `Example:\n` +
      `${name}=${getExampleValue(name)}\n\n` +
      `See .env.example for more details.`
    )
  }
  return value.trim()
}

/**
 * Get example value for environment variable
 */
function getExampleValue(name: string): string {
  switch (name) {
    case 'NEXT_PUBLIC_API_URL':
      return 'http://localhost:4000/api'
    default:
      return '<value>'
  }
}

/**
 * Validate a URL environment variable
 * @throws Error if URL is invalid
 */
function validateUrl(name: string, value: string): string {
  try {
    const url = new URL(value)

    // Validate protocol
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`URL must use http:// or https:// protocol`)
    }

    // Validate hostname
    if (!url.hostname) {
      throw new Error(`URL must have a valid hostname`)
    }

    return value
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `❌ Invalid URL for environment variable: ${name}\n\n` +
        `Current value: "${value}"\n\n` +
        `URLs must be in the format: http://hostname:port/path\n` +
        `Example: ${getExampleValue(name)}`
      )
    }
    throw error
  }
}

/**
 * Get and validate NODE_ENV
 */
function getNodeEnv(): EnvConfig['nodeEnv'] {
  const env = process.env.NODE_ENV || 'development'

  if (!['development', 'production', 'test'].includes(env)) {
    console.warn(`⚠️  Unknown NODE_ENV: "${env}", defaulting to "development"`)
    return 'development'
  }

  return env as EnvConfig['nodeEnv']
}

/**
 * Load and validate environment configuration
 * @throws Error if required variables are missing or invalid
 */
function loadConfig(): EnvConfig {
  // Validate NODE_ENV
  const nodeEnv = getNodeEnv()

  // Validate required variables
  const apiUrl = validateRequired('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL)

  // Validate URL format
  validateUrl('NEXT_PUBLIC_API_URL', apiUrl)

  // Ensure API URL doesn't end with slash (for consistency)
  const normalizedApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

  return {
    apiUrl: normalizedApiUrl,
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  }
}

/**
 * Validated and type-safe configuration object
 *
 * Usage:
 * ```typescript
 * import { config } from '@/lib/config'
 *
 * fetch(`${config.apiUrl}/currencies`)
 *
 * if (config.isDevelopment) {
 *   console.log('Debug info...')
 * }
 * ```
 */
export const config: EnvConfig = (() => {
  try {
    const cfg = loadConfig()

    // Log successful validation in development
    if (cfg.isDevelopment) {
      console.log('✅ Environment configuration loaded successfully:', {
        nodeEnv: cfg.nodeEnv,
        apiUrl: cfg.apiUrl,
      })
    }

    return cfg
  } catch (error) {
    // Log error to console
    console.error(error instanceof Error ? error.message : String(error))

    // In development, show helpful error
    if (process.env.NODE_ENV === 'development') {
      throw error
    }

    // In production, throw generic error (don't expose internals)
    throw new Error(
      'Application configuration error. Please contact support.'
    )
  }
})()

/**
 * Validate configuration at runtime
 * Call this at app startup to ensure all env vars are valid
 *
 * Usage in app/layout.tsx or similar:
 * ```typescript
 * import { validateConfig } from '@/lib/config'
 * validateConfig()
 * ```
 */
export function validateConfig(): void {
  // Config is already validated on import
  // This function exists for explicit validation calls
  if (config.isDevelopment) {
    console.log('🔍 Configuration validation passed')
  }
}

// Export individual config values for convenience
export const { apiUrl, nodeEnv, isDevelopment, isProduction, isTest } = config
