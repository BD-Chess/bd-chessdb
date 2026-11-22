import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestSplit, alignSplit, fromFirst, fromSecond, validSplit, runPlan } from '../public/8zTSP/time-split.mjs';

test('suggestions use one twelfth with a 300-second cap and valid short parts', () => {
  for (const [total, first, second] of [['60','5','55'],['120','10','110'],['3600','300','3300'],['4500','300','4200'],['86400','300','86100'],['0.1','0.05','0.05'],['0.15','0.075','0.075'],['1','0.1','0.9']]) {
    const split = suggestSplit(total); assert.equal(split.first, first); assert.equal(split.second, second); assert(validSplit(total, first, second));
  }
});
test('either edited part derives the other and supports both requested examples', () => {
  assert.equal(fromFirst('3600','300').second, '3300');
  assert.equal(fromSecond('4500','3600').first, '900');
  assert.equal(fromFirst('4500','900').second, '3600');
});
test('decimal precision is retained without 0.1/0.2 artefacts', () => {
  assert.equal(fromFirst('0.3','0.1').second, '0.2');
  assert.equal(fromFirst('4.0000','1.2345').first, '1.2345');
  assert.equal(fromFirst('4.0000','1.2345').second, '2.7655');
  assert.equal(fromSecond('4','2.3456').first, '1.6544');
  assert.equal(fromFirst('60','1.234567890123456').second, '58.765432109876544');
  assert.equal(fromFirst('4.5e3','9e2').second, '3600');
});
test('total edits retain the manually chosen part, clamping only when required', () => {
  assert.equal(alignSplit('3600','5').first, '5');
  assert.equal(alignSplit('3600','5').second, '3595');
  assert.equal(alignSplit('0.1','900').first, '0.05');
  assert.equal(alignSplit('0.1','900').second, '0.05');
  assert.deepEqual(alignSplit('5000','3600','second'), validSplit('5000','1400','3600'));
  assert.deepEqual(alignSplit('4','2.3456','second'), validSplit('4','1.6544','2.3456'));
  assert.deepEqual(alignSplit('5.1','2.3456','second'), validSplit('5.1','2.7544','2.3456'));
  assert.deepEqual(alignSplit('0.1','3600','second'), validSplit('0.1','0.05','0.05'));
  assert.deepEqual(alignSplit('86400','0.001','second'), validSplit('86400','86399.9','0.1'));
});
test('invalid and incomplete typing is rejected instead of silently replacing the split', () => {
  for (const value of ['', '-', '1e', 'NaN', 'Infinity', '-1', '0', '4', '5', '0.001']) assert.equal(fromFirst('4',value), null, value);
  for (const total of ['', '0', '0.09', '86400.1', '1e99999']) assert.equal(suggestSplit(total),null,total);
  assert.equal(validSplit('4','1','2'),null);
  assert.equal(validSplit('4','1','3.0000000001'),null);
});
test('export and worker budgets use the selected split, including a first part above half', () => {
  const split = fromFirst('4','3'), on = runPlan(split,true), off = runPlan(split,false);
  assert.equal(on.firstBudgetSeconds,3); assert.equal(on.secondBudgetSeconds,1);
  assert.deepEqual(on.configured,{total:'4',first:'3',second:'1'});
  assert.equal(off.firstBudgetSeconds,0); assert.equal(off.secondBudgetSeconds,4);
  assert.deepEqual(off.configured,on.configured);
});
