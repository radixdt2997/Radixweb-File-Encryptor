/**
 * Upload Route - POST /api/upload
 *
 * Handles encrypted file uploads with OTP-based key wrapping.
 * Server stores encrypted file and wrapped key, sends separate emails for link and OTP.
 */

import crypto from "crypto";
import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import {
  createFileRecord,
  createRecipientRecord,
  logAuditEvent,
  logRecipientAuditEvent,
} from "../services/database";
import { server, storage } from "../config";
import { sendError } from "../lib/errorResponse";
import { sendDownloadLinkEmail, sendOTPEmail } from "../services/email";
import { saveFile } from "../services/file-storage";
import type {
  UploadRequest,
  UploadResponse,
  RecipientPayload,
} from "../types/api";
import { ExpiryType } from "../types/database";

const router: express.Router = express.Router();
const RADIX_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@radixweb\.com$/;

// Extend Request to include files from multer
interface UploadRequestWithFiles extends Omit<
  Request<
    {},
    UploadResponse | { error: string; message: string; details?: unknown },
    UploadRequest
  >,
  "files"
> {
  files?: {
    encryptedData?: Express.Multer.File[];
    wrappedKey?: Express.Multer.File[];
    wrappedKeySalt?: Express.Multer.File[];
  };
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const uploadValidation = [
  body("fileName")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("File name is required and must be less than 255 characters"),

  // Legacy single-recipient fields (optional in Phase 3)
  body("recipientEmail")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid recipient email is required"),

  body("otpHash")
    .optional()
    .matches(/^[A-Za-z0-9+/=]{44}$/) // SHA-256 base64 is always 44 chars
    .withMessage("Valid OTP hash is required"),

  body("otp")
    .optional()
    .matches(/^[0-9]{6}$/)
    .withMessage("Valid 6-digit OTP is required"),

  body("expiryMinutes")
    .isInt({ min: 5, max: 1440 }) // 5 minutes to 24 hours
    .withMessage("Expiry minutes must be between 5 and 1440"),

  body("expiryType")
    .isIn([ExpiryType.OneTime, ExpiryType.TimeBased])
    .withMessage('Expiry type must be "one-time" or "time-based"'),

  // New: recipients JSON payload (optional but validated if present)
  body("recipients")
    .optional()
    .custom((value) => {
      try {
        const parsed = JSON.parse(value as string);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("Recipients must be a non-empty array");
        }
        for (const r of parsed) {
          if (!r.email || !r.otpHash || !r.wrappedKey || !r.wrappedKeySalt) {
            throw new Error(
              "Each recipient must include email, otpHash, wrappedKey, wrappedKeySalt",
            );
          }
        }
        return true;
      } catch (err) {
        throw new Error("Invalid recipients payload");
      }
    }),
];

// ============================================================================
// UPLOAD ENDPOINT
// ============================================================================

