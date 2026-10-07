import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { importIdentitySnapshot } from '../dist/identity-import.mjs';

const [snapshotPath, mode] = process.argv.slice(2);
if (!snapshotPath || (mode && mode !== '--commit')) throw new Error('Usage: node scripts/import-identities.mjs snapshot.json [--commit]');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must explicitly identify the target OS database');
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
try { console.log(JSON.stringify(await importIdentitySnapshot(pool, snapshot, { commit: mode === '--commit' }))); }
finally { await pool.end(); }
