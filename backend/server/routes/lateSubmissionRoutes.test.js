const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLateSubmissionRouter}=require('./lateSubmissionRoutes');

for(const role of ['admin','teacher']){
 test(`${role} notices use course teaching assignments without a role or author bypass`,async()=>{
  let queried=false;
  const pool={query:async(sql,args)=>{
   queried=true;
   assert.deepEqual(args,[42]);
   assert.doesNotMatch(sql,/\$\d\s*=\s*'admin'|a\.teacher_id\s*=/);
   assert.match(sql,/c\.teacher_id=\$1/);
   assert.match(sql,/ct\.course_id IN\(c\.id,COALESCE\(c\.master_course_id,c\.id\)\)/);
   assert.match(sql,/ce\.student_user_id=b\.student_id AND cohort\.master_course_id=c\.id/);
   assert.match(sql,/cohort\.teacher_id=\$1/);
   assert.match(sql,/a\.due_date IS NOT NULL AND a\.due_date<=NOW\(\) AND a\.due_date<=b\.due_at/);
   assert.match(sql,/AND NOT EXISTS\(SELECT 1 FROM assignment_late_permissions p/);
   assert.match(sql,/p\.id=\(SELECT MAX\(p2\.id\)/);
   return {rows:[{assignment_id:7}]};
  }};
  const router=createLateSubmissionRouter(pool,{ensure:async()=>{}});
  const route=router.stack.find(layer=>layer.route?.path==='/late-submission-alerts').route;
  let body;
  const res={set(){return this},json(value){body=value},status(){throw Error('Unexpected failure')}};
  await route.stack.at(-1).handle({user:{id:42,role}},res);
  assert.ok(queried);assert.deepEqual(body,{alerts:[{assignment_id:7}]});
 });
}
