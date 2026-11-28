import test from "node:test";
import assert from "node:assert/strict";
import {createRunData,initialGuideTarget,nearestObject,rememberOnce} from "../src/game/state.js";
test("guide points to computer only for booking and disappears only on target investigation",()=>{
 for(const scenario of [1,2,3,4]){
  const run=createRunData(scenario),id=scenario===4?"computer":"smartphone";
  assert.equal(initialGuideTarget(run),id);
  rememberOnce(run.investigatedObjects,"door");assert.equal(initialGuideTarget(run),id);
  rememberOnce(run.investigatedObjects,id);assert.equal(initialGuideTarget(run),null);
  assert.equal(initialGuideTarget(createRunData(scenario)),id);
 }
});
test("tall door is reachable at the lower edge and its extended range has a boundary",()=>{
 const door={id:"door",x:1646,y:580,w:172,h:440,interactionRange:280};
 assert.equal(nearestObject({x:1646,y:950,displayWidth:79,displayHeight:200},[door],200),door);
 assert.equal(nearestObject({x:1240.5,y:580,displayWidth:79,displayHeight:200},[door],200),door);
 assert.equal(nearestObject({x:1240.4,y:580,displayWidth:79,displayHeight:200},[door],200),null);
 assert.equal(nearestObject({x:100,y:950,displayWidth:79,displayHeight:200},[door],200),null);
});
