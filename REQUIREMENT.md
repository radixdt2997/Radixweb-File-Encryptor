# Requirements.md

## Project Name

Secure Client-Side File Encryption Web App

---

## Objective

Build a single-page web application (SPA) that allows a user to:

- Upload any file
- Encrypt the file using a password
- Download the encrypted file
- Decrypt an encrypted file only if the correct password is provided

All encryption and decryption MUST happen on the client side using native browser APIs only.

---

## Core Security Principles (Non-Negotiable)

1. No password must ever be sent to the backend
2. No decrypted file data must ever be sent to the backend
3. Encryption and decryption must use the Web Crypto API
4. No third-party libraries are allowed
5. Backend (Node.js) may only store encrypted blobs

---

## Tech Stack Constraints

### Frontend

- HTML (single page)
- CSS (no frameworks)
- JavaScript (ES Modules)
- Web Crypto API only

### Backend (Later Phase)

- Node.js (Express)
- No cryptography logic on server
- No password handling on server

---

## Application Type

- Single Page Application
- One index.html
- UI state changes without page reloads

---

## Functional Requirements

### File Encryption

- User can select a file from the local system
- User can enter a password
- System derives an encryption key from the password
- File is encrypted using AES-GCM
- Encrypted file is downloadable

### File Decryption

- User can select an encrypted file
- User enters password
- System attempts decryption
- If password is correct, original file is restored
- If password is incorrect, show error and do not crash

---

## Cryptography Requirements

### Algorithms

- Symmetric Encryption: AES-GCM
- Key Derivation: PBKDF2
- Hash: SHA-256

### Key Derivation Rules

- Use random salt (16 bytes)
- Minimum iterations: 250000
- Key length: 256 bits

### Encryption Rules

- Generate random IV (12 bytes)
- Store salt and IV with encrypted data

---

## Encrypted File Binary Format

The byte order MUST be preserved exactly:

1. Salt (16 bytes)
2. IV (12 bytes)
3. Encrypted data (remaining bytes)

---

## Project Folder Structure (Required)

secure-file-app/

- client/
  - index.html
  - css/
    - reset.css
    - base.css
    - app.css
  - js/
    - app.js
    - crypto/
      - crypto.js
      - key.js
      - file.js
    - ui/
      - dom.js
      - state.js
      - feedback.js
    - utils/
      - constants.js
      - validate.js
      - download.js
  - assets/
- server/
  - src/
    - app.js
    - routes/
    - controllers/
    - services/
- shared/
  - crypto-config.js
- README.md
- Requirements.md

---

## JavaScript Architecture Rules

1. app.js is the only entry point
2. Crypto logic must live only in js/crypto/
3. UI logic must not import crypto directly
4. No global variables
5. Use ES module imports and exports

---

## UI Requirements

- File input field
- Password input field
- Encrypt button
- Decrypt button
- Status or error message area
- Disable buttons during processing
- Clear, user-friendly error messages

---

## Validation Rules

### Password

- Minimum length: 8 characters
- Must not be empty
- Must not be trimmed or mutated

### File

- Must exist
- Must not be zero bytes

---

## Error Handling Requirements

- Wrong password must not crash the app
- Decryption failure must show a clear error message
- Catch and handle all Promise rejections
- Never log sensitive data

---

## Performance Requirements

- Must handle files up to at least 100MB
- Must avoid blocking the UI thread
- Must show a loading or processing indicator

---

## Backend Constraints (Future)

The backend must NEVER:

- Know the password
- Decrypt files
- Modify encrypted data

The backend may ONLY:

- Store encrypted blobs
- Serve encrypted blobs back to clients

---

## Memory Bank Requirement (MANDATORY)

The coding assistant MUST maintain a Memory Bank.

### The Memory Bank must store:

- Encryption algorithms and parameters
- File format structure
- Folder structure
- Naming conventions
- Security constraints
- Architectural decisions

### Purpose

- Prevent re-deciding cryptographic rules
- Ensure consistency across files
- Avoid accidental security regressions

### Rule

Every new implementation step must consult the Memory Bank before writing code.

---

## Explicit Non-Goals

- No authentication system
- No user accounts
- No database schema
- No cloud vendor lock-in
- No third-party JavaScript libraries

---

## Acceptance Criteria

- Encrypted file cannot be opened without the correct password
- Wrong password fails gracefully
- Correct password reliably decrypts the file
- No sensitive data leaves the browser
- Code follows the defined folder structure
- Cryptography code is isolated and auditable

---

## Final Instruction to Codex

You must:

- Follow this document strictly
- Ask before deviating from requirements
- Preserve all security boundaries
- Maintain and update the Memory Bank

Failure to comply with cryptography or security rules is unacceptable.
