import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createDriveMailbox } from '../functions/lib/deepseek-chat/drive-mailbox.mjs';
import { driveFixture, inbox, results, owner } from './fixtures/deepseek-drive-mailbox.mjs';

const base = { owner, reasoning: true, prompt: 'Kaj je 17 + 25?' };
const now = () => Date.parse('2026-11-13T23:00:00.000Z');
const after = '2026-11-13T23:00:10.000Z';

function fixture(overrides) {
  const drive = driveFixture(overrides);
  return { ...drive, mailbox: createDriveMailbox({ ...drive, now }) };
}

function receipt(artifact, id, data = {}) {
  return { schema: `mydeepseekrhp.${artifact}.v1`, id, owner, createdAt: after, ...data };
}

const recordsOf = (drive, folder) => [...drive.files.values()].filter(record => record.info.parents.includes(folder));

test('requires explicit complete configuration and an exact authenticated owner before using Drive', async () => {
  for (const overrides of [
    { DEEPSEEK_CHAT_DRIVE_ENABLED: undefined },
    { DEEPSEEK_CHAT_DRIVE_REFRESH_TOKEN: undefined },
    { DEEPSEEK_CHAT_DRIVE_INBOX_ID: results },
    { DEEPSEEK_CHAT_DRIVE_PERMISSION_ID: '' },
  ]) {
    const drive = fixture(overrides);
    assert.equal(drive.mailbox, undefined);
    assert.equal(drive.calls.length, 0);
  }
  const drive = fixture();
  const account = { ...base, id: randomUUID(), owner: 'other@example.invalid' };
  assert.equal(await drive.mailbox.available(account.owner), false);
  assert.equal(await drive.mailbox.enqueue(account), null);
  assert.equal(await drive.mailbox.get(account), null);
  assert.equal(await drive.mailbox.stop(account), null);
  assert.equal(drive.calls.length, 0);

  drive.behavior.principal = 'mismatched-google-permission-id';
  await assert.rejects(drive.mailbox.available(owner), /DRIVE_MAILBOX_UNAVAILABLE/);
  assert.deepEqual(drive.calls.map(({ url }) => url.pathname), ['/token', '/drive/v3/about']);
  drive.behavior.principal = drive.getEnv('DEEPSEEK_CHAT_DRIVE_PERMISSION_ID');
  assert.equal(await drive.mailbox.available(owner), true);
});

test('uses one Drive upload ID across concurrent requests and recognizes exact replays', async () => {
  const drive = fixture();
  const id = randomUUID();
  const request = { ...base, id };
  const expected = { id, prompt: base.prompt, state: 'queued' };
  assert.deepEqual(await Promise.all([
    drive.mailbox.enqueue(request),
    drive.mailbox.enqueue(request),
    drive.mailbox.enqueue(request),
  ]), [expected, expected, expected]);
  assert.deepEqual(await drive.mailbox.get(request), expected);
  assert.equal(await drive.mailbox.enqueue({ ...request, prompt: 'nov poziv' }), null);
  assert.equal(await drive.mailbox.enqueue({ ...request, reasoning: false }), null);
  const [saved] = recordsOf(drive, inbox);
  assert.equal(recordsOf(drive, inbox).length, 1);
  assert.equal(saved.info.name, id + '.json');
  assert.deepEqual(saved.content, receipt('request', id, {
    prompt: base.prompt, reasoning: true, createdAt: new Date(now()).toISOString(),
  }));
});

