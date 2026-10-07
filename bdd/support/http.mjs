import { randomUUID, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET ?? 'fase4-local-only-jwt-secret-32-characters';
const token = jwt.sign({ sub: 'operator-test', role: 'operator' }, secret, { expiresIn: '10m' });
const urls = { os: 'http://localhost:18080', billing: 'http://localhost:18081', execution: 'http://localhost:18082', simulator: 'http://localhost:18083' };
export async function request(service, path, body, headers = {}) {
  const response = await fetch(`${urls[service]}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  assert.ok(response.ok, `${response.status}: ${JSON.stringify(data)}`);
  return data;
}
export async function waitFor(service, path, predicate, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const data = await request(service, path); if (predicate(data)) return data; } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out: ${service} ${path}`);
}
export async function pay(orderId) {
  const quote = await request('billing', `/budgets/${orderId}`);
  const payment = await request('simulator', '/test/payments', { externalReference: orderId, amountCents: quote.amountCents });
  const ts = String(Date.now()); const requestId = randomUUID();
  const signature = createHmac('sha256', 'local-simulator-webhook-secret').update(`id:${payment.id};request-id:${requestId};ts:${ts};`).digest('hex');
  await request('billing', `/payments/webhook?data.id=${payment.id}`, { type: 'payment', data: { id: payment.id } }, { 'x-signature': `ts=${ts},v1=${signature}`, 'x-request-id': requestId });
  return payment;
}
export async function openAndApprove(failure = false) {
  const key = randomUUID();
  const opening = { customer: { name: 'Cliente BDD', documentType: 'CPF', document: '52998224725', email: 'bdd@example.com' }, vehicle: { licensePlate: 'BDD1A23', brand: 'Fiat', model: 'Uno', year: 2020 }, services: [], stockItems: [] };
  const order = await request('os', '/service-orders/opening', opening, { 'Idempotency-Key': key });
  const duplicate = await request('os', '/service-orders/opening', opening, { 'Idempotency-Key': key });
  assert.equal(duplicate.id, order.id);
  await waitFor('execution', `/executions/${order.id}`, data => data.status === 'DIAGNOSING');
  await request('execution', `/executions/${order.id}/diagnosis`, { diagnosis: failure ? 'TEST:FAIL_QUEUE' : 'Trocar filtro', lines: [{ description: 'Filtro e mão de obra', quantity: 1, unitPriceCents: 15000 }] });
  await waitFor('os', `/service-orders/${order.id}`, data => data.status === 'WAITING_APPROVAL');
  await request('billing', `/budgets/${order.id}/decision`, { decision: 'APPROVED' });
  await waitFor('os', `/service-orders/${order.id}`, data => data.status === 'WAITING_PAYMENT' && data.checkout);
  return order.id;
}
export async function happyFlow() {
  const id = await openAndApprove();
  const payment = await pay(id);
  await waitFor('execution', `/executions/${id}`, data => data.status === 'QUEUED');
  await request('execution', `/executions/${id}/start`, {});
  await waitFor('os', `/service-orders/${id}`, data => data.status === 'IN_PROGRESS');
  await request('execution', `/executions/${id}/finish`, {});
  await waitFor('os', `/service-orders/${id}`, data => data.status === 'FINISHED');
  await request('os', `/service-orders/${id}/deliver`, {});
  const result = await request('os', `/service-orders/${id}`);
  assert.equal(result.status, 'DELIVERED'); assert.equal(result.history.length, 7);
  assert.equal((await request('simulator', `/v1/payments/${payment.id}`)).status, 'approved');
  return { orderId: id, status: result.status, history: result.history };
}
export async function compensatedFlow() {
  const id = await openAndApprove(true); const payment = await pay(id);
  const result = await waitFor('os', `/service-orders/${id}`, data => data.status === 'COMPENSATED');
  assert.equal((await request('execution', `/executions/${id}`)).status, 'CANCELLED');
  assert.equal((await request('billing', `/budgets/${id}`)).status, 'REFUNDED');
  assert.equal((await request('simulator', `/v1/payments/${payment.id}`)).status, 'refunded');
  return { orderId: id, status: result.status, history: result.history };
}
