import { randomUUID } from 'node:crypto';
import { database, accessError } from './access.mjs';
// Nanodollars (USD / 1e9). Rates verified against each provider's official model page.
// Maximum rates include long-context/cache-write/region premiums, never priority service.
export function reservation(provider, model, payload) {
 if ((provider === 'gpt' && model !== 'gpt-6-luna') || (provider === 'claude' && model !== 'claude-sonnet-5-5')) throw accessError('UNPRICED_MODEL');
 const input = Buffer.byteLength(JSON.stringify(payload), 'utf8') + 4096;
 const maxOutput = provider === 'gpt' ? payload.max_output_tokens : payload.max_tokens;
 if (!Number.isSafeInteger(maxOutput) || maxOutput < 1 || maxOutput > 2400) throw accessError('UNPRICED_MODEL');
 return Math.ceil(input * (provider === 'gpt' ? 275 : 4400) + maxOutput * (provider === 'gpt' ? 825 : 11000));
}
export function charge(provider, usage, reserved) {
 if (!usage || !Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens) || usage.input_tokens < 0 || usage.output_tokens < 0) return reserved;
 let amount;
 if (provider === 'gpt') {
  const cached = Math.max(0, usage.input_tokens_details?.cached_tokens || 0), write = Math.max(0, usage.input_tokens_details?.cache_write_tokens || 0);
  const long = usage.input_tokens > 272000;
  amount = (Math.max(0, usage.input_tokens - cached - write) * 100 + cached * 10 + write * 125) * (long ? 2 : 1) * 1.1 + usage.output_tokens * 500 * (long ? 1.5 : 1) * 1.1;
 } else {
  const created = Math.max(0, usage.cache_creation_input_tokens || 0), read = Math.max(0, usage.cache_read_input_tokens || 0);
  // Use the higher one-hour cache-write price when TTL detail is absent.
  const five = Math.min(created, Math.max(0, usage.cache_creation?.ephemeral_5m_input_tokens || 0));
  amount = (usage.input_tokens * 2000 + five * 2500 + (created - five) * 4000 + read * 100 + usage.output_tokens * 10000) * 1.1;
 }
 return Math.max(0, Math.ceil(amount));
}
export function createBudget(actor, provider, model, { rpc = database } = {}) {
 const request = randomUUID();
 return {
  async reserve(payload) {
   if (actor.role === 'owner') return null;
   const held = { id:randomUUID(), amount:reservation(provider, model, payload) };
   await rpc('reserve', { id:held.id, request_id:request, user_id:actor.id, provider, model, amount:held.amount }); return held;
  },
  async settle(held, usage, rejected = false) {
   if (!held) return;
   await rpc('settle', { id:held.id, amount:rejected ? 0 : charge(provider, usage, held.amount), unknown:!usage && !rejected });
  }
 };
}
export const usageFor = (actor, rpc = database) => actor.role === 'owner' ? Promise.resolve({ exempt:true }) : rpc('stats', { user_id:actor.id });
