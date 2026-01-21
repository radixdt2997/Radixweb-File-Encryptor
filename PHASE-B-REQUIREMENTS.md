# Phase B Server Implementation Guide

**Status**: Ready to implement
**Expected Duration**: 2-3 weeks
**Tech Stack**: Node.js + Express + PostgreSQL/SQLite + Nodemailer

---

## API Endpoints (Client Expects These)

### 1. POST `/api/upload`

**Upload encrypted file and wrapped key**

```javascript
// Request (multipart/form-data)
{
  fileName: string,               // Original file name
  encryptedData: Blob,           // Encrypted file (Phase A output)
  wrappedKey: Blob,              // Encrypted fileKey (Phase A output)
  wrappedKeySalt: Blob,          // Salt for OTP derivation (Phase A output)
  recipientEmail: string,        // Email to send download link
  otpHash: string,               // SHA-256 hash of OTP (Phase A output)
  expiryMinutes: number,         // 5-1440 minutes
  expiryType: string             // 'one-time' or 'time-based'
}

// Response (200 OK)
{
  fileId: string,                // Unique identifier (use for download link)
  downloadUrl: string            // Full URL recipient clicks: https://example.com/?fileId=abc123
}

// Error (400/500)
{
  message: string                // Error description
}
```

**What Server Does**:

1. Validate multipart request
2. Verify otpHash is valid SHA-256 format
3. Store encryptedData blob to file storage (disk/S3)
4. Create database record:
   - fileId (UUID)
   - fileName
   - recipientEmail
   - wrappedKey (BLOB)
   - wrappedKeySalt (BLOB)
   - otpHash (STRING)
   - expiryTime (TIMESTAMP = now + expiryMinutes)
   - expiryType (one-time / time-based)
   - createdAt (TIMESTAMP)
   - status (active/expired/used)
5. Send email to recipientEmail with download link
6. Return fileId and downloadUrl

**Security Checks**:

- ✓ Validate file size < 100MB
- ✓ Validate email format
- ✓ Validate expiryMinutes in range [5, 1440]
- ✓ Rate limit: max 10 uploads per IP per hour
- ✓ Log all uploads to audit table

---

### 2. POST `/api/verify-otp`

**Verify OTP and return wrapped key**

```javascript
// Request (application/json)
{
  fileId: string,                // From URL: ?fileId=abc123
  otp: string                    // 6-digit code from email
}

// Response (200 OK)
{
  wrappedKey: string,            // Base64-encoded BLOB (client will decode)
  wrappedKeySalt: string,        // Base64-encoded BLOB (client will decode)
  fileName: string,              // For display to recipient
  fileSize: number               // In bytes
}

// Error (400)
{
  message: string                // "Invalid OTP", "File expired", "Too many attempts"
}
```

**What Server Does**:

1. Retrieve file record by fileId
2. Check if file is expired (expiryTime > now)
3. If expired, return 400 "File has expired"
4. Check if one-time and already downloaded
5. If already used, return 400 "File already downloaded"
6. Increment attempt counter for this fileId
7. If attempts > 3, return 400 "Too many attempts"
8. Hash incoming OTP: SHA-256(otp)
9. Compare with stored otpHash
10. If hash mismatch, return 400 "Invalid OTP"
11. If hash matches:
    - Mark as used (if one-time)
    - Return wrappedKey + wrappedKeySalt in base64
    - Log successful verification
12. Return 200 with wrapped key

**Security Checks**:

- ✓ OTP validation timing attack resistant (compare hash with constant-time)
- ✓ Max 3 attempts per file per IP
- ✓ Cooldown after failed attempt: 5 seconds
- ✓ Log all verification attempts (success + failure)
- ✓ Never log plaintext OTP

**Database Update**:

- otpAttempts++
- lastAttemptAt = now
- if(hash matches) → status = 'used' (for one-time)

---

### 3. GET `/api/download/:fileId`

**Download encrypted file**

```javascript
// Request
GET /api/download/abc123?token=xyz  // Optional: token from email link

// Response (200 OK, application/octet-stream)
[Binary encrypted file data]

// Error (400/404)
{
  message: string                // "File not found", "File expired", etc.
}
```

**What Server Does**:

1. Retrieve file record by fileId
2. Check if file exists
3. If not found, return 404
4. Check if file is expired
5. If expired, return 400 "File has expired"
6. Check if one-time and already downloaded
7. If already used and one-time, return 400 "File already downloaded"
8. Stream encrypted file from storage
9. Set headers: Content-Type: application/octet-stream, Content-Disposition: attachment
10. Log download event

**Note**: This endpoint is called AFTER successful OTP verification. Client has already proven possession of OTP.

---

### 4. GET `/api/metadata/:fileId`

**Fetch file metadata (before OTP entry)**

```javascript
// Request
GET /api/metadata/abc123

// Response (200 OK)
{
  fileName: string,              // For display before OTP
  fileSize: number,              // In bytes
  expiryTime: string             // ISO timestamp when file expires
}

// Error (404)
{
  message: string
}
```

