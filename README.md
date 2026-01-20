# Secure Client-Side File Encryption Web App

A single-page web application (SPA) that allows users to encrypt and decrypt files entirely in the browser using the Web Crypto API. No passwords or decrypted data ever leave your computer.

## Features

✅ **100% Client-Side Encryption** - All encryption/decryption happens in your browser  
✅ **AES-GCM Encryption** - Military-grade symmetric encryption  
✅ **PBKDF2 Key Derivation** - Strong key derivation with 250k iterations  
✅ **No Third-Party Libraries** - Uses native Web Crypto API only  
✅ **No Backend Processing** - No passwords or files sent to server  
✅ **Large File Support** - Handles files up to 100MB+  
✅ **Cross-Platform** - Works on any modern browser

## Security

This application implements cryptographic best practices:

- **Encryption Algorithm**: AES-GCM (256-bit keys)
- **Key Derivation**: PBKDF2-SHA256 with 250,000 iterations
- **Salt**: 16-byte random salt per encryption
- **IV**: 12-byte random IV per encryption
- **Authentication**: GCM mode provides authenticated encryption (AEAD)

### Security Guarantees

- Passwords **never** leave the browser
- Decrypted files **never** leave the browser
- Encrypted files are **authenticated** and tamper-proof
- Wrong passwords **fail safely** without crashing
- No sensitive data is logged

## Project Structure

```
secure-file-app/
├── client/                 # Frontend (SPA)
│   ├── index.html         # Single HTML page
│   ├── css/
│   │   ├── reset.css      # Browser reset styles
│   │   ├── base.css       # Base typography and layout
│   │   └── app.css        # Component styles
│   ├── js/
│   │   ├── app.js         # Entry point and orchestration
│   │   ├── crypto/
│   │   │   ├── crypto.js  # AES-GCM encryption/decryption
│   │   │   ├── key.js     # PBKDF2 key derivation
│   │   │   └── file.js    # Binary format pack/unpack
│   │   ├── ui/
│   │   │   ├── dom.js     # DOM element queries
│   │   │   ├── state.js   # Button/loading state management
│   │   │   └── feedback.js# Message display and feedback
│   │   └── utils/
│   │       ├── constants.js     # Crypto parameters and messages
│   │       ├── validate.js      # Input validation
│   │       └── download.js      # File download mechanism
│   └── assets/            # Static assets (placeholder)
├── server/                # Backend (future)
│   └── src/
│       ├── app.js
│       ├── routes/
│       ├── controllers/
│       └── services/
├── shared/
│   └── crypto-config.js   # Single source of truth for crypto params
├── Requirements.md
└── README.md
```

## Technology Stack

### Frontend

- **HTML5** - Semantic markup
- **CSS3** - No frameworks, plain CSS
- **ES Modules** - Modern JavaScript with imports/exports
- **Web Crypto API** - Native browser cryptography

### Backend (Future)

- Node.js + Express
- Simple blob storage (no crypto logic)

## Usage

### Encrypting a File

1. Open `client/index.html` in your browser
2. Click "Select File" and choose any file
3. Enter a password (minimum 8 characters)
4. Click "🔒 Encrypt"
5. Your encrypted file (`filename.enc`) will download

### Decrypting a File

1. Open `client/index.html` in your browser
2. Click "Select File" and choose an encrypted file
3. Enter the **same password** used for encryption
4. Click "🔓 Decrypt"
5. Your original file will download

### Validation Rules

- **Password**: Minimum 8 characters, cannot be empty
- **File**: Must exist and have non-zero size
- **Max File Size**: Supports files up to 100MB+

## Encrypted File Format

Encrypted files have a specific binary structure:

```
[Salt: 16 bytes][IV: 12 bytes][Encrypted Data: variable]
```

- **Bytes 0-15**: Random salt for PBKDF2 derivation
- **Bytes 16-27**: Random IV for AES-GCM
- **Bytes 28+**: Encrypted file data

This format ensures:

- Each encryption is unique (random salt and IV)
- Files can be decrypted with any password tool
- Format is tamper-proof (GCM authentication)

