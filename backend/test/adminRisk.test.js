const test=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');const {once}=require('node:events');const {createAdminRiskRouter}=require('../server/routes/adminRiskRoutes');
test('school risk alerts are admin only, school scoped and use shared master evidence',async()=>{
 const calls=[];const pool={async query(sql,params){calls.push({sql,params});
  if(sql.includes('AS school_id'))return {rows:[{school_id:7}]};
  if(sql.startsWith('SELECT c.*'))return {rows:[{id:2,title:'CTS 10B',master_course_id:1,teacher_ids:[3]}]};
  if(sql.startsWith('SELECT DISTINCT u.id'))return {rows:[{id:10,name:'Student',email:'student@test',class_id:2}]};
  if(sql.startsWith('SELECT id,COALESCE'))return {rows:[{id:3,name:'Teacher'}]};
  if(sql.startsWith('SELECT a.id'))return {rows:[{id:8,class_id:1}]};
  if(sql.startsWith('SELECT s.assignment_id'))return {rows:[{student_id:10,assignment_id:8,class_id:1,score:25}]};throw Error(sql);
 }};
 const app=express();app.use('/risk',createAdminRiskRouter(pool));const server=app.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}/risk`;
 const headers=role=>({Authorization:`Bearer ${jwt.sign({id:1,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`});
 try{assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:headers('teacher')})).status,403);assert.equal(calls.length,0);const res=await fetch(url,{headers:headers('admin')});assert.equal(res.status,200);const data=await res.json();assert.equal(data.student_count,1);assert.equal(data.students[0].label,'Failing');assert.deepEqual(calls.find(c=>c.sql.startsWith('SELECT c.*')).params,[7]);assert.match(calls.find(c=>c.sql.startsWith('SELECT c.*')).sql,/school_id IS NOT DISTINCT FROM \$1/);assert.deepEqual(calls.find(c=>c.sql.startsWith('SELECT a.id')).params,[[1]]);}finally{server.close();await once(server,'close');}
});
