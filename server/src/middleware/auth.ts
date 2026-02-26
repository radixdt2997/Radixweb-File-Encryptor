/**
 * Auth middleware: verify JWT and attach req.user
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth';
import { sendError } from '../lib/errorResponse';
import { UserRole } from '../types/database';

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

/**
 * Optional auth: if Authorization header present and valid, set req.user; otherwise continue without user.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        next();
        return;
    }
    const token = header.slice(7);
    const payload = verifyToken(token);
    if (payload) {
        req.user = {
            id: payload.userId,
            email: payload.email,
            role: payload.role as UserRole,
        };
    }
    next();
}

/**
 * Require auth: return 401 if no valid JWT.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        sendError(res, 401, 'Unauthorized', 'Missing or invalid authorization header');
        return;
    }
    const token = header.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
        sendError(res, 401, 'Unauthorized', 'Invalid or expired token');
        return;
    }
    req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role as UserRole,
    };
    next();
}

/**
 * Require admin role. Use after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
        sendError(res, 401, 'Unauthorized', 'Authentication required');
        return;
    }
    if (req.user.role !== UserRole.Admin) {
        sendError(res, 403, 'Forbidden', 'Admin access required');
        return;
    }
    next();
}
