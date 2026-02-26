# 🔒 Secure File App

A zero-knowledge file encryption and delivery system with passwordless sharing via OTP-based key wrapping. Built with modern React, TypeScript, and Node.js for secure, user-friendly file sharing.

## Features

✅ **Client-Side Encryption** - All encryption happens in your browser  
✅ **Passwordless Sharing** - Share files securely without passwords  
✅ **OTP-Based Security** - 6-digit codes for secure key unwrapping  
✅ **Zero-Knowledge** - Server never sees your files or keys  
✅ **Modern UI** - Professional Tailwind CSS interface with real-time validation  
✅ **TypeScript Safety** - 100% type-safe frontend and backend  
✅ **React Best Practices** - useCallback, useMemo, React.memo optimizations  
✅ **Email Delivery** - Automatic link and OTP delivery via two-channel security  
✅ **Environment Configuration** - Easy deployment across environments  
✅ **Rate Limiting** - Built-in protection against abuse  
✅ **Multi-Recipient Support** - Share with multiple recipients securely  
✅ **API Documentation** - Swagger UI at `/api-docs` (OpenAPI 3.0)  
✅ **Encryption at Rest** - Optional server-side encryption for files and DB (AES-256-GCM, HKDF)  
✅ **User Authentication** - Login and register with JWT; optional email domain restriction  
✅ **My Transactions** - Dashboard of sent and received files with filters (file name, email, expiry method)

## Quick Start

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or pnpm
- PostgreSQL (for backend: users, files, transactions)
- Email account (Gmail recommended) with App Password

### Frontend (React + TypeScript + Tailwind)

```bash
cd client

# Setup
cp .env.example .env
npm install

# Development
npm run dev
# Opens on http://localhost:5173

# Build for production
npm run build
```

### Backend (Node.js + Express + PostgreSQL)

```bash
cd server

# Setup
cp .env.example .env
npm install

# Development (with disabled rate limits for testing)
npm run dev
# Runs on http://localhost:3000

# Production
npm start
```

## How It Works

### 🔐 Security Model

1. **File Encryption**: Files encrypted with random AES-256-GCM keys in browser
2. **Per-Recipient Key Wrapping**: Each recipient gets unique key wrapped with their OTP (PBKDF2, 250k iterations)
3. **Server Storage**: Only encrypted files and wrapped keys stored on server
4. **Two-Channel Delivery**: Download link and OTP sent via separate emails
5. **Zero Knowledge**: Server cannot decrypt files without OTP from recipient
6. **Timing Attack Prevention**: Constant-time comparisons on OTP verification
7. **Rate Limiting**: Protection against brute force and abuse

### 📤 Sending Files (Multi-Recipient)

1. Select file and add recipient emails
2. File encrypted locally with random AES-256 key
3. For each recipient:
    - Generate unique 6-digit OTP
    - Wrap file key with OTP-derived key
    - Hash OTP (SHA-256) for storage
4. Upload encrypted file + all wrapped keys to server
5. Recipients get download link + their OTP via separate emails

### 📥 Receiving Files

1. Click download link from email (with fileId parameter)
2. File info loads automatically (name, size, expiry)
3. Enter 6-digit OTP from separate email
4. Server verifies OTP and returns wrapped key
5. Browser unwraps key and downloads encrypted file
6. File decrypted locally in browser

### 🔐 Two-Channel Security Model

The system uses **separate emails** for download link and OTP code as a security best practice:

**Why Two Emails?**

- **Defense against email compromise** - Single intercepted email cannot access file
- **Out-of-band authentication** - Industry standard for banking/2FA systems
- **Defense in depth** - Multiple security layers reduce attack surface
- **Zero-trust principle** - No single communication channel is fully trusted

**Email Delivery:**

- **Email 1**: Download link only (no sensitive data)
- **Email 2**: OTP code only (expires in 5 minutes)
- **Requirement**: Both emails needed to decrypt file

This approach follows security best practices where even if one email account is compromised, the attacker still cannot access the encrypted file without both pieces of information.

## Usage Modes

### 🚀 Send File

- Upload and encrypt files (login optional; when logged in, uploads are tied to your account)
- Generate secure sharing links
- Automatic email delivery
- Manage shared file: view recipients, revoke access, see OTP attempts (when opened from My Transactions)

### 📨 Receive File

