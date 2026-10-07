export async function migrateIdentity(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('identity-schema',0))");
    await client.query(`CREATE TABLE IF NOT EXISTS customers(id text PRIMARY KEY, document text UNIQUE NOT NULL, data jsonb NOT NULL);
      CREATE TABLE IF NOT EXISTS vehicles(plate text PRIMARY KEY, customer_id text NOT NULL REFERENCES customers(id), data jsonb NOT NULL);
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS id text;
      UPDATE vehicles SET id=COALESCE(data->>'id',md5(plate)::uuid::text) WHERE id IS NULL;
      ALTER TABLE vehicles ALTER COLUMN id SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS vehicles_identity_id ON vehicles(id);
      UPDATE customers SET data=jsonb_build_object('id',id,'isActive',true,'createdAt',now(),'updatedAt',now()) || data;
      UPDATE vehicles SET data=jsonb_build_object('id',id,'customerId',customer_id,'isActive',true,'createdAt',now(),'updatedAt',now()) || data;`);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
