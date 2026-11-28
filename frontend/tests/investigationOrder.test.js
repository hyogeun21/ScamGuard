import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunData,investigationLockReason,rememberOnce,initialGuideTarget} from '../src/game/state.js';
test('scenarios 1-3 require phone before computer',()=>{
 for(const id of [1,2,3]){
  const run=createRunData(id);
  assert.ok(investigationLockReason(run,'computer'));
  assert.equal(investigationLockReason(run,'smartphone'),null);
  rememberOnce(run.investigatedObjects,'notebook');
  assert.ok(investigationLockReason(run,'computer'));
  rememberOnce(run.investigatedObjects,'smartphone');
  assert.equal(investigationLockReason(run,'computer'),null);
  assert.equal(initialGuideTarget(run),null);
 }
});
test('scenario 4 requires computer before phone and fresh games restore lock',()=>{
 const run=createRunData(4);
 assert.ok(investigationLockReason(run,'smartphone'));
 assert.equal(investigationLockReason(run,'computer'),null);
 rememberOnce(run.investigatedObjects,'door');
 assert.ok(investigationLockReason(run,'smartphone'));
 rememberOnce(run.investigatedObjects,'computer');
 assert.equal(investigationLockReason(run,'smartphone'),null);
 assert.ok(investigationLockReason(createRunData(4),'smartphone'));
});
test('notebook and door remain usable regardless of the starting investigation',()=>{
 for(const id of [1,2,3,4])for(const object of ['notebook','door'])
  assert.equal(investigationLockReason(createRunData(id),object),null);
});
