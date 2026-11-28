import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {GameAudio,soundForObject} from '../src/game/gameAudio.js';
function fixture(locked=false){
 const manager=new EventEmitter();manager.locked=locked;manager.pauseOnBlur=true;
 const instances=new Map();
 manager.unlock=()=>{manager.locked=false;manager.emit('unlocked');};
 manager.add=(key,config)=>{
  const s={key,config,isPlaying:false,isPaused:false,plays:0,play(){this.plays++;this.isPlaying=true;this.isPaused=false;},stop(){this.isPlaying=false;this.isPaused=false;},pause(){this.isPlaying=false;this.isPaused=true;},resume(){this.isPlaying=true;this.isPaused=false;},destroy(){this.stop();this.destroyed=true;}};
  instances.set(key,s);return s;
 };
 const events=new EventEmitter();const game={sound:manager,events,cache:{audio:{exists:()=>true}}};
 return {audio:new GameAudio(game,null),manager,events,instances};
}
test('background loop is unique across scene changes and waits for audio unlock',()=>{
 const f=fixture(true);f.audio.startBgm();assert.equal(f.instances.size,0);
 f.manager.unlock();const bg=f.instances.get('sg-bgm');assert.equal(bg.config.loop,true);assert.equal(bg.plays,1);
 f.audio.startBgm();f.audio.startBgm();assert.equal(bg.plays,1);
 f.audio.stopBgm();assert.equal(bg.isPlaying,false);f.audio.destroy();
});
test('footsteps loop only during movement and stop on blur without restarting on focus',()=>{
 const f=fixture();f.audio.startBgm();f.audio.setFootsteps(true);f.audio.setFootsteps(true);
 const step=f.instances.get('sg-footsteps');assert.equal(step.plays,1);
 f.audio.setFootsteps(false);assert.equal(step.isPlaying,false);
 f.audio.setFootsteps(true);f.events.emit('blur');assert.equal(step.isPlaying,false);
 assert.equal(f.instances.get('sg-bgm').isPaused,true);
 f.events.emit('focus');assert.equal(step.isPlaying,false);assert.equal(f.instances.get('sg-bgm').isPlaying,true);
 f.audio.destroy();assert.equal(f.manager.pauseOnBlur,true);
});
test('object sounds are routed correctly and missing assets remain silent',()=>{
 assert.equal(soundForObject('computer'),'computer');assert.equal(soundForObject('smartphone'),'smartphone');
 assert.equal(soundForObject('telephone'),'smartphone');assert.equal(soundForObject('door'),'interaction');
 const f=fixture();f.audio.interact('computer');assert.equal(f.instances.get('sg-computer').plays,1);
 f.audio.game.cache.audio.exists=()=>false;assert.doesNotThrow(()=>f.audio.interact('smartphone'));
 f.audio.destroy();assert.equal(f.events.listenerCount('blur'),0);
});
