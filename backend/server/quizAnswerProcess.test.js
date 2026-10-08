const test=require('node:test');const assert=require('node:assert/strict');
const {validateQuiz,markQuiz,publicQuestions}=require('./quizGrading');
const question={id:'essay1',type:'Essay',title:'Name the capital of Canada',required:true,options:[],targets:[],points:2};
test('accepted short answers are graded and recorded with case and spacing normalization',()=>{
 const qs=validateQuiz({title:'Quiz',questions:[{...question,gradingMode:'exact',answerKey:'Ottawa\nOttawa, Canada'}]});
 assert.equal(markQuiz(qs,{essay1:'  OTTAWA  '})[0].score,2);
 assert.equal(markQuiz(qs,{essay1:'Toronto'})[0].score,0);
 assert.equal(markQuiz(qs,{})[0].score,0);
 assert.ok(!('answerKey' in publicQuestions(qs)[0]));
});
test('manual model answers remain teacher-only and do not invent marks',()=>{
 const qs=validateQuiz({title:'Quiz',questions:[{...question,answerKey:'Use accurate evidence and clear reasoning.'}]});
 assert.equal(qs[0].answerKey,'Use accurate evidence and clear reasoning.');
 assert.equal(markQuiz(qs,{essay1:'A written response'})[0].score,null);
 assert.ok(!('answerKey' in publicQuestions(qs)[0]));
});
test('automatic short answer cannot save without an accepted answer',()=>{
 assert.throws(()=>validateQuiz({title:'Quiz',questions:[{...question,gradingMode:'exact',answerKey:' '}]}),/accepted answers/);
});
