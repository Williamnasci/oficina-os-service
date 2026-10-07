import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { openAndApprove, pay, request, waitFor } from './support/http.mjs';
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
