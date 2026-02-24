/**
 * Secure File Server - Phase B Implementation
 *
 * Zero-knowledge file delivery with OTP-based key wrapping.
 * Server never sees plaintext files or OTPs.
 */

import cors from 'cors';
import express, {
    type Express,
    type Request,
    type Response,
    type ErrorRequestHandler,
} from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';

import { getConfigSummary, security, server, storage, validateConfiguration } from './config';
import { getOpenApiSpec } from './openapi';
import swaggerUi from 'swagger-ui-express';

// Routes
import authRoutes from './routes/auth';
import downloadRoutes from './routes/download';
import healthRoutes from './routes/health';
import metadataRoutes from './routes/metadata';
import testEmailRoutes from './routes/test-email';
import uploadRoutes from './routes/upload';
import verifyRoutes from './routes/verify-otp';
import recipientsRoutes from './routes/recipients';
import transactionsRoutes from './routes/transactions';

// Middleware
import { requireAuth } from './middleware/auth';

// Services
import { sendError } from './lib/errorResponse';
import { closeDatabase, initDatabase } from './services/database';
import { initEmailService } from './services/email';
import { ensureDirectories } from './services/file-storage';

// Configuration from config module
const PORT = server.port;
const HOST = server.host;
const NODE_ENV = server.nodeEnv;
const corsOrigins = security.corsOrigin.includes(',')
    ? security.corsOrigin.split(',').map((o) => o.trim())
    : [security.corsOrigin];

// Initialize Express app
const app: Express = express();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
    }),
);

// CORS configuration (from config)
app.use(
    cors({
        origin: corsOrigins,
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    }),
);

// Rate limiting (from config) — disabled in development
const noopRateLimit: express.RequestHandler = (_req, _res, next) => next();

const limiter =
    NODE_ENV === 'development'
        ? noopRateLimit
        : rateLimit({
              windowMs: security.rateLimitWindowMs,
              max: security.rateLimitMaxRequests,
              message: {
                  error: 'Too many requests from this IP, please try again later.',
                  retryAfter: Math.ceil(security.rateLimitWindowMs / 1000),
              },
              standardHeaders: true,
              legacyHeaders: false,
          });

app.use('/api/', limiter);

const strictLimiter =
    NODE_ENV === 'development'
        ? noopRateLimit
        : rateLimit({
              windowMs: security.otpCooldownMs,
              max: security.otpMaxAttempts,
              message: {
                  error: 'Too many OTP attempts, please try again later.',
                  retryAfter: Math.ceil(security.otpCooldownMs / 1000),
              },
          });

app.use('/api/verify-otp', strictLimiter);

const uploadLimiter =
    NODE_ENV === 'development'
        ? noopRateLimit
        : rateLimit({
              windowMs: security.uploadLimitWindowMs,
              max: security.uploadLimitMaxRequests,
              message: {
                  error: 'Too many uploads from this IP, please try again later.',
                  retryAfter: Math.ceil(security.uploadLimitWindowMs / 1000),
              },
              standardHeaders: true,
              legacyHeaders: false,
          });

const fileAccessLimiter =
    NODE_ENV === 'development'
        ? noopRateLimit
        : rateLimit({
              windowMs: security.fileAccessLimitWindowMs,
              max: security.fileAccessLimitMaxRequests,
              message: {
                  error: 'Too many file access requests from this IP, please try again later.',
                  retryAfter: Math.ceil(security.fileAccessLimitWindowMs / 1000),
              },
              standardHeaders: true,
              legacyHeaders: false,
          });

const recipientAccessLimiter =
    NODE_ENV === 'development'
        ? noopRateLimit
        : rateLimit({
              windowMs: security.recipientAccessLimitWindowMs,
              max: security.recipientAccessLimitMaxRequests,
              message: {
                  error: 'Too many recipient access attempts from this IP, please try again later.',
                  retryAfter: Math.ceil(security.recipientAccessLimitWindowMs / 1000),
              },
              standardHeaders: true,
              legacyHeaders: false,
          });

