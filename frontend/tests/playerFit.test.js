import test from 'node:test';
import assert from 'node:assert/strict';
import {playerFacing,visiblePlayerSize,syncPlayerBody} from '../src/game/playerFacing.js';
import {moveWithCollisions,isSafePosition} from '../src/game/collision.js';
test('side view uses its visible width, avoiding an invisible fixed-width obstruction',()=>{
 const pose=playerFacing(1,0);
 const size=visiblePlayerSize({displayWidth:pose.width,displayHeight:pose.height});
 const walls=[{x:0,y:300,w:100,h:600},{x:125,y:300,w:10,h:600}];
 const bounds={x:-200,y:0,w:500,h:600};
 // 70px corridor: the enlarged side pose fits, unlike a front-width fixed body.
 const from={x:85,y:400};
 assert.ok(isSafePosition(from,size,bounds,walls));
 const next=moveWithCollisions(from,{x:0,y:-100},size,bounds,walls);
 assert.deepEqual(next,{x:85,y:300});
 assert.equal(isSafePosition(from,{w:82.3069,h:143},bounds,walls),false);
});
test('Arcade body uses the active frame dimensions, excluding original transparent padding',()=>{
 const calls=[];
 const sprite={width:603,height:1341,body:{
  setSize(...args){calls.push(['size',...args]);},
  setOffset(...args){calls.push(['offset',...args]);},
  updateFromGameObject(){calls.push(['update']);},
 }};
 syncPlayerBody(sprite);
 assert.deepEqual(calls,[['size',603,1341,false],['offset',0,0],['update']]);
});
