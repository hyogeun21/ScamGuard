import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYER_POSES,PLAYER_SIZE,PLAYER_CROPS } from '../src/game/playerFacing.js';
import { nearestObject } from '../src/game/state.js';
const layout=JSON.parse(readFileSync(new URL('../src/game/room-layout.json',import.meta.url)));
test('replacement PNGs preserve proportions and every pose fits the collision envelope',()=>{
 for(const [key,pose] of Object.entries(PLAYER_POSES)){
  const png=readFileSync(new URL('../public/assets/'+key+'.png',import.meta.url));
  const crop=key === "player-side" ? PLAYER_CROPS.playerSide : null;
  const width=crop?.w ?? png.readUInt32BE(16),height=crop?.h ?? png.readUInt32BE(20);
  assert.ok(Math.abs(pose.w/pose.h-width/height)<0.00001);
  assert.ok(pose.w<=PLAYER_SIZE.w && pose.h<=PLAYER_SIZE.h);
 }
 assert.ok(PLAYER_POSES["player-side"].w<70);
});
test('standing below each real investigation item selects that item, including the shelf notebook',()=>{
 const objects=['smartphone','notebook','computer','door'].map(id=>{
  const a=layout.assets[id+'.png'];return{id,x:a.x+a.width/2,y:a.y+a.height/2,w:a.width,h:a.height,
    approachFrom:'below',approachPadding:60,...(id==='door'?{interactionRange:280}:{})};
 });
 for(const id of ['smartphone','notebook','computer','door']){
  const item=objects.find(o=>o.id===id);
  const player={x:item.x,y:930,displayWidth:PLAYER_SIZE.w,displayHeight:PLAYER_SIZE.h};
  assert.equal(nearestObject(player,objects,200)?.id,id);
 }
});
