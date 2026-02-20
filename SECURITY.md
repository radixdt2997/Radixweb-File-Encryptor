# Security Concepts Used in Secure File App

This document explains each cryptographic and security concept used in the project and why it was chosen.

---

## 1. AES-256-GCM

**What it is**

- **AES** = Advanced Encryption Standard, a symmetric block cipher (same key encrypts and decrypts).
- **256** = key size in bits (32 bytes). Strong and widely considered future-proof.
- **GCM** = Galois/Counter Mode. It’s an **AEAD** (Authenticated Encryption with Associated Data): in addition to encrypting, it produces an **authentication tag** so the receiver can verify the ciphertext (and optional extra data) wasn’t tampered with.

**Where we use it**

- **Client** (`client/src/utils/crypto.ts`): Encrypting the file with a random key, wrapping/unwrapping that key with the OTP-derived key, and password-based encrypt/decrypt (legacy).
- **Server** (`server/src/lib/encryption.ts`): Encryption at rest for file blobs on disk and for sensitive database columns (`wrapped_key`, `wrapped_key_salt`).

**Why we use it**

- Industry standard, fast, and widely supported (Web Crypto API in the browser, Node `crypto` on the server).
- **Authenticated**: Detects tampering (unlike raw AES-CBC without HMAC).
- 256-bit keys are recommended for long-term security.
- Same algorithm on client and server keeps the design consistent and easier to reason about.

---

## 2. PBKDF2 (Password-Based Key Derivation Function 2)

**What it is**

A function that turns a **weak secret** (e.g. a password or a 6-digit OTP) into a **strong encryption key**. It repeatedly applies a hash (we use SHA-256) with a **salt** and an **iteration count** so that:

- The same input + different salt → different key (no global “OTP → key” table).
- Many iterations (we use 250,000) make brute-force guessing slow.

**Where we use it**

- **Client** (`crypto.ts`): To derive a **wrapping key** from the OTP (and a random salt) when wrapping the file key, and when unwrapping it on the recipient side. Also used for legacy password-based encryption (same idea: password + salt → key).
- Always with **SHA-256** as the underlying hash and **250,000 iterations** (configurable via `VITE_PBKDF2_ITERATIONS`).

**Why we use it**

- The OTP is only 6 digits (~20 bits of entropy). PBKDF2 makes each guess expensive (250k hashes per try), so brute force is impractical.
- For passwords, the same logic applies: weak human input → strong key.
- It’s standard (NIST, etc.), built into the Web Crypto API, and 250k iterations is a common, recommended choice.

---

## 3. SHA-256

**What it is**

A **cryptographic hash function**: same input → same 256-bit output; tiny change in input → completely different output; one-way (you can’t reverse the hash to get the input).

**Where we use it**

- **Client**: `hashOTP(otp)` hashes the OTP and returns it as base64 so the server can store it without ever seeing the plain OTP.
- **Server**: When verifying the OTP, the server hashes the user-supplied OTP with SHA-256 and compares it to the stored hash (in constant time). Also used **inside HKDF** on the server for key derivation.

**Why we use it**

- The server never stores the OTP; only the hash. If the DB is leaked, an attacker cannot recover the OTP.
- Comparing hashes (in constant time) instead of the raw OTP avoids leaking the OTP and aligns with timing-safe comparison (see below).
- SHA-256 is standard, fast, and used everywhere (TLS, signing, etc.).

---

## 4. HKDF (HMAC-based Key Derivation Function)

**What it is**

A key-derivation function that takes a **master secret** and an optional **info** string and produces one or more keys. Different **info** strings yield different keys from the same secret. We use it with SHA-256 internally.

**Where we use it**

- **Server** (`server/src/lib/encryption.ts`): The **master key** (from env) is used to derive two separate 32-byte keys: one for **file storage** (info string `"file-storage-v1"`) and one for **database** fields (info string `"db-sensitive-v1"`). Both are used with AES-256-GCM.

**Why we use it**

- We only store one secret (the master key) in config; we don’t store multiple long keys.
- **Separation of keys**: File encryption and DB encryption use different keys, so compromising one doesn’t expose the other.
- Deterministic: same master key + same info → same derived key, so we can decrypt later.
- Standard (RFC 5869), and Node’s `crypto.hkdfSync` uses SHA-256 under the hood.

---

## 5. IV (Initialization Vector) / Nonce

**What it is**

A **random value** (or non-repeating value) used once per encryption. The cipher combines key + IV to produce ciphertext. **Same key + same IV** for two different messages would be a serious weakness; so we use a **new random IV** for every encryption.

**Where we use it**

- **Client**: 12-byte random IV for every AES-GCM encrypt (file, wrapped key, password mode). Stored at the start of the ciphertext (e.g. first 12 bytes) so the receiver can decrypt.
- **Server**: 12-byte random IV for every AES-GCM encrypt (file at rest, DB field). Again stored with the ciphertext (e.g. `[iv 12B][authTag 16B][ciphertext]`).

**Why we use it**

- Without an IV, the same plaintext would always produce the same ciphertext, which would leak structure and allow replay.
- 12 bytes is the standard nonce size for GCM; random IVs keep each encryption unique.

