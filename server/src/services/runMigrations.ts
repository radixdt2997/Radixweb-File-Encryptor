/**
 * Run PostgreSQL migrations from server/migrations/*.sql
 * Migrations run in filename order (001_initial.sql, 002_..., etc.)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { database as dbConfig } from '../config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

export async function runMigrations(): Promise<void> {
    if (!dbConfig.databaseUrl?.trim()) {
        throw new Error('DATABASE_URL is required to run migrations');
    }
    const pool = new Pool({ connectionString: dbConfig.databaseUrl });
    const client = await pool.connect();

    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

        const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
        files.sort();

        for (const file of files) {
            const name = file;
            const result = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [
                name,
            ]);
            if (result.rowCount && result.rowCount > 0) {
                continue; // already run
            }

            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
            console.log(`✅ Migration run: ${name}`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}
