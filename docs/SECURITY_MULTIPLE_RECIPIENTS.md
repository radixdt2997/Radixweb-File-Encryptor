# Security Best Practices: Multiple Recipients

## Core Security Principles

### 1. Cryptographic Isolation
Each recipient must be cryptographically isolated from others:

```javascript
// ❌ WRONG: Shared key wrapping
const sharedWrappedKey = await wrapKey(fileKey, sharedOTP);

// ✅ CORRECT: Individual key wrapping
for (const recipient of recipients) {
  const uniqueOTP = generateOTP();
  const wrappedKey = await wrapKey(fileKey, uniqueOTP);
  // Store per recipient
}
```

### 2. Zero-Knowledge Architecture
Server must never access plaintext data:

```javascript
// ✅ Server only handles encrypted data
const encryptedFile = clientEncryptedData;
const wrappedKeys = recipients.map(r => r.wrappedKey); // Already encrypted
const otpHashes = recipients.map(r => hashOTP(r.otp)); // Only hashes stored
```

### 3. Access Control Matrix

| Action | Sender | Recipient A | Recipient B | Server |
|--------|--------|-------------|-------------|---------|
| View file metadata | ✅ | ✅ | ✅ | ✅ |
| Access wrapped key | ❌ | ✅ (own only) | ✅ (own only) | ❌ |
| See other recipients | ✅ | ❌ | ❌ | ❌ |
| Revoke access | ✅ | ❌ | ❌ | ❌ |

## Threat Model & Mitigations

### Threat 1: Recipient Enumeration
**Risk**: Attacker discovers who has access to files

**Mitigation**:
```javascript
// Rate limiting on recipient queries
app.use('/api/files/:id/recipients', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 requests per window
}));

// Access control - only sender can list recipients
if (req.user.email !== file.sender_email) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

### Threat 2: Cross-Recipient Information Leakage
**Risk**: One recipient gains access to another's data

**Mitigation**:
```javascript
// Verify recipient owns the access attempt
const recipient = await getRecipient(fileId, recipientEmail);
if (!recipient || recipient.email !== req.body.email) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### Threat 3: OTP Brute Force Attacks
**Risk**: Attacker brute forces OTPs for multiple recipients

**Mitigation**:
```javascript
// Per-recipient attempt limits
const maxAttempts = 3;
if (recipient.otp_attempts >= maxAttempts) {
  await logSecurityEvent('otp_brute_force_detected', {
    fileId, recipientId, attempts: recipient.otp_attempts
  });
  return res.status(429).json({ error: 'Too many attempts' });
}
```

### Threat 4: Timing Attacks
**Risk**: Response timing reveals information about recipients

**Mitigation**:
```javascript
// Constant-time operations
const isValidRecipient = await crypto.timingSafeEqual(
  Buffer.from(providedEmail),
  Buffer.from(storedEmail)
);

// Consistent response times
const delay = Math.random() * 100 + 50; // 50-150ms
await new Promise(resolve => setTimeout(resolve, delay));
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

### Email Security
- [ ] Separate email channels maintained (link + OTP)
- [ ] No recipient list in email headers
- [ ] Individual email sending (no CC/BCC)
- [ ] Email delivery failure handling
- [ ] Bounce/undeliverable tracking

## Monitoring & Alerting

### Security Events to Monitor
```javascript
const securityEvents = [
  'multiple_failed_otp_attempts',
  'recipient_enumeration_attempt',
  'cross_recipient_access_attempt',
  'bulk_file_access_pattern',
  'suspicious_ip_activity'
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
  recipients: file.recipients.map(r => ({
    email: r.email, // Privacy violation
    status: r.status
  }))
});

// ✅ CORRECT: Sender-only information
if (req.user.email === file.sender_email) {
  res.json({
    recipients: file.recipients.map(r => ({
      id: r.id,
      email: r.email,
      status: r.status
    }))
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
describe('Multiple Recipients Security', () => {
  test('Recipient cannot access other recipient data', async () => {
    // Test cross-recipient access prevention
  });
  
  test('OTP brute force protection works', async () => {
    // Test attempt limiting per recipient
  });
  
  test('Timing attacks are prevented', async () => {
    // Test consistent response times
  });
});
```

### Penetration Testing Scenarios
1. Attempt to enumerate recipients through API
2. Try to access files with wrong recipient email
3. Brute force OTPs across multiple recipients
4. Test for information leakage in error messages
5. Verify proper access revocation