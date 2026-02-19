/**
 * Secure File Server - Phase B Implementation
 *
 * Zero-knowledge file delivery with OTP-based key wrapping.
 * Server never sees plaintext files or OTPs.
 */

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";

import {
  getConfigSummary,
  security,
  server,
  storage,
  validateConfiguration,
} from "./config.js";

// Routes
import downloadRoutes from "./routes/download.js";
import healthRoutes from "./routes/health.js";
import metadataRoutes from "./routes/metadata.js";
import testEmailRoutes from "./routes/test-email.js";
import uploadRoutes from "./routes/upload.js";
import verifyRoutes from "./routes/verify-otp.js";
import recipientsRoutes from "./routes/recipients.js";

// Services
import { sendError } from "./lib/errorResponse.js";
import { closeDatabase, initDatabase } from "./services/database.js";
import { initEmailService } from "./services/email.js";
import { ensureDirectories } from "./services/file-storage.js";

// Configuration from config module
const PORT = server.port;
const HOST = server.host;
const NODE_ENV = server.nodeEnv;
const corsOrigins = security.corsOrigin.includes(",")
  ? security.corsOrigin.split(",").map((o) => o.trim())
  : [security.corsOrigin];

// Initialize Express app
const app = express();

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
        imgSrc: ["'self'", "data:", "https:"],
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
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Rate limiting (from config)
const limiter = rateLimit({
  windowMs: security.rateLimitWindowMs,
  max: security.rateLimitMaxRequests,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: Math.ceil(security.rateLimitWindowMs / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Stricter rate limiting for OTP verification (from config)
const strictLimiter = rateLimit({
  windowMs: security.otpCooldownMs,
  max: security.otpMaxAttempts,
  message: {
    error: "Too many OTP attempts, please try again later.",
    retryAfter: Math.ceil(security.otpCooldownMs / 1000),
  },
});

app.use("/api/verify-otp", strictLimiter);

// Upload-specific limiter to protect file upload endpoint from abuse
const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS) || 20, // 20 uploads per window
  message: {
    error: "Too many uploads from this IP, please try again later.",
    retryAfter: Math.ceil(
      (parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) /
        1000,
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// File access limiter (metadata, download) to prevent enumeration and brute-force
const fileAccessLimiter = rateLimit({
  windowMs:
    parseInt(process.env.FILE_ACCESS_RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute
  max: parseInt(process.env.FILE_ACCESS_RATE_LIMIT_MAX_REQUESTS) || 30, // 30 file accesses per minute
  message: {
    error:
      "Too many file access requests from this IP, please try again later.",
    retryAfter: Math.ceil(
      (parseInt(process.env.FILE_ACCESS_RATE_LIMIT_WINDOW_MS) ||
        1 * 60 * 1000) / 1000,
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Recipient list access limiter
const recipientAccessLimiter = rateLimit({
  windowMs:
    parseInt(process.env.RECIPIENT_ACCESS_RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RECIPIENT_ACCESS_RATE_LIMIT_MAX_REQUESTS) || 5, // 5 requests per window
  message: {
    error:
      "Too many recipient access attempts from this IP, please try again later.",
    retryAfter: Math.ceil(
      (parseInt(process.env.RECIPIENT_ACCESS_RATE_LIMIT_WINDOW_MS) ||
        15 * 60 * 1000) / 1000,
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// GENERAL MIDDLEWARE
// ============================================================================

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
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
  fileFilter: (req, file, cb) => {
    // Allow encrypted files and key data (all sent as blobs from client)
    if (
      ["encryptedData", "wrappedKey", "wrappedKeySalt"].includes(file.fieldname)
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Unexpected file field: ${file.fieldname}`), false);
    }
  },
});

// ============================================================================
// ROUTES
// ============================================================================

// Health check (no auth needed)
app.use("/api/health", healthRoutes);

// Test email (development only)
app.use("/api/test-email", testEmailRoutes);

// File upload (with multiple file handling)
app.use(
  "/api/upload",
  uploadLimiter,
  upload.fields([
    { name: "encryptedData", maxCount: 1 },
    { name: "wrappedKey", maxCount: 1 },
    { name: "wrappedKeySalt", maxCount: 1 },
  ]),
  uploadRoutes,
);

// OTP verification
app.use("/api/verify-otp", verifyRoutes);

// File download (with rate limiting)
app.use("/api/download", fileAccessLimiter, downloadRoutes);

// File metadata (with rate limiting)
app.use("/api/metadata", fileAccessLimiter, metadataRoutes);

// Recipient management (with stricter rate limiting on access)
app.use("/api/files", recipientAccessLimiter, recipientsRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  sendError(
    res,
    404,
    "Endpoint not found",
    `Route ${req.method} ${req.path} does not exist`,
  );
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Error:", error);

  // Mongoose validation error
  if (error.name === "ValidationError") {
    return sendError(res, 400, "Validation Error", error.message);
  }

  // Multer file size error
  if (error.code === "LIMIT_FILE_SIZE") {
    return sendError(
      res,
      413,
      "File too large",
      `Maximum file size is ${maxFileSize / (1024 * 1024)}MB`,
    );
  }

  // Default error response
  sendError(
    res,
    error.status || 500,
    "Internal Server Error",
    NODE_ENV === "development" ? error.message : "Something went wrong",
  );
});

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

async function startServer() {
  try {
    console.log("🚀 Starting Secure File Server...");

    validateConfiguration();
    console.log("✅ Configuration validated");
    console.log("📋 Config summary:", JSON.stringify(getConfigSummary(), null, 2));

    // Ensure required directories exist
    await ensureDirectories();
    console.log("✅ Directories initialized");

    // Initialize database
    await initDatabase();
    console.log("✅ Database initialized");

    // Initialize email service (optional - will log warning if not configured)
    try {
      await initEmailService();
      console.log("✅ Email service initialized");
    } catch (emailError) {
      console.warn("⚠️  Email service not configured:", emailError.message);
    }

    // Start server
    app.listen(PORT, HOST, () => {
      console.log(`🌐 Server running at http://${HOST}:${PORT}`);
      console.log(`📊 Environment: ${NODE_ENV}`);
      console.log(`🔒 Max file size: ${maxFileSize / (1024 * 1024)}MB`);
      console.log(`📧 Ready to receive file uploads and OTP verifications`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  closeDatabase();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  closeDatabase();
  process.exit(0);
});

// Start the server
startServer();

export default app;
