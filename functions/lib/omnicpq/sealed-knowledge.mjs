// Private OmniCPQ knowledge envelope v1. Only encrypted blobs are stored.
// The 32-byte decryption key is a Netlify Functions secret, never a browser value.
import { createDecipheriv, createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { error } from './identity.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const validHash = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const decode64 = (s, limit) => {
  if (typeof s !== 'string' || !s.length || s.length > Math.ceil(limit / 3) * 4 + 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))
    throw error('KNOWLEDGE_INTEGRITY');
  const b = Buffer.from(s, 'base64');
  if (b.length > limit || b.toString('base64') !== s) throw error('KNOWLEDGE_INTEGRITY');
  return b;
};
export function openSealedKnowledge(envelopeText, encodedKey, expected) {
  try {
    if (typeof envelopeText !== 'string' || envelopeText.length > 12_000_000) throw Error();
    const obj = JSON.parse(envelopeText);
    if (obj.schema !== 'omnicpq.encrypted_knowledge.v1' || obj.alg !== 'AES-256-GCM' ||
      obj.release !== expected.release || obj.zipSha256 !== expected.zipSha256 ||
      !validHash(obj.rawSha256) || !validHash(obj.compressedSha256)) throw Error();
    const key = decode64(encodedKey, 32);
    const iv = decode64(obj.iv, 12), tag = decode64(obj.tag, 16);
    const ciphertext = decode64(obj.data, 8_000_000);
    if (key.length !== 32 || iv.length !== 12 || tag.length !== 16) throw Error();
    const aad = Buffer.from('omnicpq.private_knowledge.v1|' + expected.release + '|' + expected.zipSha256);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const gz = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (hash(gz) !== obj.compressedSha256) throw Error();
    const plain = gunzipSync(gz, { maxOutputLength: 32_000_000 });
    if (hash(plain) !== obj.rawSha256) throw Error();
    return plain.toString('utf8');
  } catch { throw error('KNOWLEDGE_INTEGRITY'); }
}
