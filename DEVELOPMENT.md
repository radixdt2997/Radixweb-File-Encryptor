# Development Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│        Browser (Client-Side SPA)                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────────┐         ┌──────────────┐   │
│  │   app.js       │◄────────┤   HTML/CSS   │   │
│  │ (Orchestrator) │         │   (UI)       │   │
│  └────────┬───────┘         └──────────────┘   │
│           │                                     │
│  ┌────────▼──────────┬─────────────┬────────┐  │
│  │                   │             │        │  │
│  │  crypto/          │  ui/        │ utils/ │  │
│  │  - crypto.js      │ - dom.js    │        │  │
│  │  - key.js         │ - state.js  │        │  │
│  │  - file.js        │ - feedback.js        │  │
│  │                   │                      │  │
│  └───────────────────┴──────────────────────┘  │
│                 │                               │
│  ┌──────────────▼────────────────────────┐    │
│  │   Web Crypto API (Browser Native)     │    │
│  │   - PBKDF2, AES-GCM, getRandomValues │    │
│  └───────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
         │
         │ (Future) Encrypted blobs only
         ▼
┌─────────────────────────────────────────────────┐
│        Backend (Express Server)                 │
│   - No crypto logic                             │
│   - No password handling                        │
│   - Simple blob storage                         │
└─────────────────────────────────────────────────┘
```

## Module Responsibilities

### `client/js/crypto/` - Cryptography

- **crypto.js**: Encrypt/decrypt operations
- **key.js**: Key derivation from password
- **file.js**: Binary format (salt + IV + ciphertext)

**Rules**:

- Never imports from `ui/` or `app.js`
- Never logs sensitive data
- Always uses `crypto-config.js` for parameters
- Returns Promise-based results

### `client/js/ui/` - User Interface

- **dom.js**: DOM element references
- **state.js**: Button states and loading indicators
- **feedback.js**: Message display and timing

**Rules**:

- Never imports from `crypto/`
- Never processes sensitive data
- Handles only display and state

### `client/js/utils/` - Utilities

- **constants.js**: Centralized constants (imports from shared/)
- **validate.js**: Input validation logic
- **download.js**: File download mechanism

**Rules**:

- No sensitive data processing
- Pure utility functions
- No side effects (except download.js)

### `client/js/app.js` - Orchestration

- Single entry point
- Wires crypto, ui, and utils together
- Event handler coordination
- File reading

**Rules**:

- Imports from all modules
- No direct crypto logic
- No direct DOM manipulation (delegates to ui/)

### `shared/crypto-config.js` - Configuration

- Single source of truth for crypto parameters
- Imported by all crypto modules and constants.js
- Never modified after initial setup

## Adding New Features

### Example: Add Progress Callback to Encryption

1. **Update crypto-config.js** if needed for new parameters
2. **Modify crypto.js**:
   ```javascript
   export async function encryptFile(fileData, password, onProgress) {
     // ... existing code ...
     // Call: onProgress(bytesProcessed, totalBytes)
   }
   ```
3. **Add UI feedback in feedback.js**:
   ```javascript
   export function showProgress(percent) {
     // Update progress bar display
   }
   ```
4. **Wire in app.js**:
   ```javascript
   const encryptedBlob = await encryptFile(
     fileData,
     password,
     (bytes, total) => {
       const percent = (bytes / total) * 100;
       Feedback.showProgress(percent);
     },
   );
   ```

### Example: Add Streaming for Large Files

1. **Create crypto/stream.js**:

   ```javascript
   export async function encryptFileStream(fileBlob, password, onProgress) {
     const chunkSize = 64 * 1024; // 64KB chunks
     // Process file in chunks
     // Call onProgress() for each chunk
   }
   ```

2. **Update constants.js** for chunk size
3. **Update app.js** to use streaming for files > 50MB
4. **Test** with large files

## Security Considerations for Developers

### ✅ DO

- ✅ Validate all user inputs
- ✅ Use `crypto-config.js` for all parameters
- ✅ Handle Promise rejections
- ✅ Clear sensitive data from UI after use
- ✅ Test wrong password scenarios
- ✅ Use meaningful error messages (without sensitive details)

### ❌ DON'T

- ❌ Log passwords, keys, or decrypted content
- ❌ Use hardcoded crypto parameters
- ❌ Mix crypto and UI logic
- ❌ Modify crypto parameters without security review
- ❌ Create global variables
- ❌ Import third-party crypto libraries
- ❌ Send passwords to server
- ❌ Export cryptographic keys from browser

## Testing Guidelines

### Unit Test Examples

```javascript
// Test key derivation determinism
const password = "test1234";
const salt = new Uint8Array([1,2,3,...,16]);
const key1 = await deriveKey(password, salt);
const key2 = await deriveKey(password, salt);
assert(key1 === key2); // Same inputs = same key

// Test file format consistency
const data = new Uint8Array([1,2,3,4,5]);
const packed = packEncryptedFile(salt, iv, data);
const {salt: s, iv: i, encryptedData: d} = unpackEncryptedFile(packed);
assert(arraysEqual(s, salt));
assert(arraysEqual(i, iv));
assert(arraysEqual(d, data));

// Test validation
assert(!validatePassword("short").valid);
assert(validatePassword("validpass123").valid);
```

### Integration Test Examples

```javascript
// Full encrypt/decrypt cycle
const originalText = "Secret message";
const file = new File([originalText], "test.txt");
const password = "mypassword123";

const encrypted = await encryptFile(originalText, password);
const decrypted = await decryptFile(encrypted, password);

assert(decrypted.toString() === originalText);

