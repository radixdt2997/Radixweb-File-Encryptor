# Security Best Practices: Multiple Recipients

## Core Security Principles

### 1. Cryptographic Isolation

Each recipient must be cryptographically isolated from others:

```javascript
// ❌ WRONG: Shared key wrapping
const sharedWrappedKey = await wrapKey(fileKey, sharedOTP);

// ✅ CORRECT: Individual key wrapping with unique OTP per recipient
for (const recipient of recipients) {
  const uniqueOTP = generateOTP(); // CRITICAL: Generate unique OTP for each recipient
  const wrappedKey = await wrapKey(fileKey, uniqueOTP);
  const otpHash = await hashOTP(uniqueOTP);

  // Store per recipient
  await createRecipient({
    email: recipient.email,
    wrappedKey,
    otpHash,
    fileId,
  });

  // Send unique OTP to this recipient only
  await sendOTPEmail(recipient.email, uniqueOTP);
}
```

**Why Unique OTPs Matter:**

- Prevents OTP sharing between recipients
- Isolates security breach to single recipient
- Enables per-recipient access revocation
- Provides individual audit trails
- Eliminates single point of failure

### 2. Zero-Knowledge Architecture

Server must never access plaintext data:

```javascript
// ✅ Server only handles encrypted data
const encryptedFile = clientEncryptedData;
const wrappedKeys = recipients.map((r) => r.wrappedKey); // Already encrypted
const otpHashes = recipients.map((r) => hashOTP(r.otp)); // Only hashes stored
```

### 3. Access Control Matrix

| Action               | Sender | Recipient A   | Recipient B   | Server |
| -------------------- | ------ | ------------- | ------------- | ------ |
| View file metadata   | ✅     | ✅            | ✅            | ✅     |
| Access wrapped key   | ❌     | ✅ (own only) | ✅ (own only) | ❌     |
| See other recipients | ✅     | ❌            | ❌            | ❌     |
| Revoke access        | ✅     | ❌            | ❌            | ❌     |

## Threat Model & Mitigations

### Threat 1: Recipient Enumeration

**Risk**: Attacker discovers who has access to files

**Mitigation**:

```javascript
// Rate limiting on recipient queries
app.use(
  "/api/files/:id/recipients",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
  }),
);

// Access control - only sender can list recipients
if (req.user.email !== file.sender_email) {
  return res.status(403).json({ error: "Forbidden" });
}
```

### Threat 2: Cross-Recipient Information Leakage

**Risk**: One recipient gains access to another's data

**Mitigation**:

```javascript
// Verify recipient owns the access attempt
const recipient = await getRecipient(fileId, recipientEmail);
if (!recipient || recipient.email !== req.body.email) {
  return res.status(403).json({ error: "Access denied" });
}
```

### Threat 3: OTP Brute Force Attacks

**Risk**: Attacker brute forces OTPs for multiple recipients

**Mitigation**:

```javascript
// Per-recipient attempt limits
const maxAttempts = 3;
if (recipient.otp_attempts >= maxAttempts) {
  await logSecurityEvent("otp_brute_force_detected", {
    fileId,
    recipientId,
    attempts: recipient.otp_attempts,
  });
  return res.status(429).json({ error: "Too many attempts" });
}
```

### Threat 4: Timing Attacks

**Risk**: Response timing reveals information about recipients

**Mitigation**:

```javascript
// Constant-time operations
const isValidRecipient = await crypto.timingSafeEqual(
  Buffer.from(providedEmail),
  Buffer.from(storedEmail),
);

// Consistent response times
const delay = Math.random() * 100 + 50; // 50-150ms
await new Promise((resolve) => setTimeout(resolve, delay));
```

### Threat 5: Unauthorized Domain Access

**Risk**: External users gain access to internal file sharing system

**Mitigation**:

```javascript
// Frontend validation
function isValidRadixEmail(email) {
  return email.endsWith("@radixweb.com");
}

if (!isValidRadixEmail(recipientEmail)) {
  showError("Only @radixweb.com emails are allowed");
  return;
}

// Backend validation (CRITICAL - never trust client)
function validateRadixEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@radixweb\.com$/;
  return emailRegex.test(email);
}

app.post("/api/upload", (req, res) => {
  const { recipientEmails } = req.body;

  // Validate all recipient emails
  const invalidEmails = recipientEmails.filter(
    (email) => !validateRadixEmail(email),
  );

  if (invalidEmails.length > 0) {
    return res.status(400).json({
      error: "Invalid email domain",
      message: "Only @radixweb.com emails are allowed",
      invalidEmails,
    });
  }

  // Continue with upload...
});
```

## Implementation Security Checklist

### Database Security

