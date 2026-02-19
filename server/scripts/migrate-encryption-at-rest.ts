/**
 * Optional migration: encrypt existing files on disk and existing DB rows (wrapped_key, wrapped_key_salt).
 * Uses encryption, storage, and database config from server .env.
 *
 * Usage: pnpm run migrate-encryption-at-rest
 *
 * Files: For each file in STORAGE_PATH, if not already in encrypted format, encrypt and overwrite.
 * DB: For each row in files and recipients, if wrapped_key/wrapped_key_salt don't have version byte 0x01, encrypt and UPDATE.
 *
 * Alternative: Leave legacy files as-is until retention deletes them; only new uploads will be encrypted.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { database, encryption, storage } from "../src/config";
import {
  encryptFilePayload,
  decryptFilePayload,
  encryptDbField,
  ENCRYPTED_HEADER_LENGTH,
} from "../src/lib/encryption";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_ENCRYPTED_VERSION = 0x01;

async function main() {
  if (!encryption.enabled || !encryption.masterKey) {
    console.error(
      "Set ENCRYPTION_MASTER_KEY and ENCRYPTION_ENABLED=true in server/.env to run migration.",
    );
    process.exit(1);
  }

  // --- Migrate files ---
  const resolvedPath = path.isAbsolute(storage.path)
    ? storage.path
    : path.join(__dirname, "..", storage.path);

  let fileCount = 0;
  try {
    const names = await fs.readdir(resolvedPath);
    for (const name of names) {
      if (name.startsWith(".")) continue;
      const filePath = path.join(resolvedPath, name);
      const raw = await fs.readFile(filePath);
      const decrypted = decryptFilePayload(raw);
      if (decrypted === raw || raw.length < ENCRYPTED_HEADER_LENGTH) {
        const encrypted = encryptFilePayload(raw);
        await fs.writeFile(filePath, encrypted);
        fileCount++;
      }
    }
  } catch (err) {
    console.error("File migration error:", err);
  }
  console.log(`Migrated ${fileCount} file(s) on disk.`);

  // --- Migrate DB (SQLite only) ---
  const resolvedDb = path.isAbsolute(database.path)
    ? database.path
    : path.join(__dirname, "..", database.path);

  let filesUpdated = 0;
  let recipientsUpdated = 0;

  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(resolvedDb);

    const fileRows = db.prepare("SELECT file_id, wrapped_key, wrapped_key_salt FROM files").all() as Array<{
      file_id: string;
      wrapped_key: Buffer;
      wrapped_key_salt: Buffer;
    }>;

    const updateFileStmt = db.prepare(
      "UPDATE files SET wrapped_key = ?, wrapped_key_salt = ? WHERE file_id = ?",
    );

    for (const row of fileRows) {
      const wk = Buffer.isBuffer(row.wrapped_key) ? row.wrapped_key : Buffer.from(row.wrapped_key);
      const wks = Buffer.isBuffer(row.wrapped_key_salt) ? row.wrapped_key_salt : Buffer.from(row.wrapped_key_salt);
      if (wk.length > 0 && wk[0] === DB_ENCRYPTED_VERSION) continue;
      const encWk = Buffer.concat([Buffer.from([DB_ENCRYPTED_VERSION]), encryptDbField(wk)]);
      const encWks = Buffer.concat([Buffer.from([DB_ENCRYPTED_VERSION]), encryptDbField(wks)]);
      updateFileStmt.run(encWk, encWks, row.file_id);
      filesUpdated++;
    }

    const recipientRows = db
      .prepare("SELECT id, file_id, wrapped_key, wrapped_key_salt FROM recipients")
      .all() as Array<{
      id: string;
      file_id: string;
      wrapped_key: Buffer;
      wrapped_key_salt: Buffer;
    }>;

    const updateRecipientStmt = db.prepare(
      "UPDATE recipients SET wrapped_key = ?, wrapped_key_salt = ? WHERE id = ? AND file_id = ?",
    );

    for (const row of recipientRows) {
      const wk = Buffer.isBuffer(row.wrapped_key) ? row.wrapped_key : Buffer.from(row.wrapped_key);
      const wks = Buffer.isBuffer(row.wrapped_key_salt) ? row.wrapped_key_salt : Buffer.from(row.wrapped_key_salt);
      if (wk.length > 0 && wk[0] === DB_ENCRYPTED_VERSION) continue;
      const encWk = Buffer.concat([Buffer.from([DB_ENCRYPTED_VERSION]), encryptDbField(wk)]);
      const encWks = Buffer.concat([Buffer.from([DB_ENCRYPTED_VERSION]), encryptDbField(wks)]);
      updateRecipientStmt.run(encWk, encWks, row.id, row.file_id);
      recipientsUpdated++;
    }

    db.close();
  } catch (err) {
    console.error("DB migration error:", err);
  }

  console.log(`Migrated ${filesUpdated} file record(s) and ${recipientsUpdated} recipient(s) in DB.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