// ============================================================================
// GENERAL MIDDLEWARE
// ============================================================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, _res: Response, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

const maxFileSize = storage.maxFileSize;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
        // Allow encrypted files and key data (all sent as blobs from client)
        if (['encryptedData', 'wrappedKey', 'wrappedKeySalt'].includes(file.fieldname)) {
            cb(null, true);
        } else {
            cb(new Error(`Unexpected file field: ${file.fieldname}`));
        }
    },
});

// ============================================================================
// API DOCUMENTATION (Swagger UI)
// ============================================================================

if (server.docsEnabled) {
    const openApiSpec = getOpenApiSpec(server.baseUrl);
    app.use('/api-docs', swaggerUi.serve);
    app.get(
        '/api-docs',
        swaggerUi.setup(openApiSpec, {
            customSiteTitle: 'Secure File Server API',
            customCss: '.swagger-ui .topbar { display: none }',
        }),
    );
    app.get('/api-docs.json', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(openApiSpec);
    });
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check (no auth needed)
app.use('/api/health', healthRoutes);

// Auth (Phase 6)
app.use('/api/auth', authRoutes);

// Test email (development only)
app.use('/api/test-email', testEmailRoutes);

// File upload (Phase 6: auth required)
app.use(
    '/api/upload',
    uploadLimiter,
    requireAuth,
    upload.fields([
        { name: 'encryptedData', maxCount: 1 },
        { name: 'wrappedKey', maxCount: 1 },
        { name: 'wrappedKeySalt', maxCount: 1 },
    ]),
    uploadRoutes,
);

// OTP verification
app.use('/api/verify-otp', verifyRoutes);

// File download (with rate limiting)
app.use('/api/download', fileAccessLimiter, downloadRoutes);

// File metadata (with rate limiting)
app.use('/api/metadata', fileAccessLimiter, metadataRoutes);

// Recipient management (with stricter rate limiting on access)
app.use('/api/files', recipientAccessLimiter, requireAuth, recipientsRoutes);

// Transactions (Phase 6: auth required)
app.use('/api/transactions', recipientAccessLimiter, requireAuth, transactionsRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
    sendError(res, 404, 'Endpoint not found', `Route ${req.method} ${req.path} does not exist`);
});

// Global error handler
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error('Error:', error);

    // Mongoose validation error
    if (error.name === 'ValidationError') {
        return sendError(res, 400, 'Validation Error', error.message);
    }

    // Multer file size error
    if (error.code === 'LIMIT_FILE_SIZE') {
        return sendError(
            res,
            413,
            'File too large',
            `Maximum file size is ${maxFileSize / (1024 * 1024)}MB`,
        );
    }

    // Default error response
    return sendError(
        res,
        (error as { status?: number }).status || 500,
        'Internal Server Error',
        NODE_ENV === 'development' ? error.message : 'Something went wrong',
    );
};

app.use(errorHandler);

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

async function startServer(): Promise<void> {
    try {
        console.log('🚀 Starting Secure File Server...');

        validateConfiguration();
        console.log('✅ Configuration validated');
        console.log('📋 Config summary:', JSON.stringify(getConfigSummary(), null, 2));

        // Ensure required directories exist
        await ensureDirectories();
        console.log('✅ Directories initialized');

        // Initialize database
        await initDatabase();
        console.log('✅ Database initialized');

        // Initialize email service (optional - will log warning if not configured)
        try {
            await initEmailService();
            console.log('✅ Email service initialized');
        } catch (emailError) {
            console.warn('⚠️  Email service not configured:', (emailError as Error).message);
        }

        // Start server
        app.listen(PORT, HOST, () => {
            console.log(`🌐 Server running at http://${HOST}:${PORT}`);
            console.log(`📊 Environment: ${NODE_ENV}`);
            console.log(`🔒 Max file size: ${maxFileSize / (1024 * 1024)}MB`);
            console.log(`📧 Ready to receive file uploads and OTP verifications`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    closeDatabase();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    closeDatabase();
    process.exit(0);
});

// Start the server
startServer();

export default app;
