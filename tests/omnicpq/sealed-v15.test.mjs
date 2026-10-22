import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createCipheriv, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { openSealedKnowledge } from '../../functions/lib/omnicpq/sealed-knowledge.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const expected = Object.freeze({ release: 'v15', zipSha256: 'f'.repeat(64) });
function fixture() {
  const text = JSON.stringify({ schema: 'test_only', message: 'knowledge fixture, no real private contents' });
  const gz = gzipSync(Buffer.from(text)), key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('omnicpq.private_knowledge.v1|v15|' + expected.zipSha256));
  const ciphertext = Buffer.concat([cipher.update(gz), cipher.final()]);
  const envelope = { schema: 'omnicpq.encrypted_knowledge.v1', release: 'v15', alg: 'AES-256-GCM',
    zipSha256: expected.zipSha256, rawSha256: hash(text), compressedSha256: hash(gz),
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') };
  return { text, envelope, key: key.toString('base64') };
}
test('v15 sealed knowledge opens only with pinned authenticated ciphertext', () => {
  const f = fixture();
  assert.equal(openSealedKnowledge(JSON.stringify(f.envelope), f.key, expected), f.text);
  for (const edit of [
    { tag: Buffer.from('0'.repeat(16)).toString('base64') },
    { release: 'v16' },
    { zipSha256: '0'.repeat(64) },
    { rawSha256: '1'.repeat(64) },
    { alg: 'AES-128-CBC' },
    { data: f.envelope.data.slice(0, -4) + 'AAAA' }
  ]) assert.throws(() => openSealedKnowledge(JSON.stringify({ ...f.envelope, ...edit }), f.key, expected), { code: 'KNOWLEDGE_INTEGRITY' });
  assert.throws(() => openSealedKnowledge(JSON.stringify(f.envelope), randomBytes(32).toString('base64'), expected), { code: 'KNOWLEDGE_INTEGRITY' });
  assert.throws(() => openSealedKnowledge(JSON.stringify(f.envelope), f.key, { ...expected, release: 'v16' }), { code: 'KNOWLEDGE_INTEGRITY' });
});
