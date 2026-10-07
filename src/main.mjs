import { readFile } from 'node:fs/promises';
import { PostgresStore } from './infrastructure/postgres-store.mjs';
import { Broker } from './infrastructure/broker.mjs';
import { createHttp } from './infrastructure/http.mjs';
import { startWorkers } from './infrastructure/lifecycle.mjs';
import { OsService, osRoutes } from './service.mjs';

const store = new PostgresStore(process.env.DATABASE_URL);
await store.init();
await store.pool.query('CREATE TABLE IF NOT EXISTS customers(id text PRIMARY KEY, document text UNIQUE NOT NULL, data jsonb NOT NULL); CREATE TABLE IF NOT EXISTS vehicles(plate text PRIMARY KEY, customer_id text NOT NULL REFERENCES customers(id), data jsonb NOT NULL);');
const service = new OsService(store, { timeoutMs: Number(process.env.SAGA_TIMEOUT_MS ?? 86400000) });
const broker = new Broker({ url: process.env.AMQP_URL, service: 'os', store, handle: event => service.consume(event), onDisconnect: () => process.exit(1) });
await broker.init();
const spec = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
const app = await createHttp({ service: 'os', store, broker, routes: osRoutes(service), spec, secret: process.env.JWT_SECRET, port: Number(process.env.PORT ?? 3000) });
const stop = startWorkers(broker, service);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true; stop(); await app.close(); await broker.close(); await store.close();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
