const test = require('node:test');
const assert = require('node:assert/strict');
const {createObserverAttendanceHandler} = require('../server/observerAttendance');
function response() { return { code:200, status(n){this.code=n;return this},json(body){this.body=body;return this} }; }
const request = (override={}) => ({user:{role:'observer',email:'parent@example.com'},params:{observerEmail:'parent@example.com',studentEmail:'child@example.com',courseId:'8'},...override});
test('a parent cannot impersonate another observer; no student lookup occurs',async()=>{
  let touched=false;
  const handler=createObserverAttendanceHandler({pool:{query(){touched=true}},getObserverStudents(){touched=true}});
  const res=response();await handler(request({user:{role:'observer',email:'other@example.com'}}),res);
  assert.equal(res.code,403);assert.equal(touched,false);
});
test('an unlinked student or course cannot yield attendance records',async()=>{
  let queried=false;
  const handler=createObserverAttendanceHandler({pool:{query(){queried=true}},getObserverStudents:async()=>({rows:[{student_email:'child@example.com',class_id:99}]})});
  const res=response();await handler(request(),res);assert.equal(res.code,403);assert.equal(queried,false);
});
test('authorized parent reads filter both student and actual enrolled course',async()=>{
  let args;
  const handler=createObserverAttendanceHandler({pool:{query:async(sql,params)=>{args={sql,params};return {rows:[{date:'2026-10-22',status:'Absent'}]}}},getObserverStudents:async()=>({rows:[{student_email:'child@example.com',class_id:8}]})});
  const res=response();await handler(request({user:{role:'parent',email:'parent@example.com'}}),res);
  assert.equal(res.code,200);assert.deepEqual(args.params,[8,'child@example.com']);
  assert.match(args.sql,/s.course_id = \$1 AND LOWER\(r.student_email\) = \$2/);
  assert.deepEqual(res.body.records,[{date:'2026-10-22',status:'Absent'}]);
});
test('invalid class identifiers are rejected before database access',async()=>{
  const handler=createObserverAttendanceHandler({getObserverStudents:()=>{throw Error('must not call')}});
  const res=response();const req=request();req.params.courseId='1.5';await handler(req,res);assert.equal(res.code,400);
});
test('no attendance records returns an empty list rather than inferred presence',async()=>{
  const handler=createObserverAttendanceHandler({pool:{query:async()=>({rows:[]})},getObserverStudents:async()=>({rows:[{student_email:'child@example.com',class_id:8}]})});
  const res=response();await handler(request(),res);assert.deepEqual(res.body,{records:[]});
});