- Access files via shared links (from email or My Transactions)
- Enter OTP for verification (email pre-filled when logged in)
- Download and decrypt locally

### 📋 My Transactions

- View all files you sent or received
- Filter by file name, email, and type (Sent / Received)
- Admins can view all users’ transactions
- Open sent files to manage recipients; open received files to download

### 🔑 Legacy Mode

- Password-based encryption/decryption
- No server required
- Compatible with original format

## API Endpoints

| Method   | Path                                         | Description                                                                                                                                                                                                                        |
| -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/health`                                | Health check (DB, storage, stats). No auth.                                                                                                                                                                                        |
| `POST`   | `/api/auth/login`                            | Login. Body: `{ "email", "password" }`. Returns `{ token, user }`.                                                                                                                                                                 |
| `POST`   | `/api/auth/register`                         | Register (if allowed). Body: `{ "email", "password" }`. Returns `{ token, user }`.                                                                                                                                                 |
| `GET`    | `/api/auth/me`                               | Current user. Requires `Authorization: Bearer <token>`. Returns `{ user }`.                                                                                                                                                        |
| `GET`    | `/api/transactions`                          | List sent/received files. Auth required. Query: `page`, `limit`, `type` (sent\|received), `scope` (all, admin only), `fileName`, `email`.                                                                                         |
| `POST`   | `/api/test-email`                            | Send test email (development only). Body: `{ "email": "..." }`.                                                                                                                                                                    |
| `POST`   | `/api/upload`                                | Upload encrypted file + wrapped keys. Multipart: `encryptedData`, `wrappedKey`, `wrappedKeySalt`; form fields: `fileName`, `expiryMinutes`, `expiryType`, optional `recipients` (JSON) or legacy `recipientEmail`/`otp`/`otpHash`. |
| `POST`   | `/api/verify-otp`                            | Verify OTP and get wrapped key. Body: `{ "fileId", "otp", "recipientEmail"?(multi-recipient) }`.                                                                                                                                   |
| `GET`    | `/api/download/:fileId`                      | Download encrypted file (after OTP verified). Returns binary.                                                                                                                                                                      |
| `GET`    | `/api/metadata/:fileId`                      | Get file metadata (name, size, expiry). No auth.                                                                                                                                                                                   |
| `GET`    | `/api/files/:fileId/recipients`              | List recipients for a file. Auth required (uploader or admin).                                                                                                                                                                     |
| `DELETE` | `/api/files/:fileId/recipients/:recipientId` | Revoke a recipient. Auth required (uploader or admin).                                                                                                                                                                              |

All API routes are rate-limited. See Security Features below for limits.

### Swagger / OpenAPI Documentation

When the server is running, interactive API docs are available at:

- **Swagger UI:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (or your `API_BASE_URL` + `/api-docs`)
- **OpenAPI JSON:** `GET /api-docs.json` for the raw OpenAPI 3.0 spec

Swagger is **enabled by default in development** and **disabled in production** unless `SWAGGER_ENABLED=true`. Use it to explore endpoints, request/response schemas, and try requests. The spec documents all paths above plus error shapes and validation rules.

For **optional server-side encryption at rest** (files on disk and sensitive DB columns), see [Encryption at Rest (Optional)](#encryption-at-rest-optional) under Security Features.

## Configuration

### Frontend Environment Variables (.env.local)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api

# UI Settings
VITE_DEFAULT_EXPIRY_MINUTES=60
VITE_MIN_EXPIRY_MINUTES=5
VITE_MAX_EXPIRY_MINUTES=1440

# Email Validation
VITE_ALLOWED_EMAIL_DOMAIN=radixweb.com

# Encryption
VITE_PBKDF2_ITERATIONS=250000

# Debug Mode
VITE_DEBUG_MODE=false
```

See `client/.env.example` and `client/ENV_CONFIGURATION.md` for complete configuration options.

### Backend Environment Variables (.env.development)

For **local development**, rate limits are disabled. Create `.env.development`:

```bash
# Rate limits DISABLED for local testing
RATE_LIMIT_MAX_REQUESTS=999999
OTP_MAX_ATTEMPTS=999999
UPLOAD_RATE_LIMIT_MAX_REQUESTS=999999
FILE_ACCESS_RATE_LIMIT_MAX_REQUESTS=999999
RECIPIENT_ACCESS_RATE_LIMIT_MAX_REQUESTS=999999

# Email Configuration (required)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server
PORT=3000
NODE_ENV=development
```

