import { readFile } from 'node:fs/promises';
import { PostgresStore } from './infrastructure/postgres-store.mjs';
import { Broker } from './infrastructure/broker.mjs';
import { createHttp } from './infrastructure/http.mjs';
import { startWorkers } from './infrastructure/lifecycle.mjs';
import { OsService, osRoutes } from './service.mjs';
import { migrateIdentity } from './identity-schema.mjs';
import { CustomerSqlRepository, VehicleSqlRepository } from './identity-repositories.mjs';
import { IdentityRegistry, identityRoutes } from './identity.mjs';

const store = new PostgresStore(process.env.DATABASE_URL);
await store.init();
await migrateIdentity(store.pool);
const identity = new IdentityRegistry(new CustomerSqlRepository(store.pool), new VehicleSqlRepository(store.pool));
const service = new OsService(store, { identity, timeoutMs: Number(process.env.SAGA_TIMEOUT_MS ?? 86400000) });
const broker = new Broker({ url: process.env.AMQP_URL, service: 'os', store, handle: event => service.consume(event), onDisconnect: () => process.exit(1) });
await broker.init();
const spec = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
const app = await createHttp({ service: 'os', store, broker, routes: [...osRoutes(service), ...identityRoutes(identity)], spec, secret: process.env.JWT_SECRET, port: Number(process.env.PORT ?? 3000) });
const stop = startWorkers(broker, service);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true; stop(); await app.close(); await broker.close(); await store.close();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
