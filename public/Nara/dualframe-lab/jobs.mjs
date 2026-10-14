import { sha256 } from './core.mjs?v=3.0-r1';

// Network retries and reloads reuse the persisted key. Only an explicit
// Regenerate action supplies a fresh attempt ID; the server still enforces caps.
export async function jobIdempotencyKey(parameters, attemptId = null) {
  const request = {...parameters, upload_consent: parameters.upload_consent?.external === true};
  if (attemptId !== null) request.generation_attempt_id = attemptId;
  return sha256(JSON.stringify(request));
}

export function gatewayStateAction(status) {
  if (status === 'READY' || status === 'ACCEPTED') return 'result';
  if (['FAILED', 'CANCELLED', 'HELD'].includes(status)) return 'terminal';
  if (status === 'PENDING' || status === 'RUNNING') return 'poll';
  throw Error('INVALID_GATEWAY_STATE');
}

export function liveModelAvailable(capabilities, modelKey, quality = 'hd') {
  const model = capabilities?.models?.find(item => (item.key || item.model_key || item.model) === modelKey);
  return Boolean((model?.live_enabled === true || model?.available === true) && model?.quality_gates?.[quality] !== false);
}
