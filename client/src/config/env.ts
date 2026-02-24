/**
 * Environment configuration – single source of truth for client env.
 *
 * - Vite loads `.env` from the client folder automatically. Create a `.env` file
 *   (e.g. by copying `.env.example`) to override defaults.
 * - Only variables prefixed with `VITE_` are exposed to the client.
 * - All client code must read env through this module (e.g. `import { env } from "../config/env"`).
 *   Do not use `import.meta.env` elsewhere.
 * - If `.env` is missing, defaults below are used so the app still runs (e.g. in dev).
 */

/**
 * Get environment variable with type safety and default value
 */
const getEnvString = (key: string, defaultValue: string): string => {
    const value = import.meta.env[key];
    return value !== undefined && value !== '' ? String(value) : defaultValue;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
    const value = import.meta.env[key];
    if (value === undefined || value === '') return defaultValue;
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
};

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
    const value = import.meta.env[key];
    if (value === undefined || value === '') return defaultValue;
    return value === 'true' || value === '1' || value === 'yes';
};

/**
 * Application environment configuration
 */
export const env = {
    // API Configuration
    api: {
        baseUrl: getEnvString('VITE_API_BASE_URL', 'http://localhost:3000/api'),
    },

    // App Configuration
    app: {
        name: getEnvString('VITE_APP_NAME', 'Secure File App'),
        version: getEnvString('VITE_APP_VERSION', '1.0.0'),
    },

    // Feature Flags
    features: {
        legacyMode: getEnvBoolean('VITE_FEATURE_LEGACY_MODE', true),
        recipientMode: getEnvBoolean('VITE_FEATURE_RECIPIENT_MODE', true),
        senderMode: getEnvBoolean('VITE_FEATURE_SENDER_MODE', true),
    },

    // Encryption Settings
    encryption: {
        pbkdf2Iterations: getEnvNumber('VITE_PBKDF2_ITERATIONS', 250000),
    },

    // OTP Settings
    otp: {
        length: getEnvNumber('VITE_OTP_LENGTH', 6),
    },

    // UI Settings
    ui: {
        defaultExpiryMinutes: getEnvNumber('VITE_DEFAULT_EXPIRY_MINUTES', 60),
        minExpiryMinutes: getEnvNumber('VITE_MIN_EXPIRY_MINUTES', 5),
        maxExpiryMinutes: getEnvNumber('VITE_MAX_EXPIRY_MINUTES', 1440),
    },

    // Toast/Alert Settings
    toast: {
        durationDefault: getEnvNumber('VITE_TOAST_DURATION_DEFAULT', 5000),
        durationError: getEnvNumber('VITE_TOAST_DURATION_ERROR', 7000),
    },

    // Email Validation
    email: {
        allowedDomain: getEnvString('VITE_ALLOWED_EMAIL_DOMAIN', 'radixweb.com'),
    },

    // Debug Mode
    debug: getEnvBoolean('VITE_DEBUG_MODE', false),
} as const;

/**
 * Log configuration in debug mode
 */
if (env.debug) {
    console.log('[ENV] Configuration loaded:', env);
}

export default env;