- [ ] Foreign key constraints prevent orphaned recipients
- [ ] Indexes on sensitive fields (email, file_id) for performance
- [ ] No plaintext OTPs stored anywhere
- [ ] Audit logs for all recipient operations
- [ ] Proper data encryption at rest

### API Security

- [ ] Input validation on all recipient endpoints
- [ ] Rate limiting per IP and per user
- [ ] CORS properly configured for recipient operations
- [ ] Authentication required for sender operations
- [ ] Authorization checks for recipient access

### Cryptographic Security

- [ ] Unique salt per recipient key derivation
- [ ] Secure random OTP generation (crypto.getRandomValues)
- [ ] Proper key wrapping with authenticated encryption
- [ ] No key reuse between recipients
- [ ] Secure key deletion after use
- [ ] **Each recipient receives unique OTP (never shared)**
- [ ] **File key wrapped separately for each recipient with their unique OTP**

### Email Security

- [ ] Separate email channels maintained (link + OTP)
- [ ] No recipient list in email headers
- [ ] Individual email sending (no CC/BCC)
- [ ] Email delivery failure handling
- [ ] Bounce/undeliverable tracking
- [ ] Domain whitelist enforced (@radixweb.com only)
- [ ] Email validation on both frontend and backend

## Monitoring & Alerting

### Security Events to Monitor

```javascript
const securityEvents = [
  "multiple_failed_otp_attempts",
  "recipient_enumeration_attempt",
  "cross_recipient_access_attempt",
  "bulk_file_access_pattern",
  "suspicious_ip_activity",
];
```

### Alert Thresholds

- More than 10 failed OTP attempts across recipients in 1 hour
- Same IP accessing files for different recipients
- Unusual download patterns (time-based analysis)
- High volume of recipient queries from single source

## Privacy Considerations

### Data Minimization

- Store only necessary recipient data
- Automatic cleanup of expired recipient records
- No logging of successful OTP values
- Minimal metadata exposure

### Recipient Privacy

```javascript
// ❌ WRONG: Exposing recipient list
res.json({
  recipients: file.recipients.map((r) => ({
    email: r.email, // Privacy violation
    status: r.status,
  })),
});

// ✅ CORRECT: Sender-only information
if (req.user.email === file.sender_email) {
  res.json({
    recipients: file.recipients.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
    })),
  });
}
```

## Compliance Considerations

### GDPR Compliance

- Right to erasure: Ability to remove recipient data
- Data portability: Export recipient access logs
- Consent management: Clear opt-in for file access
- Data retention: Automatic cleanup policies

### SOC 2 Compliance

- Access logging for all recipient operations
- Encryption in transit and at rest
- Regular security assessments
- Incident response procedures

## Testing Security

### Security Test Cases

```javascript
describe("Multiple Recipients Security", () => {
  test("Recipient cannot access other recipient data", async () => {
    // Test cross-recipient access prevention
  });

  test("OTP brute force protection works", async () => {
    // Test attempt limiting per recipient
  });

  test("Timing attacks are prevented", async () => {
    // Test consistent response times
  });

  test("Only @radixweb.com emails are accepted", async () => {
    const invalidEmails = [
      "user@gmail.com",
      "test@yahoo.com",
      "admin@radixweb.org",
    ];

    for (const email of invalidEmails) {
      const response = await uploadFile({ recipientEmails: [email] });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid email domain");
    }
  });

  test("Each recipient receives unique OTP", async () => {
    const recipients = ["user1@radixweb.com", "user2@radixweb.com"];
    const { fileId } = await uploadFile({ recipientEmails: recipients });

    const recipient1 = await getRecipient(fileId, recipients[0]);
    const recipient2 = await getRecipient(fileId, recipients[1]);

    // OTP hashes must be different
    expect(recipient1.otp_hash).not.toBe(recipient2.otp_hash);

    // Wrapped keys must be different
    expect(recipient1.wrapped_key).not.toBe(recipient2.wrapped_key);
  });

  test("Recipient cannot use another recipient's OTP", async () => {
    const recipients = ["user1@radixweb.com", "user2@radixweb.com"];
    const { fileId, otps } = await uploadFile({ recipientEmails: recipients });

    // Try to verify recipient1 with recipient2's OTP
    const response = await verifyOTP(fileId, recipients[0], otps[1]);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid OTP");
  });
});
```

### Penetration Testing Scenarios

1. Attempt to enumerate recipients through API
2. Try to access files with wrong recipient email
3. Brute force OTPs across multiple recipients
4. Test for information leakage in error messages
5. Verify proper access revocation
6. Attempt to bypass domain restriction with various email formats
7. Test email validation bypass techniques (SQL injection, special characters)
8. **Attempt to use one recipient's OTP for another recipient**
9. **Verify OTP uniqueness across all recipients for same file**
10. **Test that shared OTP cannot decrypt multiple recipient keys**
