# Secure File Server (Phase B)

Backend server for passwordless secure file delivery with OTP-based key wrapping.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
cd server
npm install
```

### Configuration

#### Quick Setup

1. **Copy the sample environment file:**
   ```bash
   cp env-sample.txt .env
   ```

2. **Edit the `.env` file** with your actual values:
   ```bash
   nano .env  # or your preferred editor
   ```

3. **Configure email** (required for file sharing):
   - For Gmail: Enable 2FA and create an [app password](https://support.google.com/accounts/answer/185833)
   - Set `EMAIL_USER` and `EMAIL_PASS` with your credentials

#### Laravel/PHP to Node.js Mapping

If you're migrating from a Laravel/PHP application, here's how to map your email configuration:

| Laravel (.env) | Node.js (.env) | Example Value |
|----------------|----------------|---------------|
| `MAIL_MAILER` | `EMAIL_SERVICE` | smtp |
| `MAIL_HOST` | `EMAIL_HOST` | mail.mailtest.radixweb.net |
| `MAIL_PORT` | `EMAIL_PORT` | 587 |
| `MAIL_ENCRYPTION` | `EMAIL_SECURE` | true (for TLS) |
| `MAIL_USERNAME` | `EMAIL_USER` | testphp@mailtest.radixweb.net |
| `MAIL_PASSWORD` | `EMAIL_PASS` | Radix@web#8 |
| `MAIL_FROM_ADDRESS` | `EMAIL_FROM` | testphp@mailtest.radixweb.net |

### Environment Variables

All configuration is managed through environment variables. Here's the complete reference:

```bash
# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
NODE_ENV=development          # Environment (development/production)
PORT=3000                     # Server port
HOST=localhost               # Server host
BASE_URL=http://localhost:3001 # Base URL for download links

# =============================================================================
# DATABASE & STORAGE
# =============================================================================
DB_PATH=./data/secure-files.db         # SQLite database file
STORAGE_PATH=./data/uploads            # Encrypted file storage directory
MAX_FILE_SIZE=104857600               # Max file size (100MB)
FILE_RETENTION_DAYS=30                # File cleanup after N days

# =============================================================================
# EMAIL CONFIGURATION (Required for file sharing)
# =============================================================================
EMAIL_SERVICE=smtp            # Email provider (smtp/gmail/sendgrid)
EMAIL_HOST=mail.mailtest.radixweb.net     # SMTP server hostname
EMAIL_PORT=587               # SMTP server port
EMAIL_SECURE=true            # Use TLS (true for TLS, false for plain)
EMAIL_USER=testphp@mailtest.radixweb.net     # Email account username
EMAIL_PASS=Radix@web#8        # Email password
EMAIL_FROM=testphp@mailtest.radixweb.net   # From email address

# =============================================================================
# SECURITY
# =============================================================================
CORS_ORIGIN=http://localhost:5500     # Allowed frontend origins
RATE_LIMIT_WINDOW_MS=900000  # Rate limit window (15 minutes)
RATE_LIMIT_MAX_REQUESTS=10   # Max requests per IP per window
OTP_MAX_ATTEMPTS=3          # Max OTP verification attempts
OTP_COOLDOWN_MS=5000        # Cooldown between OTP attempts (5s)

# =============================================================================
# LOGGING
# =============================================================================
LOG_LEVEL=info              # Log level (error/warn/info/debug)
AUDIT_LOG_ENABLED=true     # Enable security audit logging
```

### Start Server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3001`

## 📡 API Endpoints

### POST `/api/upload`
Upload encrypted file and wrapped key for sharing.

**Request:**
```javascript
{
  fileName: "document.pdf",
  recipientEmail: "recipient@example.com",
  otpHash: "base64-sha256-hash",
  expiryMinutes: 60,
  expiryType: "time-based",
  wrappedKey: "base64-wrapped-key",
  wrappedKeySalt: "base64-salt"
}
```

**Response:**
```javascript
{
  fileId: "uuid",
  downloadUrl: "https://example.com/?fileId=uuid",
  message: "File uploaded successfully",
  expiresAt: "2024-01-01T12:00:00Z"
}
```

### POST `/api/verify-otp`
Verify OTP and return wrapped key for decryption.

**Request:**
```javascript
{
  fileId: "uuid",
  otp: "123456"
}
```

**Response:**
```javascript
{
  wrappedKey: "base64-wrapped-key",
  wrappedKeySalt: "base64-salt",
  fileName: "document.pdf",
  fileSize: 1024000,
  verifiedAt: "2024-01-01T12:00:00Z"
}
```

