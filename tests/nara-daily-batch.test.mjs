import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseFeatured,instanceId,instanceRecordPath,dayManifestPath} from '../scripts/nara-daily-batch.mjs';
const item=(instance,gpt,claude,closed)=>({instance,record:{closed_at:closed},log:{evaluation:{blind:true,method:'equal_weight_mean',gpt:{score:gpt,rubric:'GPT'},claude:{score:claude,rubric:'PEC-6 v2'},weights:{gpt:.5,claude:.5},combined:(gpt+claude)/2,display:Math.floor((gpt+claude)/2+.5),note:'x'}}});
test('paths and ids are deterministic',()=>{assert.equal(instanceId('2026-10-09','S2'),'NARA-D-2026-10-09:S2');assert.equal(instanceRecordPath('2026-10-09','S2'),'daily/records/2026-10-09/S2.json');assert.equal(dayManifestPath('2026-10-09'),'daily/days/2026-10-09.json')});
test('highest combined wins',()=>{assert.equal(chooseFeatured([item('S1',90,90,'2026-10-09T05:00:00Z'),item('S2',94,92,'2026-10-09T09:00:00Z')]),'S2')});
test('tie uses higher minimum score',()=>{assert.equal(chooseFeatured([item('S1',98,86,'2026-10-09T05:00:00Z'),item('S2',93,91,'2026-10-09T09:00:00Z')]),'S2')});
test('remaining tie uses earlier close',()=>{assert.equal(chooseFeatured([item('S1',92,92,'2026-10-09T05:00:00Z'),item('S2',92,92,'2026-10-09T09:00:00Z')]),'S1')});