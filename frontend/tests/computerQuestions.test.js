import test from 'node:test';
import assert from 'node:assert/strict';
import {computerQuestions,findComputerQuestion} from '../src/game/computerQuestions.js';
test('pages can supply confirmed questions instead of the labeled sample data',()=>{
 const questions=[{id:'company-id',title:'등록 정보는?',answer:'확정 내용'}];
 const page={questions};assert.equal(computerQuestions(page),questions);
 assert.equal(findComputerQuestion(page,'company-id').answer,'확정 내용');
 assert.deepEqual(computerQuestions({questions:[]}),[]);
 assert.throws(()=>findComputerQuestion(page,'missing'));
});
test('default question IDs are stable and sample answers are clearly labeled',()=>{
 const questions=computerQuestions({});assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 assert.equal(questions.length,4);assert.ok(questions.every(q=>q.answer.includes('교체용 예시')));
});
