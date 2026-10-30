import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observerCourseText,observerWorkStatus,observerAttentionItems,observerCourseLabel} from './observerCourseView.js';
test('attention list distinguishes overdue, awaiting marks, and future work without treating zero as missing',()=>{
 const now=Date.parse('2026-10-13T12:00:00+08:00');
 const make=(date,score,status)=>({assignment:{due_date:date},submission:score===undefined?null:{score},submissionStatus:status});
 const items=[make('2026-10-12T08:00:00Z',undefined,'not_submitted'),make('2026-10-14T08:00:00Z',undefined,'not_submitted'),make(null,null,'submitted'),make(null,0,'not_submitted'),make(null,'85','submitted')];
 assert.deepEqual(items.map(item=>observerWorkStatus(item,now)),['overdue','notSubmitted','awaitingMark','graded','graded']);
 assert.deepEqual(observerAttentionItems(items,now),items.slice(0,3));assert.deepEqual(observerAttentionItems([],now),[]);
});
test('Chinese labels cover every course-view key and translated subjects retain original identity',()=>{
 assert.deepEqual(Object.keys(observerCourseText.zh).sort(),Object.keys(observerCourseText.en).sort());
 for(const value of Object.values(observerCourseText.zh).filter(value=>value !== '/'))assert.ok(/[\u4e00-\u9fff]/.test(value));
 assert.equal(observerCourseLabel('Science 10D','zh'),'科学 10D（Science 10D）');
 assert.equal(observerCourseLabel('Science 10D','en'),'Science 10D');
 assert.equal(observerCourseLabel('Custom Teacher Title','zh'),'Custom Teacher Title');
});

test('teacher entered assignments await a mark without missing work warnings and retain zero marks',()=>{
 const item={assignment:{submission_required:false,due_date:'2020-01-01'},submission:null,submissionStatus:'not_submitted'};
 assert.equal(observerWorkStatus(item),'teacherMark');
 assert.deepEqual(observerAttentionItems([item]),[]);
 assert.equal(observerWorkStatus({...item,submission:{score:0}}),'graded');
});
