import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WALK_SPEC,WALK_CROP,WALK_DISPLAY,walkFrameRect,walkDirection,updatePlayerWalk} from '../src/game/playerWalk.js';
import {moveWithCollisions,isSafePosition} from '../src/game/collision.js';
test('all twelve frames fit the supplied sheet and walk sequences retain metadata order',()=>{
 const png=readFileSync(new URL('../public/assets/player-walk-sheet.png',import.meta.url));
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 assert.equal(width,1200);assert.equal(height,2600);
 for(let i=0;i<12;i++){const r=walkFrameRect(i);assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height);}
 assert.equal(WALK_SPEC.frameRate,6.25);
 assert.deepEqual(WALK_SPEC.animations.front.walk,[0,1,2,1]);
 assert.equal(WALK_DISPLAY.h,143);
 assert.equal(WALK_DISPLAY.w/WALK_DISPLAY.h,WALK_CROP.w/WALK_CROP.h);
});
test('WASD, diagonal priority and idle preserve facing',()=>{
 assert.equal(walkDirection(0,1),'front');assert.equal(walkDirection(0,-1),'back');
 assert.equal(walkDirection(1,0),'right');assert.equal(walkDirection(-1,0),'left');
 assert.equal(walkDirection(-1,-1),'left');assert.equal(walkDirection(0,0,'back'),'back');
});
test('walk loops without restarting; stop returns to the directional idle frame',()=>{
 const calls=[];const sprite={setFlipX(v){calls.push(['flip',v]);},setFrame(v){calls.push(['frame',v]);},setDisplaySize(w,h){calls.push(['size',w,h]);},anims:{play(...a){calls.push(['play',...a]);},stop(){calls.push(['stop']);}}};
 updatePlayerWalk(sprite,'left',true);assert.ok(calls.some(a=>a[0]==='play'&&a[1]==='player-walk-left'&&a[2]===true));
 calls.length=0;updatePlayerWalk(sprite,'left',false);assert.ok(calls.some(a=>a[0]==='stop'));assert.ok(calls.some(a=>a[0]==='frame'&&a[1]==='10'));
});
test('walking envelope stays within the room and does not pass furniture',()=>{
 const bounds={x:64,y:150,w:1792,h:900},solid=[{x:885,y:653.5,w:470,h:287}];
 let p={x:524.5,y:930};
 for(let i=0;i<500;i++){p=moveWithCollisions(p,{x:Math.sin(i*7)*600,y:Math.cos(i*11)*600},WALK_DISPLAY,bounds,solid);assert.ok(isSafePosition(p,WALK_DISPLAY,bounds,solid));}
});
