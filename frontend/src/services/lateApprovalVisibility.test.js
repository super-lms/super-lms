import test from 'node:test';
import assert from 'node:assert/strict';
import {lateApprovalState} from './lateApprovalVisibility.js';
const now=Date.parse('2026-11-09T06:00:00Z');
test('on-time, missing and permission-only records never display a late notice',()=>{
 for(const due_date of ['2026-10-27T01:50:00Z','2026-11-20T00:00:00Z',null,'bad']) {
  for(const enabled of [false,true])assert.equal(lateApprovalState({due_date,enabled,held_work:[],acceptances:[],permissions:[{enabled}]},now),'hidden');
 }
 assert.equal(lateApprovalState({due_date:'2026-10-27',decline:{id:1}},now),'hidden');
});
test('actual held work shows review controls, including work held under an earlier deadline',()=>{
 const data={due_date:'2026-10-27T01:50:00Z',held_work:[{id:1}]};
 assert.equal(lateApprovalState(data,now),'overdue');
 assert.equal(lateApprovalState({...data,due_date:'2026-11-20T00:00:00Z'},now),'previous_work');
 assert.equal(lateApprovalState({...data,due_date:null},now),'previous_work');
 assert.equal(lateApprovalState({...data,held_work:[],retained_work:[{id:2}]},now),'overdue');
});
test('accepted after-deadline work gets a simple notice rather than approval controls',()=>{
 assert.equal(lateApprovalState({acceptances:[{id:1}]},now),'accepted_late');
 assert.equal(lateApprovalState({submission_required:false,held_work:[{id:1}]},now),'hidden');
});