// Wrong password should fail
try {
  await decryptFile(encrypted, "wrongpassword");
  assert(false, "Should have thrown");
} catch (error) {
  assert(error.message.includes("Incorrect password"));
}
```

### Manual Testing Checklist

- [ ] Encrypt text file, decrypt with correct password
- [ ] Encrypt binary file (PDF, image), verify integrity
- [ ] Wrong password shows error (not crash)
- [ ] Large file (50MB+) encrypts and decrypts correctly
- [ ] Clear button clears all inputs
- [ ] File input accepts any file type
- [ ] Password input masks characters
- [ ] Buttons disabled during processing
- [ ] Messages appear and disappear correctly
- [ ] Loading indicator animates during processing
- [ ] Downloaded files have correct names
- [ ] Can't encrypt/decrypt with empty password
- [ ] Can't encrypt/decrypt with empty file

## Code Organization Rules

### Import Order (top of file)

```javascript
// 1. Shared config first
import CRYPTO_CONFIG from "../../../shared/crypto-config.js";

// 2. Local imports from same project
import { deriveKey } from "./key.js";
import { packEncryptedFile } from "./file.js";

// 3. Never circular imports
// ✅ crypto.js imports key.js
// ❌ key.js should NOT import crypto.js
```

### Export Naming

```javascript
// ✅ Named exports for specific functions
export async function encryptFile(data, password) {}
export function generateSalt() {}

// ✅ Default export for config
export default CRYPTO_CONFIG;

// ❌ Avoid default exports for functions
// ❌ Avoid exporting internal/helper functions
```

### File Naming

```
✅ camelCase for .js files: crypto.js, keyDerivation.js
✅ kebab-case for CSS files: app.css, reset.css
✅ lowercase for directories: crypto/, ui/, utils/
✅ PascalCase for classes (if used): CryptoWorker.js
```

## Performance Optimization

### Current Performance

- Single-threaded encryption/decryption
- Files up to 100MB supported
- ~1-2 seconds per 10MB on modern devices

### Future Optimizations

1. **Web Workers** (background threads)

   ```javascript
   // Offload crypto to worker
   const worker = new Worker("js/workers/crypto-worker.js");
   worker.postMessage({ type: "encrypt", data, password });
   ```

2. **Streaming** (chunk-based processing)

   ```javascript
   // Process large files in 64KB chunks
   for (let offset = 0; offset < fileSize; offset += chunkSize) {
     const chunk = file.slice(offset, offset + chunkSize);
     // Process chunk
   }
   ```

3. **IndexedDB** (cache derived keys)
   ```javascript
   // Cache keys by (password, salt) to avoid re-derivation
   const cachedKey = await getKeyFromCache(password, salt);
   ```

## Debugging

### Browser DevTools

**Console (F12)**

```javascript
// Check modules loaded
import("js/crypto/crypto.js").then((m) => console.log(m));

// Test crypto functions directly (don't expose sensitive data)
import { generateSalt } from "js/crypto/key.js";
const salt = generateSalt();
console.log("Salt generated, length:", salt.length);

// Monitor network tab
// ✅ Should be empty (no uploads to server)
// ❌ If POST requests, check what's being sent
```

**Elements Tab**

```
Check button states:
<button disabled> = processing
<button> = ready
```

**Network Tab**

```
✅ index.html, CSS, JS files loaded
✅ No XHR/Fetch requests (no server calls)
❌ If you see POST requests, files are being sent!
```

### Common Issues & Solutions

| Issue                                    | Cause                    | Solution               |
| ---------------------------------------- | ------------------------ | ---------------------- |
| "Cannot read property 'onclick' of null" | DOM element missing      | Check id in HTML       |
| Encryption very slow                     | Large file on old device | Normal - show progress |
| Password not working                     | Case sensitivity or typo | Verify exact password  |
| File corrupted error                     | Wrong file selected      | Verify .enc file       |
| Memory full                              | Very large file          | Use streaming (future) |

## Security Audit Checklist

Before deploying:

- [ ] No console.log() of passwords
- [ ] No hardcoded encryption keys
- [ ] No localStorage usage (could leak passwords)
- [ ] No sessionStorage usage
- [ ] All crypto from Web Crypto API only
- [ ] No network requests to backend (verify Network tab)
- [ ] No unencrypted file uploads
- [ ] HTTPS enforced (if served over network)
- [ ] Content Security Policy configured
- [ ] No inline scripts (only external .js)
- [ ] No eval() or Function() constructor
- [ ] All dependencies listed in shared/crypto-config.js
- [ ] Comments explain security decisions
- [ ] Error messages don't leak system info

## Future Roadmap

### Phase 2: Backend

- [ ] Node.js + Express server
- [ ] Encrypted file storage
- [ ] Simple blob retrieval API
- [ ] No crypto on backend

### Phase 3: Enhanced Features

- [ ] File upload to server
- [ ] Web Worker encryption (parallel processing)
- [ ] Streaming for 1GB+ files
- [ ] Progress indicators
- [ ] Batch encryption

### Phase 4: Advanced Features

- [ ] Key derivation customization
- [ ] Multiple encryption algorithms
- [ ] File compression before encryption
- [ ] Integrity verification
- [ ] Key agreement for sharing

## Contributing Guidelines

1. **Respect module boundaries**
   - Crypto stays in crypto/
   - UI stays in ui/
   - Utilities stay in utils/

2. **Update crypto-config.js first**
   - Before modifying crypto parameters
   - Document why in comments

3. **Test thoroughly**
   - Wrong passwords
   - Large files
   - Various file types
   - Edge cases

4. **Security first**
   - No sensitive logging
   - Proper error handling
   - Input validation
   - Clean up sensitive data

5. **Comment your code**
   - Explain security decisions
   - Document parameters
   - Note performance considerations

---

**Remember: This is a security-sensitive application. Every change must preserve cryptographic and privacy guarantees.**
