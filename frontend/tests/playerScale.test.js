import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYER_POSES,PLAYER_SCALE,playerFacing,visiblePlayerSize} from '../src/game/playerFacing.js';
test('all poses scale to 1.3x while retaining their proportions',()=>{
 assert.equal(PLAYER_SCALE,1.3);
 for(const [key,w] of Object.entries({player:62.9528,'player-back':63.313,'player-side':49.4631})){
  assert.ok(Math.abs(PLAYER_POSES[key].w-w*1.3)<1e-8);
  assert.equal(PLAYER_POSES[key].h,143);
 }
 const pose=playerFacing(1,0);
 assert.deepEqual(visiblePlayerSize({displayWidth:pose.width,displayHeight:pose.height}),{w:pose.width,h:143});
});
