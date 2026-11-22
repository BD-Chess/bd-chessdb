import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunFile } from '../public/8zTSP/run-export.mjs';

test('download/share serializer retains all metadata and the complete one-based tour', async () => {
  const record = { schema: '8ztsp-web-run-v1', name: 'Finska · Švica', tour: [99], tourLength: 44, workers: 8,
    passPlan: { totalSeconds: 3600, firstBudgetSeconds: 300, secondBudgetSeconds: 3300 },
    passEvents: [{pass: 2, solverSeconds: 301.25, pageSeconds: 303.5}], inputSha256: 'fixture' };
  const file = createRunFile(record, new Uint32Array([0, 1, 2, 3, 4]));
  assert(file instanceof File); assert.equal(file.name, '8ztsp-run.json'); assert.equal(file.type, 'application/json');
  const result = JSON.parse(await file.text());
  assert.deepEqual(result, { ...record, tour: [1, 2, 3, 4, 5] });
  assert.deepEqual(record.tour, [99]);
});
test('chunk boundaries do not truncate or duplicate large tour exports', async () => {
  const tour = Uint32Array.from({length: 131075}, (_, i) => i);
  const result = JSON.parse(await createRunFile({cities: tour.length, tourLength: 10000000000}, tour).text());
  assert.equal(result.tour.length, tour.length);
  for (let i = 0; i < tour.length; i++) assert.equal(result.tour[i], i + 1);
  assert.equal(result.tourLength, 10000000000);
});
test('an absent result cannot be exported', () => {
  assert.throws(() => createRunFile(null, new Uint32Array([0])));
  assert.throws(() => createRunFile({}, new Uint32Array()));
});
