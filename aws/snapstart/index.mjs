import {createHash, randomUUID} from 'node:crypto';

// Same bounded work as Probe.java; no network, credentials, user data or writes.
export async function handler(event) {
  if (typeof event?.value !== 'string' || event.value.length > 1000) {
    throw new Error('value must be a string of at most 1000 UTF-16 units');
  }
  return {digest:createHash('sha256').update(event.value, 'utf8').digest('hex'),
    nonce:randomUUID(), runtime:'node22'};
}