For **production**, see `server/.env.example` for production rate limiting settings.

### Authentication (JWT)

The server uses JWT for authenticated routes (transactions, recipient list, revoke). Configure:

| Variable                     | Description                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| `JWT_SECRET`                 | Secret for signing JWTs. Required for auth.                                 |
| `JWT_EXPIRES_IN_SECONDS`     | Access token lifetime (e.g. 3600 = 1 hour, 900 = 15 min). Default: 3600.   |
| `ALLOWED_EMAIL_DOMAIN`       | Only this domain can login/register (e.g. `radixweb.com`). Default: radixweb.com. |
| `ALLOW_SELF_REGISTRATION`    | Set to `false` to disable public registration. Default: true.              |

Client stores the token (e.g. in localStorage) and sends `Authorization: Bearer <token>` on protected requests.

### Email Setup

1. Enable 2FA on your Gmail account
2. Generate an [App Password](https://support.google.com/accounts/answer/185833)
3. Use the generated password as `EMAIL_PASS`
4. Or configure SMTP for other email providers

## Security Features

For detailed explanations of the cryptographic and security concepts used (AES-256-GCM, PBKDF2, SHA-256, HKDF, IV/salt, constant-time comparison, etc.) and why they were chosen, see **[SECURITY.md](SECURITY.md)**.

### Encryption & Key Management

- **AES-256-GCM Encryption** - 256-bit authenticated encryption with random IVs
- **PBKDF2 Key Derivation** - 250,000 iterations for OTP key derivation
- **Cryptographically Secure Random** - Web Crypto API for all random values
- **Per-Recipient Wrapped Keys** - Each recipient has unique OTP-derived wrapping key
- **SHA-256 OTP Hashing** - OTPs never stored plaintext, only hashed

### Attack Prevention

- **Timing Attack Protection** - Constant-time OTP comparison using crypto.timingSafeEqual
- **Rate Limiting** - Multi-tiered protection:
    - General: 100 requests/15 min
    - OTP verification: 3 attempts/5 sec
    - File uploads: 20/15 min
    - File access: 30/1 min
    - Recipient operations: 5/15 min
- **Input Validation** - Express-validator on all endpoints
- **CORS Protection** - Configurable allowed origins
- **Security Headers** - Helmet.js for HTTP security headers

### Database Security

- **PostgreSQL with Foreign Keys** - Referential integrity enforced
- **Indexed Queries** - Performance optimization on sensitive fields
- **Audit Logging** - Per-recipient and per-file access tracking
- **Automatic Cleanup** - Expired files automatically removed

### Encryption at Rest (Optional)

The server can encrypt data **on disk** in addition to the existing zero-knowledge client-side encryption. This does not change the client flow: files are still encrypted in the browser before upload; the server only adds a second layer for storage.

**What is encrypted when enabled:**

- **File storage**: Each file blob on disk is encrypted with a server-derived key (AES-256-GCM) before `fs.writeFile`. On read, the blob is decrypted so the API still returns the same client-encrypted payload.
- **Database**: Sensitive columns (`wrapped_key`, `wrapped_key_salt`) are encrypted before INSERT and decrypted after SELECT. Legacy rows without the version byte are read as plaintext for backward compatibility.

**Key hierarchy:**

- **Master key (KEK)**: Set via `ENCRYPTION_MASTER_KEY` (32 bytes as 64 hex or 44 base64 chars). In production, use a secret manager or KMS; do not commit the key.
- **Data encryption keys (DEK)**: Derived from the master key with HKDF (separate keys for file storage and DB). No DEKs are stored on disk.

**Environment variables:**

| Variable                | Description                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `ENCRYPTION_MASTER_KEY` | 32-byte key as 64 hex chars or 44 base64 chars. Required when encryption at rest is enabled. |
| `ENCRYPTION_ENABLED`    | Set to `true` to enable. Default is `false` for safe rollout.                                |

**Migration:** Existing files and DB rows remain readable (legacy format). To encrypt them, set `ENCRYPTION_MASTER_KEY` and `ENCRYPTION_ENABLED=true`, then run:

```bash
cd server && pnpm run migrate-encryption-at-rest
```

Alternatively, leave legacy data as-is; it will be removed by retention. New data will be encrypted at rest once the feature is enabled.

**Security notes:**

- **No key or plaintext logging** – The master key and decrypted content are never logged.
- **Key rotation** – To rotate the master key: derive new DEKs, re-encrypt existing data with the new DEKs (e.g. run the migration script with the new key after writing a script that decrypts with the old key and encrypts with the new), then switch to the new master key.
- **Full-disk encryption** – Use OS- or hardware-level full-disk encryption on the server as an additional layer; encryption at rest protects against exposure of raw disk or backups.

### Infrastructure

- **HTTPS Ready** - Set NODE_ENV=production for HSTS headers
- **No Plaintext Storage** - Files and keys never stored unencrypted
- **Two-Channel Security** - Download links and OTPs sent separately

## File Format

### Encrypted Files

```
[Salt: 16 bytes][IV: 12 bytes][Encrypted Data: variable]
```

### Wrapped Keys

```
[IV: 12 bytes][Encrypted Key: variable]
```

## Browser Support

- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 79+

Requires Web Crypto API support.

## Architecture & Code Quality

### Frontend (React + TypeScript)

- **100% TypeScript** - Strict mode, no `any` types
- **React Hooks** - useState, useCallback, useMemo, useEffect
- **Component Optimization** - React.memo on expensive components
- **Memoized Callbacks** - All event handlers wrapped with useCallback
- **Computed State** - Email validation cached with useMemo
- **UI Component Library** - Reusable Button, Input, Card, Alert components
- **Tailwind CSS** - Modern, responsive design with dark theme
- **Type Safety** - Centralized type definitions with full inference

### Backend (Node.js + Express)

- **Express Framework** - Modular route-based architecture
- **PostgreSQL Database** - Migrations on init, connection via DATABASE_URL
- **Service Layer** - Separated concerns (crypto, email, database, storage)
- **Environment Configuration** - All settings via environment variables
- **Error Handling** - Comprehensive try-catch with user-friendly messages
- **Logging** - Console and file-based audit logging
- **Middleware Chain** - Security headers, CORS, rate limiting, validation

### Development Practices

- **Git-based Workflow** - Feature branching and modular development
- **Environment Files** - Example files for easy setup (.env.example)
- **Documentation** - Inline comments and comprehensive markdown guides
- **Type Definitions** - Shared types between frontend and backend
- **Configuration Management** - Centralized env.ts for frontend config

## Deployment

### Frontend (Static Hosting)

```bash
cd client
npm run build
# Deploy dist/ folder to Netlify, Vercel, etc.
```

### Backend (Node.js Hosting)

```bash
cd server
npm ci --production
NODE_ENV=production npm start
# Deploy to Railway, Render, AWS, etc.
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## Troubleshooting

### Common Issues

**"Upload failed"**

- Check server is running on port 3000
- Verify CORS settings allow frontend origin
- Check file size under 100MB limit

**"Email not sent"**

- Verify EMAIL_USER and EMAIL_PASS in .env
- Check Gmail App Password is correct
- Ensure 2FA enabled on Gmail account

**"OTP verification failed"**

- Ensure OTP entered exactly as received
- Check OTP hasn't expired (5 minutes)
- Verify file hasn't been downloaded already (if one-time)

**"File not found"**

- Check fileId in URL is correct
- Verify file hasn't expired
- Ensure server database is accessible

### Debug Mode

```bash
# Enable detailed logging
DEBUG=* npm start
```

## Security Considerations

For security and crypto concepts (AES-256-GCM, PBKDF2, SHA-256, HKDF, etc.), see [SECURITY.md](SECURITY.md).

### ✅ Safe Practices

- All encryption happens client-side
- Server never sees plaintext files or OTPs
- Keys derived from cryptographically secure random
- Constant-time OTP comparison prevents timing attacks
- Rate limiting prevents brute force attacks

### ⚠️ Important Notes

- Use HTTPS in production
- Configure proper CORS origins
- Set strong email passwords
- Monitor server logs for abuse
- Regularly update dependencies

## License

MIT License - See LICENSE file

## Support

For issues and questions:

1. Check troubleshooting section above
2. Review server logs for errors
3. Verify environment configuration
4. Test with different browsers/devices

---

**🔐 Zero-knowledge security: Your files are encrypted before they leave your browser.**
