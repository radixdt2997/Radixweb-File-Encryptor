# 🔒 Secure File App

A zero-knowledge file encryption and delivery system with passwordless sharing via OTP-based key wrapping.

## Features

✅ **Client-Side Encryption** - All encryption happens in your browser  
✅ **Passwordless Sharing** - Share files securely without passwords  
✅ **OTP-Based Security** - 6-digit codes for secure key unwrapping  
✅ **Zero-Knowledge** - Server never sees your files or keys  
✅ **Modern Stack** - React TypeScript frontend + Node.js backend  
✅ **Email Delivery** - Automatic link and OTP delivery

## Quick Start

### Frontend (React + TypeScript)

```bash
cd front-end
npm install
npm run dev
# Opens on http://localhost:5173
```

### Backend (Node.js + Express)

```bash
cd server
npm install
cp .env.sample .env
# Edit .env with your email credentials
npm start
# Runs on http://localhost:3000
```

## How It Works

### 🔐 Security Model

1. **File Encryption**: Files encrypted with random AES-256 keys in browser
2. **Key Wrapping**: File keys wrapped with OTP-derived keys (PBKDF2)
3. **Server Storage**: Only encrypted files and wrapped keys stored
4. **Two-Channel Delivery**: Download link and OTP sent separately
5. **Zero Knowledge**: Server cannot decrypt files without OTP

### 📤 Sending Files

1. Select file and recipient email
2. File encrypted locally with random key
3. Key wrapped with generated OTP
4. Upload encrypted file + wrapped key to server
5. Recipient gets download link + OTP via email

### 📥 Receiving Files

1. Click download link from email
2. Enter 6-digit OTP from separate email
3. Server verifies OTP and returns wrapped key
4. Browser unwraps key and downloads encrypted file
5. File decrypted locally in browser

## Usage Modes

### 🚀 Send File

- Upload and encrypt files
- Generate secure sharing links
- Automatic email delivery

### 📨 Receive File

- Access files via shared links
- Enter OTP for verification
- Download and decrypt locally

### 🔑 Legacy Mode

- Password-based encryption/decryption
- No server required
- Compatible with original format

## API Endpoints

```
POST /api/upload          # Upload encrypted file + wrapped key
POST /api/verify-otp      # Verify OTP and get wrapped key
GET  /api/download/:id    # Download encrypted file
GET  /api/metadata/:id    # Get file metadata
GET  /api/health          # Health check
```

## Configuration

### Environment Variables (.env)

```bash
# Server
PORT=3000
NODE_ENV=development

# Email (required for file sharing)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourcompany.com

# Optional
MAX_FILE_SIZE=104857600  # 100MB
BASE_URL=http://localhost:5173
```

### Email Setup

1. Enable 2FA on your Gmail account
2. Generate an App Password
3. Use App Password as EMAIL_PASS
4. Or configure SMTP settings for other providers

## Security Features

- **AES-GCM Encryption** (256-bit keys)
- **PBKDF2 Key Derivation** (250k iterations)
- **Cryptographically Secure Random** (Web Crypto API)
- **Authenticated Encryption** (tamper detection)
- **Rate Limiting** (prevents abuse)
- **CORS Protection** (cross-origin security)
- **Input Validation** (prevents injection attacks)

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

## Development

### Project Structure

```
secure-file-app/
├── front-end/          # React TypeScript SPA
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── api/        # API client
│   │   ├── utils/      # Crypto utilities
│   │   └── types/      # TypeScript types
├── server/             # Node.js Express API
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # Business logic
│   │   └── app.js      # Server entry
└── shared/             # Shared configuration
```

### Adding Features

1. Update TypeScript types in `front-end/src/types/`
2. Implement crypto logic in `front-end/src/utils/crypto.ts`
3. Create React components in `front-end/src/components/`
4. Add API endpoints in `server/src/routes/`
5. Update shared config if needed

### Testing

```bash
# Frontend
cd front-end
npm run lint
npm run build

# Backend
cd server
npm test
npm run lint
```

## Deployment

### Frontend (Static Hosting)

```bash
cd front-end
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
