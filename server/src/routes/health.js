/**
 * Health Check Route - GET /api/health
 *
 * Provides server health status and basic statistics.
 * Used for monitoring and load balancer health checks.
 */

import express from "express";
import { server } from "../config.js";
import { sendError } from "../lib/errorResponse.js";
import {
  healthCheck as dbHealthCheck,
  getDatabaseStats,
} from "../services/database.js";
import {
  getStorageStats,
  healthCheck as storageHealthCheck,
} from "../services/file-storage.js";

const router = express.Router();

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

router.get("/", async (req, res) => {
  try {
    const startTime = Date.now();

    // Check database health
    const dbHealth = await dbHealthCheck();

    // Check storage health
    const storageHealth = await storageHealthCheck();

    // Get system stats
    const dbStats =
      dbHealth.status === "healthy" ? await getDatabaseStats() : null;
    const storageStats =
      storageHealth.status === "healthy" ? await getStorageStats() : null;

    // Determine overall health
    const overallHealth =
      dbHealth.status === "healthy" && storageHealth.status === "healthy"
        ? "healthy"
        : "unhealthy";

    // Response data
    const healthData = {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: server.nodeEnv,
      services: {
        database: dbHealth,
        storage: storageHealth,
      },
      stats: {
        database: dbStats,
        storage: storageStats,
      },
      responseTime: Date.now() - startTime,
    };

    // Return appropriate status code
    const statusCode = overallHealth === "healthy" ? 200 : 503;

    res.status(statusCode).json(healthData);
  } catch (error) {
    console.error("Health check error:", error);

    sendError(
      res,
      503,
      "Health check failed",
      "Health check failed",
      server.nodeEnv === "development" ? error.message : undefined,
    );
  }
});

export default router;