**What Server Does**:

1. Retrieve file record by fileId
2. If not found, return 404
3. Return fileName, fileSize, expiryTime
4. Note: No auth needed - metadata is public

---

### 5. GET `/api/health`

**Health check**

```javascript
// Request
GET /api/health

// Response (200 OK)
{
  status: "ok",
  timestamp: string              // ISO timestamp
}
```

---

## Database Schema

### Files Table

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id VARCHAR(36) UNIQUE NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,           -- Storage path (disk/S3)
  file_size BIGINT NOT NULL,                 -- In bytes
  recipient_email VARCHAR(255) NOT NULL,
  wrapped_key BYTEA NOT NULL,                -- Encrypted fileKey
  wrapped_key_salt BYTEA NOT NULL,           -- Salt for OTP derivation
  otp_hash VARCHAR(88) NOT NULL,             -- SHA-256 base64 (always 88 chars)
  expiry_type VARCHAR(20) NOT NULL,          -- 'one-time' or 'time-based'
  expiry_time TIMESTAMP NOT NULL,            -- When file becomes inaccessible
  status VARCHAR(20) DEFAULT 'active',       -- active, expired, used
  otp_attempts INTEGER DEFAULT 0,            -- Increment on each verify attempt
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  downloaded_at TIMESTAMP,
  INDEX idx_file_id (file_id),
  INDEX idx_recipient_email (recipient_email),
  INDEX idx_expiry_time (expiry_time),
  INDEX idx_status (status)
);
```

### Recipients Table (Optional, for tracking)

```sql
CREATE TABLE recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_verified_at TIMESTAMP,
  downloaded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  INDEX idx_file_id (file_id),
  INDEX idx_email (email)
);
```

### Logs Table (Audit Trail)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,           -- upload, otp_requested, otp_verified, otp_failed, download, expired
  ip_address INET,
  user_agent TEXT,
  details JSONB,                             -- Event-specific data
  created_at TIMESTAMP DEFAULT now(),
  INDEX idx_file_id (file_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
);
```

---

## Email Templates

### Template 1: Download Link Email (To Recipient)

```
Subject: Secure file shared with you - [SENDER_NAME]

Hi [RECIPIENT_NAME],

Someone has shared a secure file with you using Radixweb File Encryptor.

📥 Download your file here:
https://example.com/?fileId=[FILE_ID]

⚠️ You will need the one-time password (OTP) to decrypt the file.
The OTP will be sent to you in a separate message for security.

File expires in: [EXPIRY_TIME]
File name: [FILE_NAME]
File size: [FILE_SIZE]

---
Radixweb File Encryptor
All encryption happens in your browser. No servers see your files.
```

### Template 2: One-Time Password Email (To Recipient, SEPARATE)

```
Subject: Your one-time password for secure file delivery

Hi [RECIPIENT_NAME],

Your one-time password (OTP) to decrypt the shared file is:

🔐 [OTP_6_DIGITS]

⚠️ IMPORTANT:
- This OTP is valid for 5 minutes only
- You can attempt to enter it 3 times before it expires
- Do NOT share this code with anyone
- It will be sent via a DIFFERENT channel than your download link

If you did not expect this email, please ignore it.

---
Radixweb File Encryptor
```

**Why Separate?** If attacker compromises one email, they still need the other to access the file.

---

## Implementation Phases (Phase B breakdown)

### Phase B.1: Database + File Storage (Week 1)

- [ ] Set up PostgreSQL or SQLite
- [ ] Create schema (Files, Recipients, Logs tables)
- [ ] Implement file storage (disk or S3 integration)
- [ ] Setup connection pooling
- [ ] Write database helpers (insert, fetch, update)

### Phase B.2: Express Server + Routes (Week 1-2)

- [ ] Create Express app
- [ ] Implement POST /api/upload
- [ ] Implement POST /api/verify-otp
- [ ] Implement GET /api/download/:fileId
- [ ] Implement GET /api/metadata/:fileId
- [ ] Implement GET /api/health
- [ ] Add CORS headers
- [ ] Add security headers (HSTS, CSP, X-Frame-Options)

### Phase B.3: OTP Management (Week 2)

- [ ] OTP generation (optional, or let client handle)
- [ ] OTP hashing and verification
- [ ] Attempt limiting (3 per file)
- [ ] Cooldown logic (5 seconds between attempts)
- [ ] Expiry validation

### Phase B.4: Email Delivery (Week 2-3)

- [ ] Setup Nodemailer or SendGrid
- [ ] Email template rendering
- [ ] Separate email delivery (link email + OTP email)
- [ ] Retry logic (exponential backoff)
- [ ] Dead letter queue for failed sends
- [ ] Email verification (optional: recipient confirmation)

### Phase B.5: Logging & Security (Week 3)

