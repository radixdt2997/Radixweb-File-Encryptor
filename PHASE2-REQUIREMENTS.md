# Phase 2 Requirements — Passwordless Secure File Delivery

## Objective

Extend the Secure Client-Side File Encryption Web App with a
**passwordless file delivery system** using:

- Client-side encryption
- Email-based OTP verification
- One-time or time-limited secure links
- Zero-knowledge server (server can NEVER decrypt files)

The sender does NOT share a password.  
Recipients authenticate using OTP and receive the encrypted file.

---

## Core Security Model (Zero Knowledge)

1. The server MUST NOT:
   - Know encryption keys
   - Know file contents
   - Decrypt files

2. All encryption keys must be:
   - Generated in the browser
   - Wrapped (encrypted) using OTP-derived keys

3. The server stores ONLY:
   - Encrypted file blobs
   - Encrypted file keys
   - OTP hashes
   - Metadata (expiry, recipients, logs)

---

## Encryption Flow (Sender Side)

1. User selects file
2. Browser generates a random fileKey (AES-256)
3. File is encrypted using fileKey (AES-GCM)
4. fileKey is NOT stored in plaintext
5. For each recipient:
   - Generate OTP
   - Derive otpKey using PBKDF2
   - Encrypt fileKey using otpKey → wrappedKey
6. Upload to server:
   - encryptedFile
   - recipientEmail
   - wrappedKey
   - otpHash
   - expiry rules

---

## Recipient Flow

1. Recipient receives email:
   - Secure link
   - OTP
2. User opens link
3. Enters OTP
4. Server:
   - Validates OTP hash
   - Checks expiry & attempt limits
5. Browser:
   - Derives otpKey
   - Decrypts wrappedKey → fileKey
   - Downloads encrypted file
6. Browser decrypts file locally
7. Server logs event and invalidates OTP for that user

---

## OTP Rules

- 6 digit numeric
- Expiry: 5 minutes
- Max attempts: 3
- Per-recipient OTP
- OTP expires after success or failure limit

---

## Link Rules

- Sender can choose:
  - One-time
  - Time-based
  - Both
- Each recipient has independent OTP
- One recipient does NOT block others

---

## Storage Model (Server)

Stored per file:

- fileId
- encryptedFilePath
- expiryType
- expiryTime
- createdAt

Stored per recipient:

- email
- otpHash
- wrappedKey
- attempts
- used
- expiresAt

---

## Logging (Mandatory)

For each access:

- fileId
- recipientEmail
- IP address
- timestamp
- success or failure
- reason (expired, wrong OTP, max attempts)

---

## API Endpoints (Node.js)

POST /upload

- Receives encrypted file
- Stores recipients & wrapped keys

POST /verify-otp

- fileId
- recipientEmail
- otp
- Validates OTP

GET /download/:fileId

- After verification
- Sends encrypted file

---

## Email Delivery

Use SendGrid (or SES) via Nodemailer.
Each email contains:

- Secure link
- OTP
- Expiry notice

---

## Cryptographic Rules

- AES-GCM for file encryption
- PBKDF2 for OTP → key
- SHA-256 for OTP hash
- All keys generated client-side

---

## Memory Bank (Mandatory)

The Memory Bank must store:

- Zero-knowledge model
- Wrapped key design
- OTP rules
- Link expiry rules
- File encryption format
- API contracts
- Logging schema

Every implementation step MUST consult the Memory Bank.

---

## Non-Goals

- No server-side decryption
- No password recovery
- No plaintext storage
- No admin access to files

---

## Acceptance Criteria

- Server cannot decrypt files
- OTP unlocks file key
- Wrong OTP fails safely
- Logs recorded correctly
- Each recipient works independently
- Expiry rules enforced
