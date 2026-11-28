import test from "node:test";
import assert from "node:assert/strict";
import {nearestObject} from "../src/game/state.js";
const door={id:"door",x:1646,y:580,w:172,h:440,interactionRange:280,approachFrom:"below",approachPadding:120};
const player=(x,y)=>({x,y,displayWidth:79,displayHeight:200});
test("door interaction opens from below, not above or beside",()=>{
 assert.equal(nearestObject(player(1646,930),[door],200),door);
 assert.equal(nearestObject(player(1646,250),[door],200),null);
 assert.equal(nearestObject(player(1500,580),[door],200),null);
 assert.equal(nearestObject(player(1300,930),[door],200),null);
});
test("small items on furniture are reachable from below furniture",()=>{
 const phone={id:"smartphone",x:463,y:716,w:36,h:62,approachFrom:"below",approachPadding:120};
 const note={id:"notebook",x:1254,y:696.5,w:28,h:33,approachFrom:"below",approachPadding:120};
 assert.equal(nearestObject(player(463,930),[phone],200),phone);
 assert.equal(nearestObject(player(1254,930),[note],200),note);
 assert.equal(nearestObject(player(463,500),[phone],200),null);
});
