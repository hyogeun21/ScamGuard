import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunData} from '../src/game/state.js';
import {smartphoneData,messageThread,askMessageQuestion,callChoices,askCallQuestion} from '../src/game/smartphoneState.js';
test('message questions append a chronological user/answer pair without duplicate sends',()=>{
 const run=createRunData(1),message={id:'m1',questions:[{id:'a',title:'내 질문1',answer:'답변1'},{id:'b',title:'내 질문2',answer:'답변2'}]};
 askMessageQuestion(run,message,'a');askMessageQuestion(run,message,'b');
 assert.deepEqual(messageThread(run,'m1').turns.map(t=>t.text),['내 질문1','답변1','내 질문2','답변2']);
 assert.equal(askMessageQuestion(run,message,'a'),false);
 assert.equal(messageThread(run,'m2').turns.length,0);
 assert.equal(smartphoneData(createRunData(1)).call.turns.length,0);
 assert.throws(()=>askMessageQuestion(run,message,'missing'));
});
test('calls begin with user questions and follow-up paths keep the transcript intact',()=>{
 const run=createRunData(4),scenario={callQuestions:[{id:'c1',title:'질문',answer:'답변',followUps:[{id:'f1',title:'추가질문',answer:'추가답변'}]},{id:'c2',title:'다른질문',answer:'다른답변'}]};
 assert.equal(callChoices(run,scenario).length,2);
 askCallQuestion(run,scenario,['c1']);
 assert.deepEqual(callChoices(run,scenario)[0].path,['c1','f1']);
 askCallQuestion(run,scenario,['c1','f1']);
 assert.deepEqual(smartphoneData(run).call.turns.map(t=>t.text),['질문','답변','추가질문','추가답변']);
 assert.equal(askCallQuestion(run,scenario,['c1']),false);
 assert.throws(()=>askCallQuestion(run,scenario,['missing']));
});
