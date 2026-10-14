const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const {once}=require('node:events');
const {createQuizzesRouter}=require('./quizzes');
const id='7bf2cac4-32e1-4c94-b60b-d2f297b11f83';
const foreign='8bf2cac4-32e1-4c94-b60b-d2f297b11f83';
test('quiz deletion is owner/school scoped, atomic, and keeps published gradebook marks and assignments',async()=>{
 const calls=[];let failDelete=false;
 const pool={async query(sql,args=[]){calls.push({sql,args});if(sql.startsWith('CREATE')||sql.startsWith('ALTER'))return {rows:[]};if(sql.startsWith('SELECT NULLIF'))return {rows:[{school_id:7}]};if(sql.startsWith('SELECT id FROM teacher_quizzes'))return {rows:args[0]===id&&(args[1]===3||args[1]===null)&&args[2]===7?[{id}]:[]};if(failDelete&&sql.startsWith('DELETE FROM teacher_quiz_responses'))throw Error('Injected deletion failure');return {rows:[]};},async connect(){return {...this,release(){calls.push({sql:'RELEASE'});}}}};
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
  assert.ok(calls.some(c=>c.sql.startsWith('SELECT id FROM teacher_quizzes')&&c.args[1]===null&&c.args[2]===7));
  failDelete=true;const failureStart=calls.length;assert.equal((await remove(id)).status,500);const failed=calls.slice(failureStart);assert.ok(failed.some(c=>c.sql==='ROLLBACK'));assert.ok(!failed.some(c=>c.sql==='COMMIT'));assert.ok(failed.some(c=>c.sql==='RELEASE'));
 }finally{server.close();await once(server,'close');}
});
