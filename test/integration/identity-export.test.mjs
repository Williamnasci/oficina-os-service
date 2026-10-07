import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { validateIdentitySnapshot } from '../../dist/identity-import.mjs';

test('legacy exporter reads original table contracts and refuses to replace an existing snapshot', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const directory = await mkdtemp(join(tmpdir(), 'oficina-identity-export-'));
  const snapshotPath = join(directory, 'synthetic-snapshot.json');
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS "Customer" (id text PRIMARY KEY,name text,"documentType" text,document text UNIQUE,phone text,email text,"isActive" boolean,"createdAt" timestamptz,"updatedAt" timestamptz);
      CREATE TABLE IF NOT EXISTS "Vehicle" (id text PRIMARY KEY,"customerId" text,"licensePlate" text UNIQUE,brand text,model text,year integer,"isActive" boolean,"createdAt" timestamptz,"updatedAt" timestamptz);`);
    // A private, dedicated test database contains only this export fixture.
    const id = randomUUID(), vid = randomUUID();
    let document = String(Math.floor(Math.random() * 900000000) + 100000000);
    for (const factor of [10, 11]) { const remainder = [...document].reduce((sum, digit, i) => sum + Number(digit) * (factor - i), 0) * 10 % 11; document += remainder === 10 ? '0' : String(remainder); }
    const plate = [...randomUUID().replace(/-/g, '').slice(0, 3)].map(c => String.fromCharCode(65 + parseInt(c, 16))).join('') + String(Math.floor(Math.random() * 9000) + 1000);
    await pool.query('INSERT INTO "Customer" VALUES($1,$2,$3,$4,NULL,NULL,false,$5,$5)', [id, 'Original export', 'CPF', document, '2025-01-01T00:00:00Z']);
    await pool.query('INSERT INTO "Vehicle" VALUES($1,$2,$3,$4,$5,2020,false,$6,$6)', [vid, id, plate, 'Fiat', 'Uno', '2025-01-01T00:00:00Z']);
    const script = 'scripts/export-identities.mjs';
    const env = { ...process.env, SOURCE_DATABASE_URL: process.env.TEST_DATABASE_URL };
    const result = await promisify(execFile)(process.execPath, [script, snapshotPath], { env });
    const text = await readFile(snapshotPath, 'utf8'), data = JSON.parse(text);
    assert.equal(JSON.parse(result.stdout).customers, data.customers.length);
    const imported = validateIdentitySnapshot(data);
    assert.equal(imported.customers.find(c => c.id === id).isActive, false); assert.equal(imported.vehicles.find(v => v.id === vid).customerId, id);
    await assert.rejects(promisify(execFile)(process.execPath, [script, snapshotPath], { env }), /EEXIST/);
    assert.equal(await readFile(snapshotPath, 'utf8'), text);
    assert.equal((await pool.query('SELECT "isActive" FROM "Customer" WHERE id=$1', [id])).rows[0].isActive, false);
  } finally {
    await pool.end();
    try { await unlink(snapshotPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rmdir(directory);
  }
});
