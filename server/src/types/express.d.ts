/**
 * Express Type Extensions
 *
 * Extend Express Request/Response types with custom properties if needed.
 */

import { Request } from 'express';

/**
 * Extend Express Request type if custom properties are needed
 * Currently no custom properties, but this file is here for future extensions
 */
declare global {
    namespace Express {
        interface Request {
            // Add custom properties here if needed in the future
            // Example: user?: User;
        }
    }
}

export {};