## Cryptography Details

### Key Derivation (PBKDF2)

```
Key = PBKDF2-SHA256(
  password = user's password,
  salt = 16 random bytes,
  iterations = 250,000,
  keyLength = 256 bits
)
```

The high iteration count makes brute-force attacks computationally expensive, even for weak passwords.

### Encryption (AES-GCM)

```
Ciphertext, AuthTag = AES-GCM-Encrypt(
  key = derived key,
  iv = 12 random bytes,
  plaintext = file data
)
```

AES-GCM provides:

- **Confidentiality**: AES-256 encryption
- **Authenticity**: Authentication tag prevents tampering
- **Integrity**: Any modification is detected

## Browser Compatibility

Requires a modern browser with Web Crypto API support:

- ✅ Chrome 37+
- ✅ Firefox 34+
- ✅ Safari 11+
- ✅ Edge 79+
- ✅ Opera 24+

## Error Handling

The app handles all error cases gracefully:

- **Wrong Password**: Shows "Incorrect password?" message
- **Corrupted File**: Shows "File appears corrupted" message
- **Invalid Input**: Shows specific validation error messages
- **No Crashes**: App recovers from any error

## Performance

- **Encryption Speed**: ~10-100 MB/s (depends on device)
- **Decryption Speed**: Same as encryption
- **Memory Usage**: Minimal (streaming not yet implemented for ultra-large files)
- **UI Responsiveness**: Non-blocking with loading indicator

## Memory Bank (Crypto Constants)

The [shared/crypto-config.js](shared/crypto-config.js) file serves as the single source of truth for all cryptographic parameters:

```javascript
{
  PBKDF2: { iterations: 250000, saltLength: 16 },
  AESGCM: { keyLength: 256, ivLength: 12 },
  FILE_FORMAT: { SALT_LENGTH: 16, IV_LENGTH: 12, HEADER_SIZE: 28 }
}
```

**Every crypto module imports from this file** to prevent parameter drift and accidental security regressions.

## Architecture Principles

1. **Separation of Concerns**
   - Crypto logic isolated in `js/crypto/`
   - UI logic isolated in `js/ui/`
   - Utilities in `js/utils/`
   - No mixing of concerns

2. **ES Modules Only**
   - No global variables
   - Explicit imports and exports
   - Clean dependency graph

3. **No Third-Party Libraries**
   - Uses native Web Crypto API
   - Minimal JavaScript
   - Maximum auditability

4. **Security-First Design**
   - Passwords never logged
   - Sensitive data never exported
   - Graceful error handling
   - Continuous validation

## Development

### File Structure Rules

- All crypto logic goes in `js/crypto/` only
- All UI logic goes in `js/ui/` only
- All utilities go in `js/utils/` only
- `app.js` is the only entry point
- No global variables

### Adding New Features

1. Update `shared/crypto-config.js` if adding crypto parameters
2. Implement crypto logic in `js/crypto/` modules
3. Implement UI in `js/ui/` modules
4. Wire up in `app.js` event handlers

### Testing (Manual)

1. Encrypt a file with password "test1234"
2. Try decrypting with wrong password "wrongpass"
3. Verify error message shows
4. Decrypt with correct password
5. Verify file is restored correctly

## Future Work

- Backend API for storing encrypted blobs
- File upload and download from server
- Streaming encryption for ultra-large files
- Key agreement for file sharing
- Decryption progress indicator
- Batch encryption
- Encryption strength indicator

## License

MIT License - See LICENSE file

## Security Acknowledgments

This project implements standards from:

- NIST Special Publication 800-38D (AES-GCM)
- NIST Special Publication 800-132 (PBKDF2)
- RFC 5116 (Cryptographic Algorithm Interface)
- RFC 5869 (HMAC-based Extract-and-Expand KDF)

## Disclaimer

While this application uses industry-standard cryptography, it has not undergone formal security audit. For production use cases involving sensitive data, consider professional security review before deployment.

---

**All encryption happens in your browser. Your password is your security.**
