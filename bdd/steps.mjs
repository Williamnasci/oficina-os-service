import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { openAndApprove, openAndQuote, openZeroQuote, createStockFixture, stockAvailability, pay, request, waitFor } from './support/http.mjs';
setDefaultTimeout(60000);

Given('uma OS diagnosticada e com orçamento aprovado', async function () { this.id = await openAndApprove(); });
Given('uma OS aprovada cujo enfileiramento irá falhar', async function () { this.id = await openAndApprove(true); });
Given('o provedor confirma o pagamento da OS', async function () { this.payment = await pay(this.id); });
When('a oficina executa o reparo e entrega o veículo', async function () {
  await waitFor('execution', `/executions/${this.id}`, data => data.status === 'QUEUED');
  await request('execution', `/executions/${this.id}/start`, {});
  await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'IN_PROGRESS');
  await request('execution', `/executions/${this.id}/finish`, {});
  await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'FINISHED');
  await request('os', `/service-orders/${this.id}/deliver`, {});
});
Then('a OS fica DELIVERED e contém sete transições no histórico', async function () {
  const data = await request('os', `/service-orders/${this.id}`);
  assert.equal(data.status, 'DELIVERED'); assert.equal(data.history.length, 7);
});
When('a Saga compensa a falha na fila', async function () {
  await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'COMPENSATED');
});
Then('a execução está cancelada e o pagamento está reembolsado', async function () {
  assert.equal((await request('execution', `/executions/${this.id}`)).status, 'CANCELLED');
  assert.equal((await request('billing', `/budgets/${this.id}`)).status, 'REFUNDED');
  assert.equal((await request('simulator', `/v1/payments/${this.payment.id}`)).status, 'refunded');
});
Given('uma OS diagnosticada apenas com serviço de valor zero', async function () { this.id = await openZeroQuote(); });
When('a Saga trata a rejeição do orçamento de total zero', async function () { await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'COMPENSATED'); });
Then('a execução é cancelada sem checkout ou pagamento', async function () {
  const order = await request('os', `/service-orders/${this.id}`), budget = await request('billing', `/budgets/${this.id}`);
  assert.equal((await request('execution', `/executions/${this.id}`)).status, 'CANCELLED');
  assert.equal(budget.status, 'CANCELLED'); assert.equal(budget.checkout, undefined); assert.equal(budget.paymentId, undefined);
  assert.equal(order.checkout, undefined); assert.equal(order.paymentId, undefined); assert.equal(order.quote, undefined);
});

async function stockCase(world, { approve, fail = false }) {
  world.stockId = (await createStockFixture()).id;
  const items = [{ stockItemId: world.stockId, quantity: 2 }];
  world.id = await (approve ? openAndApprove : openAndQuote)(fail, items, 25000);
  const budget = await request('billing', `/budgets/${world.id}`);
  assert.equal(budget.stockItemsAmountCents, 10000);
  assert.equal(budget.servicesAmountCents, 15000);
  assert.equal(budget.lines.find(line => line.stockItemId === world.stockId).unitPriceCents, 5000);
  assert.deepEqual(await stockAvailability(world.stockId), { id: world.stockId, quantity: 3, reserved: 2, available: 1, isActive: true });
  if (approve) world.payment = await pay(world.id);
}
Given('uma OS paga em orçamento com duas peças reservadas', async function () { await stockCase(this, { approve: true }); });
Given('uma OS paga com peças reservadas cuja fila irá falhar', async function () { await stockCase(this, { approve: true, fail: true }); });
Given('uma OS com duas peças reservadas e orçamento aguardando aprovação', async function () { await stockCase(this, { approve: false }); });
Then('duas peças são baixadas uma única vez', async function () {
  await request('execution', `/executions/${this.id}/start`, {});
  assert.deepEqual(await stockAvailability(this.stockId), { id: this.stockId, quantity: 1, reserved: 0, available: 1, isActive: true });
  assert.equal((await request('os', `/service-orders/${this.id}`)).status, 'DELIVERED');
});
Then('a reserva de peças foi liberada sem baixa', async function () {
  assert.deepEqual(await stockAvailability(this.stockId), { id: this.stockId, quantity: 3, reserved: 0, available: 3, isActive: true });
});
When('o cliente recusa o primeiro orçamento', async function () {
  await request('billing', `/budgets/${this.id}/decision`, { decision: 'REJECTED' });
  const order = await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'DIAGNOSING' && data.quoteRevision === 1);
  assert.equal(order.previousQuotes[0].quote.amountCents, 25000);
  assert.equal((await stockAvailability(this.stockId)).reserved, 0);
  assert.equal((await request('billing', `/budgets/${this.id}`)).status, 'CANCELLED');
  this.attemptId = order.attemptId;
});
Then('a mesma OS permite aprovar um novo orçamento com a reserva refeita', async function () {
  await waitFor('execution', `/executions/${this.attemptId}`, data => data.status === 'DIAGNOSING');
  await request('execution', `/executions/${this.attemptId}/diagnosis`, { diagnosis: 'Revisão', lines: [{ serviceId: 'bdd-filter', quantity: 1, description: 'Catálogo' }], stockItems: [{ stockItemId: this.stockId, quantity: 1 }] });
  await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'WAITING_APPROVAL');
  assert.equal((await request('billing', `/budgets/${this.attemptId}`)).amountCents, 20000);
  assert.equal((await stockAvailability(this.stockId)).reserved, 1);
  await request('billing', `/budgets/${this.attemptId}/decision`, { decision: 'APPROVED' });
  await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'WAITING_PAYMENT' && data.checkout);
  await pay(this.attemptId);
  await waitFor('execution', `/executions/${this.attemptId}`, data => data.status === 'QUEUED');
  await request('execution', `/executions/${this.attemptId}/start`, {});
  await waitFor('os', `/service-orders/${this.id}`, data => data.status === 'IN_PROGRESS');
  assert.equal((await stockAvailability(this.stockId)).quantity, 2);
});
