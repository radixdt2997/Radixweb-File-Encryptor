/**
 * Auth routes: login, register, me
 */

import express from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { auth as authConfig } from '../config';
import { sendError } from '../lib/errorResponse';
import { hashPassword, signToken, verifyPassword, validateEmailDomain } from '../lib/auth';
import { createUser, getUserByEmail } from '../services/database';
import { requireAuth } from '../middleware/auth';
import { UserRole } from '../types/database';

const router: express.Router = express.Router();

const loginValidation = [
    body('email').isEmail().normalizeEmail().trim(),
    body('password').notEmpty().withMessage('Password is required'),
];

const registerValidation = [
    body('email').isEmail().normalizeEmail().trim(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// POST /api/auth/login
router.post('/login', loginValidation, async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        sendError(res, 400, 'Validation Error', 'Invalid request', errors.array());
        return;
    }

    const { email, password } = req.body as { email: string; password: string };
    const normalizedEmail = email.trim().toLowerCase();

    if (!validateEmailDomain(normalizedEmail)) {
        sendError(
            res,
            400,
            'Invalid email',
            `Only ${authConfig.allowedEmailDomain} email addresses are allowed`,
        );
        return;
    }

    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
        sendError(res, 401, 'Invalid credentials', 'Invalid email or password');
        return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        sendError(res, 401, 'Invalid credentials', 'Invalid email or password');
        return;
    }

    const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
    });

    res.status(200).json({
        token,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
        },
    });
    return;
});

// POST /api/auth/register
router.post('/register', registerValidation, async (req: Request, res: Response) => {
    if (!authConfig.allowSelfRegistration) {
        sendError(
            res,
            403,
            'Registration disabled',
            'Self-registration is disabled. Contact an administrator.',
        );
        return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        sendError(res, 400, 'Validation Error', 'Invalid request', errors.array());
        return;
    }

    const { email, password } = req.body as { email: string; password: string };
    const normalizedEmail = email.trim().toLowerCase();

    if (!validateEmailDomain(normalizedEmail)) {
        sendError(
            res,
            400,
            'Invalid email',
            `Only ${authConfig.allowedEmailDomain} email addresses are allowed`,
        );
        return;
    }

    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
        sendError(res, 400, 'Email in use', 'An account with this email already exists');
        return;
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
        email: normalizedEmail,
        passwordHash,
        role: UserRole.User,
    });

    const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
    });

    res.status(201).json({
        token,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
        },
    });
    return;
});

// GET /api/auth/me (requires valid JWT)
router.get('/me', requireAuth, (req: Request, res: Response) => {
    if (!req.user) {
        sendError(res, 401, 'Unauthorized', 'Not authenticated');
        return;
    }
    res.status(200).json({
        user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
        },
    });
    return;
});

export default router;
