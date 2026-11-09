import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { normalizeDocument } from './customer.ts';
import { NotFoundError } from './infrastructure/contracts.mjs';

const hash = value => createHash('sha256').update(value).digest();
export function authLookupRoutes(identity, token) {
  if (!token) return [];
  if (token.length < 32) throw new Error('OS_AUTH_LOOKUP_TOKEN must contain at least 32 characters');
  const expected = hash(token);
  return [{ method: 'post', path: '/internal/auth/customers/lookup', public: true, handle: async req => {
    const presented = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!presented || !timingSafeEqual(expected, hash(presented))) throw Object.assign(new Error('Authentication required'), { status: 401 });
    const { document } = z.object({ document: z.string().max(30) }).strict().parse(req.body);
    const normalized = normalizeDocument(document, 'CPF');
    const customer = await identity.customers.findByDocument(normalized);
    if (!customer || customer.document.type !== 'CPF') throw new NotFoundError('Customer not found.');
    return { id: customer.id, document: customer.document.value, documentType: 'CPF', isActive: customer.isActive };
  } }];
}
