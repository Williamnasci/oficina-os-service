// Explicit test double. It is never enabled by the production profile.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
const payments = new Map();
const refunds = new Map();
createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const url = new URL(req.url, 'http://localhost');
    let result;
    if (url.pathname === '/health') result = { status: 'simulator' };
    else if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
      const id = randomUUID(); result = { id, sandbox_init_point: `http://localhost:18083/test/checkout/${id}` };
    } else if (req.method === 'POST' && url.pathname === '/test/payments') {
      const id = randomUUID();
      result = { id, external_reference: body.externalReference, transaction_amount: body.amountCents / 100, currency_id: 'BRL', collector_id: 12345, live_mode: false, status: body.status ?? 'approved' };
      payments.set(id, result);
    } else {
      const id = url.pathname.split('/')[3]; const payment = payments.get(id);
      if (!payment) { res.statusCode = 404; result = { message: 'Payment not found' }; }
      else if (req.method === 'POST' && url.pathname.endsWith('/refunds')) {
        const key = req.headers['x-idempotency-key'];
        if (!key) throw new Error('Missing refund idempotency key');
        result = refunds.get(key) ?? { id: randomUUID(), payment_id: id, status: 'approved' };
        refunds.set(key, result); payment.status = 'refunded';
      } else result = payment;
    }
    res.end(JSON.stringify(result));
  } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ message: error.message })); }
}).listen(3000, '0.0.0.0');
