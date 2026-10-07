import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSaga, advance } from '../dist/saga.js';

function step(saga, type, id = type) {
  return advance(saga, { id, orderId: saga.orderId, type }, saga.version);
}
function at(types) {
  let { saga } = openSaga('os-1');
  for (const type of types) saga = step(saga, type).saga;
  return saga;
}
const happy = ['DiagnosisCompleted', 'QuoteCreated', 'QuoteApproved', 'PaymentApproved', 'ExecutionStarted', 'ExecutionFinished', 'OrderDelivered'];

test('successful saga emits commands only when each prerequisite is confirmed', () => {
  let { saga, commands } = openSaga('os-1');
  assert.equal(commands[0].type, 'StartDiagnosis');
  const emitted = [];
  for (const type of happy) {
    const result = step(saga, type);
    saga = result.saga;
    emitted.push(...result.commands.map(c => c.type));
  }
  assert.equal(saga.status, 'DELIVERED');
  assert.equal(saga.history.length, 7);
  assert.deepEqual(emitted, ['CreateQuote', 'CreateCheckout', 'QueueExecution']);
});
test('duplicates do not dispatch again, including retry after version changed', () => {
  const saga = at(['DiagnosisCompleted']);
  assert.deepEqual(advance(saga, { id: 'DiagnosisCompleted', orderId: 'os-1', type: 'DiagnosisCompleted' }, 0), { saga, commands: [] });
});
test('foreign orders, blank identities, stale versions and out of order payment fail', () => {
  const { saga } = openSaga('os-1');
  assert.throws(() => openSaga(' '));
  assert.throws(() => advance(saga, { id: 'x', orderId: 'other', type: 'DiagnosisCompleted' }, 0));
  assert.throws(() => step(saga, 'DiagnosisCompleted', ' '));
  assert.throws(() => advance(saga, { id: 'x', orderId: 'os-1', type: 'DiagnosisCompleted' }, 1));
  assert.throws(() => step(saga, 'PaymentApproved'));
});
test('failure at every pre-repair stage cancels execution before compensating billing', () => {
  for (let index = 0; index <= 4; index++) {
    const saga = at(happy.slice(0, index));
    const failed = step(saga, 'StepFailed');
    assert.equal(failed.saga.status, 'CANCELLING_EXECUTION');
    assert.equal(failed.commands[0].type, 'CancelExecution');
    const cancelled = step(failed.saga, 'ExecutionCancelled');
    assert.equal(cancelled.commands[0].type, 'CompensateBilling');
    assert.equal(step(cancelled.saga, 'BillingCompensated').saga.status, 'COMPENSATED');
    assert.throws(() => step(failed.saga, 'BillingCompensated'));
  }
});
test('rejection and deadlines initiate compensation; unexpected rejection is rejected', () => {
  assert.equal(step(at(happy.slice(0, 2)), 'QuoteRejected').saga.status, 'CANCELLING_EXECUTION');
  assert.equal(step(at(happy.slice(0, 3)), 'DeadlineExpired').saga.status, 'CANCELLING_EXECUTION');
  assert.throws(() => step(at([]), 'QuoteRejected'));
});
test('compensation failure and physical repair failure require intervention', () => {
  const cancelled = step(at([]), 'StepFailed').saga;
  assert.equal(step(cancelled, 'CompensationFailed').saga.status, 'MANUAL_INTERVENTION');
  const billing = step(cancelled, 'ExecutionCancelled').saga;
  assert.equal(step(billing, 'CompensationFailed').saga.status, 'MANUAL_INTERVENTION');
  for (const length of [5, 6]) assert.equal(step(at(happy.slice(0, length)), 'StepFailed').saga.status, 'MANUAL_INTERVENTION');
  for (const saga of [at(happy), step(billing, 'BillingCompensated').saga]) assert.throws(() => step(saga, 'StepFailed', 'another-failure'));
  assert.throws(() => step(cancelled, 'StepFailed', 'another-failure'));
});
