import test from 'node:test';
import assert from 'node:assert/strict';
import {lateApprovalState} from './lateApprovalVisibility.js';
const now=Date.parse('2026-11-01T04:13:00Z');
test('November 5 Beijing deadline never requests approval on November 1',()=>{
 assert.equal(lateApprovalState({due_date:'2026-11-04T16:00:00Z',enabled:false,held_work:[]},now),'hidden');
});
test('permission settings appear strictly after the deadline without claiming work is held',()=>{
 const due='2026-11-04T16:00:00Z';
 assert.equal(lateApprovalState({due_date:due},Date.parse(due)),'hidden');
 assert.equal(lateApprovalState({due_date:due},Date.parse(due)+1),'permission_only');
});
test('undated, invalid and teacher entered assignments do not show approval controls',()=>{
 for(const due_date of [null,'','bad'])assert.equal(lateApprovalState({due_date},now),'hidden');
 assert.equal(lateApprovalState({due_date:'2020-01-01',submission_required:false},now),'hidden');
});
test('real previously held work stays accessible after an extension without calling current work late',()=>{
 const data={due_date:'2026-11-04T16:00:00Z',held_work:[{id:1}]};
 assert.equal(lateApprovalState(data,now),'previous_work');
 assert.equal(lateApprovalState({...data,held_work:[],decline:{id:1}},now),'previous_work');
});

test('only actual held or declined work receives the approval warning after a deadline',()=>{
 const data={due_date:'2026-10-27T01:50:00Z',enabled:false,held_work:[],retained_work:[],permissions:[],acceptances:[]};
 assert.equal(lateApprovalState(data,now),'permission_only');
 assert.equal(lateApprovalState({...data,enabled:true},now),'permission_only');
 assert.equal(lateApprovalState({...data,held_work:[{id:1}]},now),'overdue');
 assert.equal(lateApprovalState({...data,decline:{id:1}},now),'overdue');
 assert.equal(lateApprovalState({...data,retained_work:[{id:2}]},now),'overdue');
});
