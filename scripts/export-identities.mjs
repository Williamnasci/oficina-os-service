import pg from 'pg';
import { writeFile } from 'node:fs/promises';
const [outputPath] = process.argv.slice(2);
if (!outputPath || !process.env.SOURCE_DATABASE_URL) throw new Error('Usage: SOURCE_DATABASE_URL=... node export-identities.mjs private-snapshot.json');
const pool = new pg.Pool({ connectionString: process.env.SOURCE_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const customers = (await client.query('SELECT id,name,"documentType",document,phone,email,"isActive","createdAt","updatedAt" FROM "Customer" ORDER BY id')).rows;
  const vehicles = (await client.query('SELECT id,"customerId","licensePlate",brand,model,year,"isActive","createdAt","updatedAt" FROM "Vehicle" ORDER BY id')).rows;
  await client.query('COMMIT');
  await writeFile(outputPath, JSON.stringify({ version: 1, customers, vehicles }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ customers: customers.length, vehicles: vehicles.length }));
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