test('reconciles a lost successful upload and resumes a failed pre-upload reservation without duplicates', async () => {
  const drive = fixture();
  const id = randomUUID();
  const request = { ...base, id };
  drive.behavior.rejectBeforeUpload = 1;
  await assert.rejects(drive.mailbox.enqueue(request), /DRIVE_MAILBOX_UNAVAILABLE/);
  assert.equal(recordsOf(drive, inbox).length, 0);
  assert.equal(drive.blobs.size, 1);
  assert.equal(await drive.mailbox.get(request), null);

  drive.behavior.loseAfterUpload = 1;
  assert.equal((await drive.mailbox.enqueue(request)).state, 'queued');
  assert.equal((await drive.mailbox.enqueue(request)).state, 'queued');
  const allocators = drive.calls.filter(({ url }) => url.pathname.endsWith('/generateIds'));
  assert.equal(allocators.length, 1);
  assert.equal(recordsOf(drive, inbox).length, 1);
});

test('reports ACK, STOP request and a lasting result without regressing to a pending state', async () => {
  const drive = fixture();
  const id = randomUUID();
  const request = { ...base, id };
  await drive.mailbox.enqueue(request);
  drive.add(results, id + '.ack.json', receipt('ack', id));
  assert.equal((await drive.mailbox.get(request)).state, 'acknowledged');

  drive.behavior.loseAfterUpload = 1;
  assert.equal((await drive.mailbox.stop(request)).state, 'stopping');
  assert.equal((await drive.mailbox.stop(request)).state, 'stopping');
  const stopFiles = recordsOf(drive, inbox).filter(record => record.info.name.endsWith('.stop.json'));
  assert.equal(stopFiles.length, 1);
  assert.deepEqual(stopFiles[0].content, receipt('stop', id, { createdAt: new Date(now()).toISOString() }));

  drive.add(results, id + '.result.json', receipt('result', id, { state: 'complete', reply: '42' }));
  assert.deepEqual(await drive.mailbox.get(request), { id, prompt: base.prompt, state: 'complete', reply: '42' });
  assert.equal((await drive.mailbox.stop(request)).state, 'complete');
  const restarted = createDriveMailbox({ ...drive, now });
  assert.equal((await restarted.get(request)).reply, '42');
});

test('rejects misbound, tampered, duplicate and malformed records while allowing isolated terminal outcomes', async () => {
  const drive = fixture();
  const id = randomUUID();
  const request = { ...base, id };
  await drive.mailbox.enqueue(request);
  const terminalName = id + '.result.json';
  for (const result of [
    receipt('result', id, { state: 'complete', reply: '42', owner: 'other@example.invalid' }),
    receipt('result', randomUUID(), { state: 'complete', reply: '42' }),
    receipt('result', id, { state: 'complete', reply: '' }),
    receipt('result', id, { state: 'complete', reply: 'x'.repeat(64001) }),
    receipt('result', id, { state: 'complete', reply: '42', createdAt: '2020-01-01T00:00:00Z' }),
  ]) {
    const resultId = drive.add(results, terminalName, result);
    await assert.rejects(drive.mailbox.get(request), /DRIVE_MAILBOX_UNAVAILABLE/);
    drive.files.delete(resultId);
  }
  const orphan = randomUUID();
  drive.add(results, orphan + '.result.json', receipt('result', orphan, { state: 'complete', reply: '42' }));
  assert.equal(await drive.mailbox.get({ owner, id: orphan }), null);
  for (const state of ['failed', 'stopped', 'uncertain']) {
    const fileId = drive.add(results, terminalName, receipt('result', id, { state, reply: 'private worker detail' }));
    assert.deepEqual(await drive.mailbox.get(request), { id, prompt: base.prompt, state });
    drive.files.delete(fileId);
  }
  drive.add(results, terminalName, receipt('result', id, { state: 'complete', reply: '42' }));
  drive.add(results, terminalName, receipt('result', id, { state: 'complete', reply: 'different' }));
  await assert.rejects(drive.mailbox.get(request), /DRIVE_MAILBOX_UNAVAILABLE/);
  for (const [fileId, item] of drive.files) if (item.info.parents.includes(results)) drive.files.delete(fileId);
  recordsOf(drive, inbox)[0].content.prompt = 'Spremenjeno';
  await assert.rejects(drive.mailbox.get(request), /DRIVE_MAILBOX_UNAVAILABLE/);
});