### GET `/api/download/:fileId`
Download the encrypted file.

**Response:** Binary encrypted file data

### GET `/api/metadata/:fileId`
Get file metadata without authentication.

**Response:**
```javascript
{
  fileName: "document.pdf",
  fileSize: 1024000,
  expiryTime: "2024-01-01T12:00:00Z",
  expiryType: "time-based"
}
```

### GET `/api/health`
Server health check.

**Response:**
```javascript
{
  status: "healthy",
  timestamp: "2024-01-01T12:00:00Z",
  uptime: 3600,
  services: {
    database: { status: "healthy" },
    storage: { status: "healthy" }
  }
}
```

## 🔐 Security Features

- **Zero-Knowledge**: Server never sees plaintext files or OTPs
- **Timing Attack Protection**: Constant-time OTP comparison
- **Rate Limiting**: Per-IP request limits
- **Attempt Limiting**: Max 3 OTP attempts per file
- **Audit Logging**: All operations logged
- **CORS Protection**: Configured origins only
- **Helmet Security Headers**: XSS, CSRF, HSTS protection

## 🗄️ Database Schema

Uses SQLite with the following tables:

- **files**: Encrypted file metadata and wrapped keys
- **recipients**: Recipient interaction tracking
- **audit_logs**: Comprehensive operation logging
- **settings**: Application configuration

## 📧 Email Configuration

### Gmail Setup
1. Enable 2-factor authentication
2. Generate app password: https://support.google.com/accounts/answer/185833
3. Use app password in `EMAIL_PASS`

### Environment Variables
```bash
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

## 🧪 Testing

### Manual Testing
```bash
# Health check
curl http://localhost:3001/api/health

# Test email (if configured)
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Integration Testing
1. Start the server
2. Open client app in browser
3. Upload a file in "Send" mode
4. Check server logs for successful upload
5. Verify emails sent (if configured)

## 📊 Monitoring

### Health Endpoints
- `/api/health` - Overall server health

### Logs
- Console logs for all operations
- Audit logs in database for security events
- File storage statistics

### Database Queries
```sql
-- Active files
SELECT COUNT(*) FROM files WHERE status = 'active';

-- Recent uploads
SELECT * FROM files ORDER BY created_at DESC LIMIT 10;

-- Failed OTP attempts
SELECT * FROM audit_logs WHERE event_type = 'otp_failed';
```

## 🚀 Production Deployment

### Environment Setup
```bash
NODE_ENV=production
PORT=3000
DB_PATH=/var/data/secure-files.db
STORAGE_PATH=/var/uploads
EMAIL_USER=production-email@domain.com
EMAIL_PASS=production-password
CORS_ORIGIN=https://yourdomain.com
```

### Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start src/app.js --name secure-file-server
pm2 save
pm2 startup
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🛠️ Development

### Project Structure
```
server/
├── src/
│   ├── app.js              # Main Express app
│   ├── config.js           # Configuration
│   ├── routes/             # API endpoints
│   │   ├── upload.js
│   │   ├── verify-otp.js
│   │   ├── download.js
│   │   ├── metadata.js
│   │   └── health.js
│   └── services/           # Business logic
│       ├── database.js
│       ├── file-storage.js
│       └── email.js
├── data/                   # SQLite DB and uploads
├── package.json
├── .env                    # Environment config
└── README.md
```

### Adding New Features
1. Create new route in `src/routes/`
2. Add business logic in `src/services/`
3. Update database schema if needed
4. Add validation and error handling
5. Update this README

## 🐛 Troubleshooting

### Common Issues

**Email not sending:**
- Check Gmail app password
- Verify EMAIL_* environment variables
- Check server logs for SMTP errors

**Database errors:**
- Ensure data directory exists and is writable
- Check DB_PATH configuration
- Verify SQLite installation

**File upload fails:**
- Check STORAGE_PATH permissions
- Verify MAX_FILE_SIZE configuration
- Check server logs for multer errors

**CORS errors:**
- Verify CORS_ORIGIN matches client URL
- Check browser console for preflight errors

### Debug Mode
```bash
NODE_ENV=development DEBUG=* npm run dev
```

## 📝 API Documentation

Complete API documentation is available in the client-side code comments and PHASE-B-REQUIREMENTS.md.

## 🤝 Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include security considerations
4. Update tests and documentation
5. Ensure audit logging for new operations

## 📄 License

MIT License - See main project LICENSE file.
