/**
 * Transactions route - GET /api/transactions (Phase 6)
 * List file uploads for "My transactions" (user) or "All transactions" (admin).
 */

import express from 'express';
import type { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { sendError } from '../lib/errorResponse';
import { requireAuth } from '../middleware/auth';
import { getTransactions } from '../services/database';
import type { TransactionsResponse } from '../types/api';
import { ExpiryType, FileStatus, UserRole } from '../types/database';

const router: express.Router = express.Router();

const queryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .toInt()
        .withMessage('page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .toInt()
        .withMessage('limit must be 1-100'),
    query('type')
        .optional()
        .isIn(['sent', 'received'])
        .withMessage('type must be sent or received'),
    query('scope').optional().isIn(['all']).withMessage('scope must be all'),
    query('fileName')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('fileName must be at most 255 characters'),
    query('email')
        .optional()
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('email must be a valid email'),
];

router.get(
    '/',
    requireAuth,
    queryValidation,
    async (
        req: Request,
        res: Response<TransactionsResponse | { error: string; message: string; details?: unknown }>,
    ) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            sendError(res, 400, 'Validation Error', 'Invalid query', errors.array());
            return;
        }

        if (!req.user) {
            sendError(res, 401, 'Unauthorized', 'Not authenticated');
            return;
        }

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const type = req.query.type as 'sent' | 'received' | undefined;
        const scope = req.query.scope === 'all' ? 'all' : undefined;
        const fileName = typeof req.query.fileName === 'string' ? req.query.fileName : undefined;
        const email = typeof req.query.email === 'string' ? req.query.email : undefined;
        const isAdmin = req.user.role === UserRole.Admin;

        if (scope === 'all' && !isAdmin) {
            sendError(res, 403, 'Forbidden', 'Only admins can request scope=all');
            return;
        }

        try {
            const opts: {
                page: number;
                limit: number;
                scope?: 'all';
                type?: 'sent' | 'received';
                fileName?: string;
                email?: string;
            } = { page, limit };
            if (scope) opts.scope = scope;
            if (type) opts.type = type;
            if (fileName?.trim()) opts.fileName = fileName.trim();
            if (email?.trim()) opts.email = email.trim();
            const { items, total } = await getTransactions(
                req.user.id,
                req.user.email,
                isAdmin,
                opts,
            );

            const response: TransactionsResponse = {
                items: items.map((row) => ({
                    fileId: row.file_id,
                    fileName: row.file_name,
                    uploadedAt: row.created_at,
                    expiryTime: row.expiry_time,
                    expiryType: row.expiry_type as ExpiryType,
                    status: row.status as FileStatus,
                    recipientCount: row.recipient_count,
                    recipientEmails: row.recipient_emails ?? [],
                    uploadedByEmail: row.uploaded_by_email ?? null,
                    role: row.role,
                })),
                total,
                page,
                limit,
            };

            res.status(200).json(response);
            return;
        } catch (err) {
            console.error('Transactions error:', err);
            sendError(res, 500, 'Transactions Error', 'Failed to load transactions');
            return;
        }
    },
);

export default router;
