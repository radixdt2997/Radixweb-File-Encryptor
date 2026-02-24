/**
 * Verify encryption at rest: key derivation and encrypt/decrypt round-trip.
 * Run with: pnpm run verify-encryption
 * Uses encryption config from server .env (ENCRYPTION_MASTER_KEY and ENCRYPTION_ENABLED).
 */

import { encryption } from '../src/config';
import {
    decryptFilePayload,
    decryptDbField,
    encryptFilePayload,
    encryptDbField,
    ENCRYPTED_HEADER_LENGTH,
} from '../src/lib/encryption';

function main() {
    if (!encryption.enabled || !encryption.masterKey) {
        console.error(
            'Set ENCRYPTION_MASTER_KEY and ENCRYPTION_ENABLED=true in server/.env to run verification.',
        );
        process.exit(1);
    }

    const filePayload = Buffer.from('client-encrypted file content');
    const dbPayload = Buffer.from('wrapped-key-binary');

    // File round-trip
    const encryptedFile = encryptFilePayload(filePayload);
    if (encryptedFile.equals(filePayload)) throw new Error('File payload should be encrypted');
    if (encryptedFile.length < ENCRYPTED_HEADER_LENGTH) throw new Error('Encrypted file too short');
    const decryptedFile = decryptFilePayload(encryptedFile);
    if (!decryptedFile.equals(filePayload)) throw new Error('File round-trip mismatch');

    // DB round-trip
    const encryptedDb = encryptDbField(dbPayload);
    if (encryptedDb.equals(dbPayload)) throw new Error('DB field should be encrypted');
    const decryptedDb = decryptDbField(encryptedDb);
    if (!decryptedDb.equals(dbPayload)) throw new Error('DB round-trip mismatch');

    console.log(
        'OK: Key derivation and encrypt/decrypt round-trip verified for file and DB helpers.',
    );
}

try {
    main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
