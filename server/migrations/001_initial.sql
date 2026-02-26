-- Initial PostgreSQL schema (users, files, recipients, audit_logs)
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types (create before tables that use them)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE expiry_type_enum AS ENUM ('one-time', 'time-based');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE file_status AS ENUM ('active', 'used', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Files (uploaded_by_user_id for auth)
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  file_id UUID UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  recipient_email TEXT NOT NULL,
  wrapped_key BYTEA NOT NULL,
  wrapped_key_salt BYTEA NOT NULL,
  otp_hash TEXT NOT NULL,
  expiry_type expiry_type_enum NOT NULL,
  expiry_time TIMESTAMPTZ NOT NULL,
  status file_status NOT NULL DEFAULT 'active',
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_files_file_id ON files(file_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by_user_id ON files(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_recipient_email ON files(recipient_email);

-- Recipients
CREATE TABLE IF NOT EXISTS recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  wrapped_key BYTEA NOT NULL,
  wrapped_key_salt BYTEA NOT NULL,
  otp_verified_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipients_file_id ON recipients(file_id);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_file_id ON audit_logs(file_id);

-- Recipient audit logs
CREATE TABLE IF NOT EXISTS recipient_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipient_audit_logs_file_id ON recipient_audit_logs(file_id);
