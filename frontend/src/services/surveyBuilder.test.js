import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {frequencyLabels,changeQuestionType,applyFrequency,checkBuilder} from './surveyBuilder.js';
const {validateSurvey}=createRequire(import.meta.url)('../../../backend/server/surveyImport.js');
const imported=[{id:'q1',title:'I can describe who is in my family',type:'Essay',options:[],targets:[],required:true},{id:'q2',title:'I can name all my classmates',type:'Essay',options:[],targets:[],required:true}];
test('switching imported essays to choice or ranking creates the five requested options',()=>{
 for(const type of ['Multiple Choice','Ranking']) assert.deepEqual(changeQuestionType(imported[0],type).options,frequencyLabels);
 assert.deepEqual(changeQuestionType({...imported[0],options:['Yes','No']},'Multiple Choice').options,['Yes','No']);
});
test('bulk frequency responses pass actual server validation and retain labels',()=>{
 for(const type of ['Rating','Multiple Choice','Ranking']) {
  const questions=applyFrequency(imported,type);checkBuilder('Student survey',questions);
  const stored=validateSurvey({title:'Student survey',questions});
  assert.equal(stored.length,2);
  for(const q of stored)assert.deepEqual(type==='Rating'?q.ratingLabels:q.options,frequencyLabels);
 }
});
test('save errors identify the exact invalid question',()=>{
 assert.throws(()=>checkBuilder('Survey',[imported[0],{...imported[1],type:'Ranking'}]),/Question 2/);
 assert.throws(()=>checkBuilder('Survey',[{...imported[0],type:'Multiple Choice',options:['Never','Never']}]),/unique options/);
});
