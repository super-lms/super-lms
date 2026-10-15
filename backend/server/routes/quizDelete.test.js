const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const {once}=require('node:events');
const {createQuizzesRouter}=require('./quizzes');
const id='7bf2cac4-32e1-4c94-b60b-d2f297b11f83';
const foreign='8bf2cac4-32e1-4c94-b60b-d2f297b11f83';
test('linked assignment removal needs confirmation, authorization and no shared quiz link',async()=>{
 const calls=[];let permitted=true,shared=false,fail=false;
 const pool={async query(sql,args=[]){calls.push(sql);if(sql.startsWith('SELECT NULLIF'))return {rows:[{school_id:7}]};if(sql.startsWith('SELECT id,assignment_id'))return {rows:[{id,assignment_id:42}]};if(sql.startsWith('SELECT a.id FROM assignments'))return {rows:permitted?[{id:42}]:[]};if(sql.startsWith('SELECT id FROM teacher_quizzes WHERE assignment_id'))return {rows:shared?[{id:foreign}]:[]};if(fail&&sql==='DELETE FROM assignments WHERE id=$1')throw Error('Deletion failed');return {rows:[]};},async connect(){return {...this,release(){}}}};
 const app=express();app.use('/api/quizzes',createQuizzesRouter(pool));const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/quizzes/${id}`;
 const headers={Authorization:`Bearer ${jwt.sign({id:3,role:'teacher'},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`};
 const remove=(query='?removeAssignment=true&confirmMarks=true')=>fetch(base+query,{method:'DELETE',headers});
 try{
  assert.equal((await remove('?removeAssignment=true')).status,409);assert.ok(!calls.some(s=>s.startsWith('DELETE')));
  permitted=false;assert.equal((await remove()).status,403);permitted=true;
  shared=true;assert.equal((await remove()).status,409);shared=false;
  const response=await remove();assert.equal(response.status,200);assert.equal((await response.json()).removedAssignmentId,42);assert.ok(calls.includes('DELETE FROM assignments WHERE id=$1'));
  calls.length=0;fail=true;assert.equal((await remove()).status,500);assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));
 }finally{server.close();await once(server,'close');}
});
test('quiz deletion is owner/school scoped, atomic, and keeps published gradebook marks and assignments',async()=>{
 const calls=[];let failDelete=false;
 const pool={async query(sql,args=[]){calls.push({sql,args});if(sql.startsWith('CREATE')||sql.startsWith('ALTER'))return {rows:[]};if(sql.startsWith('SELECT NULLIF'))return {rows:[{school_id:7}]};if(sql.startsWith('SELECT id,assignment_id FROM teacher_quizzes'))return {rows:args[0]===id&&(args[1]===3||args[1]===null)&&args[2]===7?[{id}]:[]};if(failDelete&&sql.startsWith('DELETE FROM teacher_quiz_responses'))throw Error('Injected deletion failure');return {rows:[]};},async connect(){return {...this,release(){calls.push({sql:'RELEASE'});}}}};
 const app=express();app.use('/api/quizzes',createQuizzesRouter(pool));const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/quizzes`;
 const headers=(role,userId=3)=>({Authorization:`Bearer ${jwt.sign({id:userId,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`});
 const remove=(target,role='teacher',userId=3)=>fetch(`${base}/${target}`,{method:'DELETE',headers:headers(role,userId)});
 try{
  assert.equal((await fetch(`${base}/${id}`,{method:'DELETE'})).status,401);
  assert.equal((await remove(id,'student')).status,403);
  assert.equal((await remove('bad')).status,400);
  const start=calls.length;assert.equal((await remove(id,'teacher',9)).status,404);assert.ok(!calls.slice(start).some(c=>c.sql.startsWith('DELETE')));
  assert.equal((await remove(foreign,'admin')).status,404);
  const before=calls.length;const response=await remove(id);assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,id});
  const transaction=calls.slice(before);assert.deepEqual(transaction.filter(c=>c.sql.startsWith('DELETE')).map(c=>c.sql),[
    'DELETE FROM teacher_quiz_gradebook WHERE quiz_id=$1','DELETE FROM teacher_quiz_attempts WHERE quiz_id=$1','DELETE FROM teacher_quiz_responses WHERE survey_id=$1','DELETE FROM teacher_quizzes WHERE id=$1']);
  assert.ok(transaction.some(c=>c.sql==='COMMIT'));assert.ok(transaction.filter(c=>c.sql.startsWith('DELETE')).every(c=>c.args[0]===id));
  assert.ok(!calls.some(c=>/DELETE FROM (assignments|submissions)/.test(c.sql)));
  assert.equal((await remove(id,'admin',9)).status,200);
  assert.ok(calls.some(c=>c.sql.startsWith('SELECT id,assignment_id FROM teacher_quizzes')&&c.args[1]===null&&c.args[2]===7));
  failDelete=true;const failureStart=calls.length;assert.equal((await remove(id)).status,500);const failed=calls.slice(failureStart);assert.ok(failed.some(c=>c.sql==='ROLLBACK'));assert.ok(!failed.some(c=>c.sql==='COMMIT'));assert.ok(failed.some(c=>c.sql==='RELEASE'));
 }finally{server.close();await once(server,'close');}
});
