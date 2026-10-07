export type SagaStatus = 'DIAGNOSING' | 'QUOTING' | 'WAITING_APPROVAL' | 'WAITING_PAYMENT' | 'QUEUING' | 'IN_PROGRESS' | 'FINISHED' | 'DELIVERED' | 'CANCELLING_EXECUTION' | 'COMPENSATING_BILLING' | 'COMPENSATED' | 'MANUAL_INTERVENTION';
export type EventType = 'DiagnosisCompleted' | 'QuoteCreated' | 'QuoteApproved' | 'PaymentApproved' | 'ExecutionStarted' | 'ExecutionFinished' | 'OrderDelivered' | 'StepFailed' | 'QuoteRejected' | 'DeadlineExpired' | 'ExecutionCancelled' | 'BillingCompensated' | 'CompensationFailed';
export interface Event { id: string; orderId: string; type: EventType; }
export interface Command { id: string; orderId: string; target: 'billing' | 'execution'; type: string; }
export interface Saga { orderId: string; status: SagaStatus; version: number; processed: string[]; history: Array<{ eventId: string; from: SagaStatus; to: SagaStatus }>; }
export interface Transition { saga: Saga; commands: Command[]; }

export function openSaga(orderId: string): Transition {
  if (!orderId.trim()) throw new Error('Order id is required');
  return {
    saga: { orderId, status: 'DIAGNOSING', version: 0, processed: [], history: [] },
    commands: [{ id: `${orderId}:diagnosis`, orderId, target: 'execution', type: 'StartDiagnosis' }],
  };
}

/** Pure decision function. The adapter must atomically persist version, inbox and outbox. */
export function advance(current: Saga, event: Event, expectedVersion: number): Transition {
  if (event.orderId !== current.orderId || !event.id.trim()) throw new Error('Invalid event identity');
  if (current.processed.includes(event.id)) return { saga: current, commands: [] };
  if (expectedVersion !== current.version) throw new Error('Concurrent modification');
  let next: SagaStatus;
  let action: [Command['target'], string] | undefined;
  const normal: Partial<Record<SagaStatus, [EventType, SagaStatus, Command['target']?, string?]>> = {
    DIAGNOSING: ['DiagnosisCompleted', 'QUOTING', 'billing', 'CreateQuote'],
    QUOTING: ['QuoteCreated', 'WAITING_APPROVAL'],
    WAITING_APPROVAL: ['QuoteApproved', 'WAITING_PAYMENT', 'billing', 'CreateCheckout'],
    WAITING_PAYMENT: ['PaymentApproved', 'QUEUING', 'execution', 'QueueExecution'],
    QUEUING: ['ExecutionStarted', 'IN_PROGRESS'],
    IN_PROGRESS: ['ExecutionFinished', 'FINISHED'],
    FINISHED: ['OrderDelivered', 'DELIVERED'],
    CANCELLING_EXECUTION: ['ExecutionCancelled', 'COMPENSATING_BILLING', 'billing', 'CompensateBilling'],
    COMPENSATING_BILLING: ['BillingCompensated', 'COMPENSATED'],
  };
  const compensating = current.status === 'CANCELLING_EXECUTION' || current.status === 'COMPENSATING_BILLING';
  const terminal = ['COMPENSATED', 'DELIVERED', 'MANUAL_INTERVENTION'].includes(current.status);
  const failure = ['StepFailed', 'QuoteRejected', 'DeadlineExpired'].includes(event.type);
  if (event.type === 'CompensationFailed' && compensating) {
    next = 'MANUAL_INTERVENTION';
  } else if (failure && !terminal && !compensating) {
    if (event.type === 'QuoteRejected' && current.status !== 'WAITING_APPROVAL') throw new Error('Unexpected rejection');
    if (['IN_PROGRESS', 'FINISHED'].includes(current.status)) {
      // A physical repair cannot be rolled back automatically.
      next = 'MANUAL_INTERVENTION';
    } else {
      // Cancellation also fences late QueueExecution messages before requesting refund.
      next = 'CANCELLING_EXECUTION';
      action = ['execution', 'CancelExecution'];
    }
  } else {
    const rule = normal[current.status];
    if (!rule || rule[0] !== event.type) throw new Error('Unexpected event for saga state');
    next = rule[1];
    if (rule[2] && rule[3]) action = [rule[2], rule[3]];
  }
  const saga: Saga = {
    ...current, status: next, version: current.version + 1,
    processed: [...current.processed, event.id],
    history: [...current.history, { eventId: event.id, from: current.status, to: next }],
  };
  return {
    saga,
    commands: action ? [{ id: `${event.id}:${action[1]}`, orderId: current.orderId, target: action[0], type: action[1] }] : [],
  };
}
