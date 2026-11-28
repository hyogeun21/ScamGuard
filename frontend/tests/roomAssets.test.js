import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerFacing,PLAYER_SIZE} from '../src/game/playerFacing.js';
import {moveWithCollisions,isSafePosition,safeSpawn} from '../src/game/collision.js';
const layout=JSON.parse(readFileSync(new URL('../src/game/room-layout.json',import.meta.url)));
test('WASD texture and side flip follow requested mapping',()=>{
 assert.equal(playerFacing(0,1).key,'player');
 assert.ok(Math.abs(playerFacing(0,1).width-81.83864)<1e-8);
 assert.equal(playerFacing(0,1).height,143);
 assert.equal(playerFacing(0,-1).key,'playerBack');
 assert.equal(playerFacing(1,0).flipX,false);
 assert.equal(playerFacing(-1,0).flipX,true);
 assert.equal(playerFacing(0,0),null);
});
test('full character stays in play area and avoids furniture on long movement paths',()=>{
 const r=layout.room,bounds={x:r.x,y:r.y,w:r.width,h:r.height},size={w:PLAYER_SIZE.w,h:PLAYER_SIZE.h};
 const solid=['bed','bookshelf','computer','door','notebook','smartphone'].map(id=>{
 const r=layout.assets[id+'.png'];return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};});
 let p=safeSpawn({x:524.5,y:930},size,bounds,solid);
 assert.deepEqual(p,{x:524.5,y:930});
 for(let i=0;i<1500;i++){
  p=moveWithCollisions(p,{x:Math.sin(i*7)*700,y:Math.cos(i*11)*700},size,bounds,solid);
  assert.ok(isSafePosition(p,size,bounds,solid));
 }
});

test('side pose can move vertically through the 70px furniture corridor',()=>{
 const r=layout.room,bounds={x:r.x,y:r.y,w:r.width,h:r.height};
 const solids=['bed','bookshelf','computer','door','notebook','smartphone'].map(id=>{
  const a=layout.assets[id+'.png'];return{x:a.x+a.width/2,y:a.y+a.height/2,w:a.width,h:a.height};
 });
 const side=playerFacing(1,0);
 const size={w:side.width,h:side.height};
 const p=moveWithCollisions({x:1155,y:950},{x:0,y:-700},size,bounds,solids);
 assert.equal(p.y,250);
 assert.ok(isSafePosition(p,size,bounds,solids));
 const back=moveWithCollisions(p,{x:0,y:700},size,bounds,solids);
 assert.equal(back.y,950);
});
