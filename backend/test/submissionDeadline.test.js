const test=require('node:test');const assert=require('node:assert/strict');const {createSubmissionDeadline,pastDue,MESSAGE}=require('../server/submissionDeadline');
test('deadline comparison respects Beijing instant and permits the exact deadline',()=>{const due='2026-10-11T10:00:00+08:00';assert.equal(pastDue(due,Date.parse('2026-10-11T02:00:00Z')),false);assert.equal(pastDue(due,Date.parse('2026-10-11T02:00:00.001Z')),true);assert.equal(pastDue(null),false);});
test('past due requires the latest approval; revoke closes resubmission and records preserve original deadline',async()=>{
 const writes=[];let permission=null;let due='2020-01-01T00:00:00Z';const pool={async query(sql,args){if(sql.startsWith('CREATE'))return {rows:[]};if(sql.startsWith('SELECT id,due_date'))return {rows:[{id:5,due_date:due}]};if(sql.startsWith('SELECT * FROM assignment_submission_declines'))return {rows:[]};if(sql.startsWith('SELECT * FROM assignment_late_permissions'))return {rows:permission?[permission]:[]};writes.push({sql,args});return {rows:[]};}};
 const service=createSubmissionDeadline(pool);await assert.rejects(service.check(5,10),e=>e.status===403&&e.message===MESSAGE);
 permission={id:8,enabled:true};const state=await service.check(5,10);assert.equal(state.late,true);await service.record(state,5,10,90,'attachment');assert.deepEqual(writes[0].args,[5,10,90,8,due,'attachment']);
 permission={id:9,enabled:false};await assert.rejects(service.check(5,10),e=>e.code==='PAST_DUE');due=null;assert.deepEqual(await service.check(5,10),{late:false});
});
test('rejection middleware blocks the upload handler and fails closed on database error',async()=>{const pool={async query(sql){if(sql.startsWith('CREATE'))return {rows:[]};if(sql.startsWith('SELECT id,due_date'))return {rows:[{due_date:'2020-01-01'}]};return {rows:[]};}};const s=createSubmissionDeadline(pool);let next=false,status,body;const res={status(n){status=n;return this;},json(b){body=b;}};await s.middleware({user:{id:10,role:'student'},params:{assignmentId:5}},res,()=>{next=true;});assert.equal(next,false);assert.equal(status,403);assert.equal(body.code,'PAST_DUE');const broken=createSubmissionDeadline({query:async()=>{throw Error('offline');}});await broken.middleware({user:{id:10,role:'student'},params:{assignmentId:5}},res,()=>{next=true;});assert.equal(status,500);assert.equal(next,false);});
test('notices are recorded only after deadline rejection and retain enrollment guard',async()=>{
 let due=null;const notices=[];const pool={async query(sql,args){if(sql.startsWith('CREATE'))return {rows:[]};if(sql.startsWith('SELECT id,due_date'))return {rows:[{id:5,due_date:due}]};if(sql.startsWith('INSERT INTO assignment_late_blocked'))notices.push({sql,args});return {rows:[]};}};
 const service=createSubmissionDeadline(pool);const req={user:{id:10,role:'student'},params:{assignmentId:5}};let next=0;const res={status(){return this;},json(){}};
 await service.middleware(req,res,()=>next++);assert.equal(next,1);assert.equal(notices.length,0);
 due='2020-01-01';await service.middleware(req,res,()=>next++);assert.equal(next,1);assert.equal(notices.length,1);assert.deepEqual(notices[0].args,[5,10]);assert.match(notices[0].sql,/class_enrollments/);assert.match(notices[0].sql,/ON CONFLICT/);
});

test('holding mode permits saving unapproved late work but read-aloud rejection remains unchanged', async()=>{
 const pool={async query(sql){if(sql.startsWith('CREATE'))return {rows:[]};if(sql.startsWith('SELECT id,due_date'))return {rows:[{due_date:'2020-01-01'}]};return {rows:[]};}};
 const service=createSubmissionDeadline(pool);
 assert.deepEqual(await service.check(5,10,{hold:true}),{late:true,pending:true,due:'2020-01-01'});
 await assert.rejects(service.check(5,10), e=>e.code==='PAST_DUE');
 let next=false;await service.holdMiddleware({user:{id:10,role:'student'},params:{assignmentId:5}}, {status(){throw Error('Should not reject')}},()=>{next=true});assert.equal(next,true);
});