- [ ] Audit logging (all operations)
- [ ] Request logging (IP, user agent)
- [ ] Rate limiting per IP
- [ ] Input validation (file size, email format, etc.)
- [ ] Error handling (never leak sensitive info)
- [ ] SQL injection prevention (use prepared statements)
- [ ] CSRF protection

### Phase B.6: Testing & Hardening (Week 4-5)

- [ ] Unit tests (OTP verification, file lookup)
- [ ] Integration tests (upload → verify → download flow)
- [ ] Security tests (brute force, timing attacks, SQL injection)
- [ ] Load testing
- [ ] Edge case testing (expired files, multiple recipients, etc.)

---

## Configuration

### Environment Variables (.env)

```bash
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_file_app
DB_USER=postgres
DB_PASSWORD=<secure_password>

# Email
EMAIL_SERVICE=SendGrid  # or Nodemailer
EMAIL_FROM=noreply@example.com
EMAIL_USERNAME=<api_key>
EMAIL_PASSWORD=<password>

# Storage
STORAGE_TYPE=disk  # or s3
STORAGE_PATH=/var/uploads
S3_BUCKET=secure-files
S3_REGION=us-east-1

# Security
CORS_ORIGIN=https://example.com
JWT_SECRET=<random_secret>
SESSION_SECRET=<random_secret>
RATE_LIMIT_WINDOW_MS=3600000  # 1 hour
RATE_LIMIT_MAX_REQUESTS=10    # Per IP per window

# File Cleanup (optional)
FILE_RETENTION_DAYS=30  # Delete files after 30 days
CLEANUP_INTERVAL_HOURS=24
```

---

## Security Checklist for Phase B

### Before Going to Production

- [ ] All passwords hashed with bcrypt (if any)
- [ ] All sensitive data encrypted at rest (if stored)
- [ ] HTTPS only (no HTTP)
- [ ] HSTS header set (strict-transport-security)
- [ ] CSP header set (Content-Security-Policy)
- [ ] CSRF tokens for state-changing operations
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all fields
- [ ] No console.log of sensitive data
- [ ] Error messages don't leak system info
- [ ] Database backups automated
- [ ] Logs rotated and archived
- [ ] SQL injection prevention (prepared statements)
- [ ] XSS prevention (sanitize user input)
- [ ] File upload validation (type, size, mime)
- [ ] Email validation (prevent spamming)
- [ ] OTP constant-time comparison (prevent timing attacks)

---

## Deployment Considerations

### For Local Development

```bash
npm install
npm run dev  # Watch mode with nodemon
```

### For Production

```bash
npm ci                          # Clean install from package-lock.json
NODE_ENV=production npm start   # Single process
# OR use PM2 for process management
pm2 start server/src/app.js --name "secure-file-app"
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Monitoring & Alerting

### Logs to Track

- All file uploads (with fileId, size, recipient email)
- All OTP verification attempts (success + failure)
- All downloads
- All errors (with context)
- Rate limit violations
- Failed email deliveries

### Metrics to Monitor

- Upload success rate
- OTP verification success rate
- Average file size
- File retention/cleanup status
- Email delivery success rate
- Server response times
- Database query performance

---

## Next Steps

1. **Create server directory structure**

   ```
   server/
   ├── src/
   │   ├── app.js
   │   ├── routes/
   │   │   ├── upload.js
   │   │   ├── verify-otp.js
   │   │   ├── download.js
   │   │   └── metadata.js
   │   ├── controllers/
   │   ├── services/
   │   ├── middleware/
   │   └── db/
   ├── migrations/
   ├── .env
   ├── .env.example
   └── package.json
   ```

2. **Create package.json with dependencies**

   ```json
   {
     "dependencies": {
       "express": "^4.18.0",
       "pg": "^8.8.0",
       "nodemailer": "^6.9.0",
       "cors": "^2.8.5",
       "dotenv": "^16.0.0",
       "uuid": "^9.0.0",
       "bcryptjs": "^2.4.3"
     },
     "devDependencies": {
       "nodemon": "^2.0.20",
       "jest": "^29.0.0"
     }
   }
   ```

3. **Start with database setup** (migrations)

4. **Implement endpoints** (start with `/api/upload`)

5. **Add email integration** (after core functionality works)

---

## Estimated Effort

- **Backend Setup**: 2-3 days
- **Database Schema**: 1-2 days
- **Core Endpoints**: 5-7 days
- **Email Integration**: 3-4 days
- **Testing & Security**: 5-7 days
- **Documentation**: 2-3 days

**Total**: 3-5 weeks (18-25 days) for complete Phase B

This will result in a fully functional passwordless file delivery system.

---

## Communication with Client

The client-side code will:

1. Upload encrypted file + wrapped key (no plaintext sensitive data sent)
2. Wait for fileId response
3. Display link + OTP to sender
4. Recipient clicks link → receives fileId via URL parameter
5. Recipient enters OTP → client verifies with server
6. Server returns wrapped key → client unwraps with OTP
7. Client downloads encrypted file → decrypts locally
8. User has plaintext file on their device

**Server never sees plaintext file or plaintext OTP.**
