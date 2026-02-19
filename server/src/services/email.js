/**
 * Email Service - Nodemailer Implementation
 *
 * Handles secure delivery of download links and OTP codes.
 * Uses separate email channels for enhanced security.
 */

import nodemailer from "nodemailer";
import { email as emailConfig, emailMock } from "../config.js";

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

let transporter = null;

/**
 * Mock email sender for development
 */
async function mockSendMail(mailOptions) {
  console.log("📧 [MOCK EMAIL] - Would send email:");
  console.log("   To:", mailOptions.to);
  console.log("   Subject:", mailOptions.subject);
  console.log("   From:", mailOptions.from);
  console.log("   Body preview:", mailOptions.text?.substring(0, 100) + "...");

  return {
    messageId: `mock-${Date.now()}`,
    mock: true,
  };
}

export async function initEmailService() {
  // For development, allow mock email service
  const useMockEmail =
    emailMock.enabled || process.env.NODE_ENV === "development";

  if (useMockEmail) {
    console.log("📧 Using mock email service (development mode)");
    console.log(
      "💡 Set USE_MOCK_EMAIL=false and configure real email credentials for production",
    );
    transporter = {
      sendMail: mockSendMail,
      verify: () => Promise.resolve(true),
    };
    return true;
  }

  // Check if email is configured (from config module)
  if (!emailConfig.user || !emailConfig.pass) {
    throw new Error(
      "Email service not configured. Set EMAIL_USER and EMAIL_PASS environment variables.",
    );
  }

  // Create transporter from config
  transporter = nodemailer.createTransport({
    service: emailConfig.service,
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
    // Additional security options
    tls: {
      rejectUnauthorized: false, // For development only
    },
  });

  // Verify connection
  try {
    await transporter.verify();
    console.log("✅ Email service connected");
    return true;
  } catch (error) {
    console.error("❌ Email service verification failed:", error.message);
    throw error;
  }
}

/**
 * Check if email service is configured
 */
function isEmailConfigured() {
  return transporter !== null;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Send download link email (Channel 1)
 */
export async function sendDownloadLinkEmail(recipientEmail, data) {
  if (!isEmailConfigured()) {
    throw new Error("Email service not initialized");
  }

  const { fileName, fileSize, downloadUrl, expiryMinutes } = data;

  const mailOptions = {
    from: emailConfig.from,
    to: recipientEmail,
    subject: `Secure file shared with you - ${fileName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure File Delivery</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔒 Secure File Delivery</h1>
    <p>Someone has shared an encrypted file with you</p>
  </div>

  <div class="content">
    <h2>File Details</h2>
    <p><strong>File Name:</strong> ${fileName}</p>
    <p><strong>File Size:</strong> ${(fileSize / (1024 * 1024)).toFixed(2)} MB</p>
    <p><strong>Expires:</strong> ${expiryMinutes} minutes from now</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${downloadUrl}" class="button">📥 Download Your File</a>
    </div>

    <div class="warning">
      <strong>⚠️ Important:</strong> You will need a one-time password (OTP) to decrypt the file.
      The OTP has been sent to you in a separate message for security.
    </div>

    <p><strong>Security Notice:</strong> This file is encrypted end-to-end. Your password is never sent to our servers, and we cannot access your file contents.</p>
  </div>

  <div class="footer">
    <p>Radixweb Secure File Encryptor</p>
    <p>All encryption happens in your browser. Zero-knowledge security.</p>
  </div>
</body>
</html>
    `,
    text: `
Secure File Delivery

Someone has shared an encrypted file with you.

File Details:
- File Name: ${fileName}
- File Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB
- Expires: ${expiryMinutes} minutes from now

Download Link: ${downloadUrl}

IMPORTANT: You will need a one-time password (OTP) to decrypt the file.
The OTP has been sent to you in a separate message for security.

Security Notice: This file is encrypted end-to-end. Your password is never sent to our servers.

---
Radixweb Secure File Encryptor
All encryption happens in your browser. Zero-knowledge security.
    `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(
      `📧 Download link email sent to ${recipientEmail}: ${result.messageId}`,
    );
    return result;
  } catch (error) {
    console.error("Failed to send download link email:", error);
    throw error;
  }
}

/**
 * Send OTP email (Channel 2 - Separate for Security)
 */
export async function sendOTPEmail(recipientEmail, data) {
  if (!isEmailConfigured()) {
    throw new Error("Email service not initialized");
  }

  const { fileName, downloadUrl, expiryMinutes, otp } = data;

  console.log(`🔐 Sending OTP ${otp} to ${recipientEmail}`);

  const mailOptions = {
    from: emailConfig.from,
    to: recipientEmail,
    subject: "Your one-time password for secure file delivery",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your OTP Code</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .otp-code { font-size: 32px; font-weight: bold; text-align: center; background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; letter-spacing: 5px; }
    .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔐 One-Time Password</h1>
    <p>Your secure file decryption code</p>
  </div>

  <div class="content">
    <h2>Your OTP Code</h2>
    <div class="otp-code">${otp}</div>

    <div class="warning">
      <strong>⚠️ CRITICAL SECURITY INFORMATION:</strong>
      <ul>
        <li>This OTP is valid for only <strong>5 minutes</strong></li>
        <li>You can attempt to enter it <strong>3 times</strong> before it expires</li>
        <li><strong>DO NOT share this code with anyone</strong></li>
        <li>This code was sent via a different channel than your download link</li>
      </ul>
    </div>

    <p><strong>File:</strong> ${fileName}</p>
    <p><strong>Expires:</strong> ${expiryMinutes} minutes from now</p>

    <p><strong>Next Steps:</strong></p>
    <ol>
      <li>Click the download link from your other email</li>
      <li>Enter this OTP when prompted</li>
      <li>Your file will be decrypted locally in your browser</li>
    </ol>
  </div>

  <div class="footer">
    <p>Radixweb Secure File Encryptor</p>
    <p>If you did not expect this email, please ignore it.</p>
  </div>
</body>
</html>
    `,
    text: `
YOUR ONE-TIME PASSWORD: ${otp}

CRITICAL SECURITY INFORMATION:
- This OTP is valid for only 5 minutes
- You can attempt to enter it 3 times before it expires
- DO NOT share this code with anyone
- This code was sent via a different channel than your download link

File: ${fileName}
Expires: ${expiryMinutes} minutes from now

Next Steps:
1. Click the download link from your other email
2. Enter this OTP when prompted
3. Your file will be decrypted locally in your browser

---
Radixweb Secure File Encryptor
If you did not expect this email, please ignore it.
    `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`🔐 OTP email sent to ${recipientEmail}: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Send test email for configuration verification
 */
export async function sendTestEmail(recipientEmail) {
  if (!isEmailConfigured()) {
    throw new Error("Email service not initialized");
  }

  const mailOptions = {
    from: emailConfig.from,
    to: recipientEmail,
    subject: "Secure File Server - Test Email",
    text: "This is a test email from your Secure File Server. Email service is working correctly!",
    html: "<h1>Test Email</h1><p>This is a test email from your Secure File Server. Email service is working correctly!</p>",
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`🧪 Test email sent to ${recipientEmail}: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error("Failed to send test email:", error);
    throw error;
  }
}
