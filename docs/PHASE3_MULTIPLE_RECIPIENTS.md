# Phase 3: Multiple Recipients Support

## Overview

Extend the secure file delivery system to support multiple recipients with individual OTPs while maintaining zero-knowledge security principles.

## Current Limitations

- Single recipient per file upload
- One OTP per file
- No recipient management
- No access control per recipient

## Proposed Architecture

### Database Schema Changes

#### New `recipients` Table

```sql
CREATE TABLE recipients (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,           -- Individual OTP hash per recipient
  wrapped_key TEXT NOT NULL,        -- File key wrapped with recipient's OTP
  wrapped_key_salt TEXT NOT NULL,   -- Salt for recipient's key derivation
  otp_verified_at DATETIME,
  downloaded_at DATETIME,
  otp_attempts INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Modified `files` Table

```sql
-- Remove single recipient fields:
-- recipient_email (moved to recipients table)
-- otp_hash (moved to recipients table)
-- wrapped_key (moved to recipients table)
-- wrapped_key_salt (moved to recipients table)

-- Add new fields:
ALTER TABLE files ADD COLUMN total_recipients INTEGER DEFAULT 1;
ALTER TABLE files ADD COLUMN verified_recipients INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN downloaded_recipients INTEGER DEFAULT 0;
```

### API Changes

#### Upload Endpoint

```typescript
POST /api/upload
{
  fileName: string;
  recipientEmails: string[];  // Array instead of single email
  expiryMinutes: number;
  expiryType: 'one-time' | 'time-based';
  // File data remains the same
}
```

#### New Recipient Management

```typescript
GET /api/files/:fileId/recipients     // List recipients (sender only)
DELETE /api/files/:fileId/recipients/:recipientId  // Revoke access
```

### Security Model

#### Individual OTP Generation

- Each recipient gets unique 6-digit OTP
- File encryption key wrapped separately for each recipient
- No shared secrets between recipients

#### Access Control

- Each recipient can only access their own wrapped key
- OTP verification tied to specific recipient
- Independent download tracking per recipient

#### Audit Trail

```sql
CREATE TABLE recipient_audit_logs (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'otp_sent', 'otp_verified', 'downloaded', 'revoked'
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Plan

### Phase 3.1: Database Migration

- [x] Create recipients table
- [x] Migrate existing single-recipient data
- [x] Update database service functions
- [x] Add recipient-specific queries

### Phase 3.2: Backend API Updates

- [x] Modify upload endpoint for multiple emails
- [x] Update OTP verification for recipient-specific validation
- [x] Add recipient management endpoints
- [x] Implement per-recipient audit logging

### Phase 3.3: Crypto Layer Updates

- [x] Generate unique OTP per recipient
- [x] Wrap file key individually for each recipient
- [x] Update unwrap logic for recipient-specific keys

### Phase 3.4: Email Service Updates

- [x] Batch email sending for multiple recipients
- [x] Recipient-specific email templates
- [x] Individual OTP delivery tracking

### Phase 3.5: Frontend Updates

- [x] Multiple email input UI
- [x] Recipient management interface
- [x] Per-recipient status tracking

## Security Considerations

### Zero-Knowledge Principles

- Server never sees plaintext file or OTPs
- Each recipient's access is cryptographically isolated
- File key wrapped independently per recipient

### Attack Mitigation

- **Recipient Enumeration**: Rate limit recipient queries
- **OTP Brute Force**: Individual attempt limits per recipient
- **Access Revocation**: Immediate key invalidation
- **Audit Logging**: Complete recipient activity tracking

### Privacy Protection

- Recipients cannot see other recipients
- Individual access patterns isolated
- No cross-recipient information leakage

## Backward Compatibility

- Existing single-recipient files continue to work
- Migration script for legacy data
- API versioning for gradual transition

## Performance Considerations

- Batch operations for multiple recipients
- Efficient database queries with proper indexing
- Async email sending to prevent blocking
- Pagination for large recipient lists

## Testing Strategy

- Unit tests for multi-recipient crypto operations
- Integration tests for email delivery
- Security tests for access isolation
- Performance tests for large recipient counts

## Deployment Plan

1. Database migration (backward compatible)
2. Backend API deployment with feature flags
3. Frontend updates with progressive enhancement
4. Gradual rollout with monitoring
5. Legacy cleanup after validation

## Success Metrics

- Support for 1-100 recipients per file
- Maintained security isolation between recipients
- Zero performance degradation for single recipients
- Complete audit trail for all recipient actions