---

## 6. Constant-Time Comparison (timingSafeEqual)

**What it is**

Comparing two values (e.g. buffers) in a way that **always takes the same time**, regardless of where the first difference is. Normal string/buffer comparison often stops at the first differing byte, which can leak “how many bytes matched” through **timing side channels**.

**Where we use it**

- **Server** (`server/src/routes/verify-otp.ts`): When checking if the user’s OTP is correct, we don’t compare the raw OTP. We hash the provided OTP with SHA-256, then compare the **resulting hash** to the stored hash using `crypto.timingSafeEqual`. We also use it for the recipient email comparison in the same flow.

**Why we use it**

- Prevents **timing attacks**: an attacker who can measure response time could otherwise learn the correct OTP (or hash) byte-by-byte.
- We compare **hashes** (fixed length, no early exit), so constant-time comparison is both possible and meaningful.

---

## 7. Cryptographically Secure Random (getRandomValues / randomBytes)

**What it is**

Random number generation that is **unpredictable** and suitable for cryptographic use (keys, IVs, salts). Not the same as `Math.random()`, which is predictable and not safe for security.

**Where we use it**

- **Client**: `crypto.getRandomValues()` for IVs, salts, and key generation.
- **Server**: `crypto.randomBytes()` for IVs, unique filenames (`randomBytes(8).toString("hex")`), and `crypto.randomUUID()` for file and recipient IDs.

**Why we use it**

- Weak randomness would make IVs, salts, or keys guessable and break the security of encryption and key derivation.

---

## 8. Salt (in PBKDF2)

**What it is**

Random data mixed into key derivation so that the **same password/OTP** produces **different keys** when the salt is different. The salt is stored (e.g. with the wrapped key or ciphertext) so the same salt can be used when deriving the key again for decryption.

**Where we use it**

- **Client**: When wrapping the file key with the OTP, we generate a **random 16-byte salt** per recipient. The wrapping key is `PBKDF2(OTP, salt, 250000, SHA-256)`. The salt is sent to the server with the wrapped key so the recipient can unwrap with the same salt.
- Same idea for legacy password-based encryption: random salt per encryption.

**Why we use it**

- Same OTP for two different recipients must not yield the same wrapping key; the salt ensures that.
- Prevents **rainbow tables**: an attacker can’t precompute “OTP → key” for all 6-digit OTPs once; each salt forces new work.

---

## 9. Auth Tag (GCM)

**What it is**

In AES-GCM, the cipher outputs an extra **authentication tag** (we use 16 bytes). On decrypt, the tag is verified; if the ciphertext (or IV) was modified, the tag won’t match and decryption fails.

**Where we use it**

- **Client**: Web Crypto’s AES-GCM handles the tag internally (it’s part of the encrypted output).
- **Server**: We store the tag explicitly in the format `[iv 12B][authTag 16B][ciphertext]` and pass it to `setAuthTag()` when decrypting.

**Why we use it**

- **Integrity**: We know the data wasn’t tampered with.
- **Authenticity**: Only someone with the key could produce a valid tag. So we get both **confidentiality** and **integrity** from one primitive (AEAD).

---

## How It All Fits Together

| Layer                   | What happens                                                                                                                                                                                                            | Concepts used                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Sender (client)**     | Generate random file key → encrypt file with AES-GCM → for each recipient: OTP + salt → PBKDF2 → wrapping key → encrypt file key with AES-GCM → hash OTP with SHA-256; send encrypted file + wrapped keys + OTP hashes. | AES-256-GCM, PBKDF2, SHA-256, IV, salt, secure random |
| **Server (storage)**    | Store encrypted file; optionally encrypt again at rest with a key derived from master key (HKDF) using AES-256-GCM. Same for DB columns.                                                                                | HKDF, AES-256-GCM, IV, auth tag                       |
| **Recipient (client)**  | Get wrapped key + salt; enter OTP → PBKDF2(salt, OTP) → unwrap key with AES-GCM → decrypt file with AES-GCM.                                                                                                            | PBKDF2, AES-256-GCM, salt                             |
| **Server (verify OTP)** | Hash submitted OTP with SHA-256; compare to stored hash with `timingSafeEqual`; if match, return wrapped key (decrypted from DB if encryption at rest).                                                                 | SHA-256, constant-time comparison                     |

---

## Summary

- **AES-256-GCM**: Confidentiality and integrity for file and key encryption (client and server).
- **PBKDF2**: Turn short secrets (OTP, password) into strong keys; 250k iterations to slow brute force.
- **SHA-256**: OTP hashing for storage and verification; used inside HKDF on the server.
- **HKDF**: Derive separate file and DB keys from one master key on the server.
- **IV / salt**: Uniqueness and security of encryption and key derivation; no reuse of key+IV.
- **Constant-time comparison**: Prevent timing leaks when checking OTP (and email).
- **Secure random**: For all keys, IVs, salts, and IDs.
- **Auth tag**: Tamper detection and authenticity (built into GCM).

Together these give **zero-knowledge file sharing** (server never sees plaintext or OTP), **OTP-based access**, and optional **encryption at rest**, using standard, well-understood building blocks.
