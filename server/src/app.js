/**
 * Secure File Server - Phase B Implementation
 *
 * Zero-knowledge file delivery with OTP-based key wrapping.
 * Server never sees plaintext files or OTPs.
 */

import cors from "cors";
import { config } from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";

// Load environment variables
config();

// Routes
import downloadRoutes from "./routes/download.js";
import healthRoutes from "./routes/health.js";
import metadataRoutes from "./routes/metadata.js";
import testEmailRoutes from "./routes/test-email.js";
import uploadRoutes from "./routes/upload.js";
import verifyRoutes from "./routes/verify-otp.js";

// Services
import { initDatabase } from "./services/database.js";
import { initEmailService } from "./services/email.js";
import { ensureDirectories } from "./services/file-storage.js";

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";
const NODE_ENV = process.env.NODE_ENV || "development";

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

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Rate limiting - disable for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Stricter rate limiting for sensitive endpoints - relaxed for development
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: "Too many sensitive requests, please try again later.",
    retryAfter: 60,
  },
});

app.use("/api/verify-otp", strictLimiter);

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

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB default

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
  upload.fields([
    { name: "encryptedData", maxCount: 1 },
    { name: "wrappedKey", maxCount: 1 },
    { name: "wrappedKeySalt", maxCount: 1 },
  ]),
  uploadRoutes,
);

// OTP verification
app.use("/api/verify-otp", verifyRoutes);

// File download
app.use("/api/download", downloadRoutes);

// File metadata
app.use("/api/metadata", metadataRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `Route ${req.method} ${req.path} does not exist`,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Error:", error);

  // Mongoose validation error
  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      message: error.message,
    });
  }

  // Multer file size error
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "File too large",
      message: `Maximum file size is ${maxFileSize / (1024 * 1024)}MB`,
    });
  }

  // Default error response
  res.status(error.status || 500).json({
    error: "Internal Server Error",
    message:
      NODE_ENV === "development" ? error.message : "Something went wrong",
  });
});

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

async function startServer() {
  try {
    console.log("🚀 Starting Secure File Server (Phase B)...");

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
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start the server
startServer();

export default app;