router.post(
  "/",
  uploadValidation,
  async (
    req: Request<
      {},
      UploadResponse | { error: string; message: string; details?: unknown },
      UploadRequest
    >,
    res: Response<
      UploadResponse | { error: string; message: string; details?: unknown }
    >,
  ) => {
    const uploadReq = req as UploadRequestWithFiles;
    console.log("[UPLOAD] Handler entered");
    const startTime = Date.now();
    let fileId: string | null = null;

    // Check validation errors
    const errors = validationResult(req);

    console.log("[UPLOAD] Validation results:", errors);

    if (!errors.isEmpty()) {
      return sendError(
        res,
        400,
        "Validation Error",
        "Invalid request data",
        errors.array(),
      );
    }

    try {
      // Extract and validate request data
      const { fileName, expiryMinutes, expiryType } = uploadReq.body;
      console.log("[UPLOAD] Request body:", uploadReq.body);

      // Check if files were uploaded
      if (
        !uploadReq.files ||
        !uploadReq.files.encryptedData ||
        !uploadReq.files.wrappedKey ||
        !uploadReq.files.wrappedKeySalt
      ) {
        console.error("[UPLOAD] Missing files:", uploadReq.files);
        return sendError(
          res,
          400,
          "Files Required",
          "Encrypted file data, wrapped key, and salt are all required",
        );
      }

      const encryptedDataFile = uploadReq.files.encryptedData[0];
      const wrappedKeyFile = uploadReq.files.wrappedKey[0];
      const wrappedKeySaltFile = uploadReq.files.wrappedKeySalt[0];
      console.log("[UPLOAD] Received files:", {
        encryptedDataFile: encryptedDataFile?.originalname,
        wrappedKeyFile: wrappedKeyFile?.originalname,
        wrappedKeySaltFile: wrappedKeySaltFile?.originalname,
      });

      if (!encryptedDataFile || !wrappedKeyFile || !wrappedKeySaltFile) {
        return sendError(
          res,
          400,
          "Files Required",
          "All required files must be uploaded",
        );
      }

      // Validate file sizes
      const maxFileSize = storage.maxFileSize;
      if (encryptedDataFile.size > maxFileSize) {
        console.error("[UPLOAD] File too large:", encryptedDataFile.size);
        return sendError(
          res,
          413,
          "File Too Large",
          `File size ${encryptedDataFile.size} exceeds maximum ${maxFileSize / (1024 * 1024)}MB`,
        );
      }

      // Generate unique file ID
      fileId = crypto.randomUUID();
      console.log("[UPLOAD] Generated fileId:", fileId);

      // Save encrypted file to storage
      const fileResult = await saveFile(encryptedDataFile.buffer, fileName, {
        expiryMinutes,
        expiryType,
      });
      console.log("[UPLOAD] File saved:", fileResult);

      // Extract binary data from uploaded files
      const wrappedKeyBuffer = wrappedKeyFile.buffer;
      const wrappedKeySaltBuffer = wrappedKeySaltFile.buffer;

      // Determine recipients payload (Phase 3 multi-recipient)
      let recipientsPayload: RecipientPayload[] = [];

      if (uploadReq.body.recipients) {
        const parsed = JSON.parse(
          uploadReq.body.recipients as string,
        ) as RecipientPayload[];
        recipientsPayload = parsed;
      } else if (
        uploadReq.body.recipientEmail &&
        uploadReq.body.otp &&
        uploadReq.body.otpHash
      ) {
        // Legacy single-recipient path
        recipientsPayload = [
          {
            email: uploadReq.body.recipientEmail,
            otp: uploadReq.body.otp,
            otpHash: uploadReq.body.otpHash,
            wrappedKey: Buffer.from(wrappedKeyBuffer).toString("base64"),
            wrappedKeySalt:
              Buffer.from(wrappedKeySaltBuffer).toString("base64"),
          },
        ];
      } else {
        return sendError(
          res,
          400,
          "Validation Error",
          "At least one recipient is required",
        );
      }

      // Backend domain whitelist enforcement
      const invalidDomainRecipients = recipientsPayload.filter(
        (r) => !RADIX_EMAIL_REGEX.test(r.email),
      );
      if (invalidDomainRecipients.length > 0) {
        return sendError(
          res,
          400,
          "Invalid email domain",
          "Only @radixweb.com emails are allowed",
          {
            invalidEmails: invalidDomainRecipients.map((r) => r.email),
          },
        );
      }

      // Reject self-send (sender cannot be in recipient list)
      const senderEmail = (uploadReq as Request & { user?: { email: string } })
        .user?.email;
      if (senderEmail) {
        const selfSend = recipientsPayload.some(
          (r) => r.email.toLowerCase() === senderEmail.toLowerCase(),
        );
        if (selfSend) {
          return sendError(
            res,
            400,
            "Invalid recipients",
            "You cannot send a file to yourself.",
          );
        }
      }

      // Use first recipient's email for legacy files.recipient_email (NOT NULL)
      const firstRecipient = recipientsPayload[0];
      if (!firstRecipient) {
        return sendError(
          res,
          400,
          "Invalid recipients",
          "At least one recipient is required",
        );
      }
      const primaryRecipientEmail = firstRecipient.email;

      // Create database record (Phase 6: uploaded_by_user_id from auth)
      const userId =
        (uploadReq as Request & { user?: { id: string } }).user?.id ?? null;
      const recordId = await createFileRecord({
        fileId,
        fileName,
        filePath: fileResult.filename, // Store relative path
        fileSize: fileResult.size,
        recipientEmail: primaryRecipientEmail,
        wrappedKey: wrappedKeyBuffer,
        wrappedKeySalt: wrappedKeySaltBuffer,
        otpHash: firstRecipient.otpHash,
        expiryMinutes,
        expiryType,
        uploadedByUserId: userId,
      });
      console.log("[UPLOAD] DB record created:", recordId);

      // Create per-recipient records
      const recipientIds: Array<{ id: string; email: string; otp: string }> =
        [];
      for (const recipient of recipientsPayload) {
        const recipientId = await createRecipientRecord({
          fileId,
          email: recipient.email,
          otpHash: recipient.otpHash,
          wrappedKey: recipient.wrappedKey,
          wrappedKeySalt: recipient.wrappedKeySalt,
        });
        recipientIds.push({
          id: recipientId,
          email: recipient.email,
          otp: recipient.otp,
        });
      }

      // Generate download URL (frontend page where recipient enters OTP)
      const base = server.downloadPageBaseUrl.replace(/\/$/, "");
      const downloadUrl = `${base}/receive-file?fileId=${fileId}`;

      // Log successful upload
      await logAuditEvent(
        fileId,
        "upload",
        uploadReq.ip || "unknown",
        uploadReq.get("User-Agent") || "unknown",
        {
          fileName,
          fileSize: fileResult.size,
          recipientCount: recipientsPayload.length,
          expiryMinutes,
          expiryType,
          processingTimeMs: Date.now() - startTime,
        },
      );

      // Prepare base fileBody for emails
      const fileBody = {
        fileName,
        fileSize: fileResult.size,
        downloadUrl,
        expiryMinutes,
      };
      console.log("[UPLOAD] fileBody for email:", {
        ...fileBody,
        otp: "[REDACTED]",
      });

      // Send emails asynchronously (don't block response)
      const resolvedFileId = fileId;
      setImmediate(async () => {
        if (resolvedFileId === null) {
          console.error("fileId missing in email callback");
          return;
        }
        try {
          // Send per-recipient emails
          for (const recipient of recipientIds) {
            const recipientFileBody = {
              ...fileBody,
              otp: recipient.otp,
            };

            // Send download link email
            await sendDownloadLinkEmail(recipient.email, recipientFileBody);

            // Send OTP email (separate channel for security)
            await sendOTPEmail(recipient.email, recipientFileBody);

            // Per-recipient audit logging (skip if recipient row missing, e.g. FK race)
            try {
              await logRecipientAuditEvent(
                resolvedFileId,
                recipient.id,
                "otp_sent",
                uploadReq.ip || "unknown",
                uploadReq.get("User-Agent") || "unknown",
                {
                  email: recipient.email,
                },
              );
            } catch (auditErr: unknown) {
              const code = (auditErr as { code?: string })?.code;
              if (code === "23503") {
                await logAuditEvent(
                  resolvedFileId,
                  "recipient_audit_skipped",
                  uploadReq.ip || "unknown",
                  uploadReq.get("User-Agent") || "unknown",
                  { recipientId: recipient.id, email: recipient.email },
                ).catch(() => {});
              } else {
                throw auditErr;
              }
            }
          }

          console.log(`📧 Emails sent for file ${resolvedFileId}`);
        } catch (emailError) {
          console.error("Failed to send emails:", emailError);
          // Log email failure but don't affect upload success
          await logAuditEvent(
            resolvedFileId,
            "email_failed",
            uploadReq.ip || "unknown",
            uploadReq.get("User-Agent") || "unknown",
            {
              error: (emailError as Error).message,
            },
          );
        }
      });

      // Return success response
      const response: UploadResponse = {
        fileId,
        downloadUrl,
        message:
          "File uploaded successfully. Download link and OTP sent to recipient.",
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + expiryMinutes * 60 * 1000,
        ).toISOString(),
      };

      res.status(200).json(response);

      console.log(
        `✅ File uploaded: ${fileId} (${fileResult.size} bytes) for ${primaryRecipientEmail}`,
      );
      return;
    } catch (error) {
      console.error("Upload error:", error);

      // Log failed upload
      await logAuditEvent(
        fileId || "unknown",
        "upload_failed",
        uploadReq.ip || "unknown",
        uploadReq.get("User-Agent") || "unknown",
        {
          error: (error as Error).message,
          processingTimeMs: Date.now() - startTime,
        },
      );

      return sendError(
        res,
        500,
        "Upload Failed",
        "Failed to process file upload",
        server.nodeEnv === "development" ? (error as Error).message : undefined,
      );
    }
  },
);

export default router;
