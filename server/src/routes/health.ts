/**
 * Health Check Route - GET /api/health
 *
 * Provides server health status and basic statistics.
 * Used for monitoring and load balancer health checks.
 */

import express from "express";
import type { Request, Response } from "express";
import { server } from "../config";
import { sendError } from "../lib/errorResponse";
import {
  healthCheck as dbHealthCheck,
  getDatabaseStats,
} from "../services/database";
import {
  getStorageStats,
  healthCheck as storageHealthCheck,
} from "../services/file-storage";
import { HealthStatus, type HealthResponse } from "../types/api";

const router: express.Router = express.Router();

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

router.get("/", async (_req: Request, res: Response<HealthResponse>) => {
  try {
    const startTime = Date.now();

    // Check database health
    const dbHealth = await dbHealthCheck();

    // Check storage health
    const storageHealth = await storageHealthCheck();

    // Get system stats
    const dbStats =
      dbHealth.status === HealthStatus.Healthy ? await getDatabaseStats() : null;
    const storageStats =
      storageHealth.status === HealthStatus.Healthy ? await getStorageStats() : null;

    // Determine overall health
    const overallHealth =
      dbHealth.status === HealthStatus.Healthy &&
      storageHealth.status === HealthStatus.Healthy
        ? HealthStatus.Healthy
        : HealthStatus.Unhealthy;

    // Response data
    const healthData: HealthResponse = {
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
    const statusCode = overallHealth === HealthStatus.Healthy ? 200 : 503;

    res.status(statusCode).json(healthData);
  } catch (error) {
    console.error("Health check error:", error);

    sendError(
      res,
      503,
      "Health check failed",
      "Health check failed",
      server.nodeEnv === "development" ? (error as Error).message : undefined,
    );
  }
});

export default router;
