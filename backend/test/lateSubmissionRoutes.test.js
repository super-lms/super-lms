const test=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');const {once}=require('node:events');const {createLateSubmissionRouter}=require('../server/routes/lateSubmissionRoutes');
test('only assigned teachers/admin can approve enrolled students and each approve/revoke is recorded',async()=>{
 const writes=[];const pool={async query(sql,args){if(sql.startsWith('SELECT a.id'))return {rows:args[2]===3?[{id:5,class_id:1,due_date:'2020-01-01'}]:[]};if(sql.startsWith('SELECT u.id'))return {rows:args[0]==='student@test'?[{id:10}]:[]};if(sql.startsWith('INSERT'))writes.push(args);return {rows:[]};}};
 const app=express();app.use(express.json());app.use('/a',createLateSubmissionRouter(pool,{ensure:async()=>{}}));const server=app.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}/a/5/late-submission`;
 const send=(role,id,enabled,email='student@test')=>fetch(url,{method:'POST',headers:{Authorization:`Bearer ${jwt.sign({id,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`,'Content-Type':'application/json'},body:JSON.stringify({student_email:email,enabled})});
 try{assert.equal((await send('student',10,true)).status,403);assert.equal((await send('teacher',4,true)).status,403);assert.equal((await send('teacher',3,true,'other@test')).status,400);assert.equal(writes.length,0);assert.equal((await send('teacher',3,true)).status,200);assert.equal((await send('teacher',3,false)).status,200);assert.deepEqual(writes,[[5,10,3,true],[5,10,3,false]]);}finally{server.close();await once(server,'close');}
});

test('approval router lets student assignment requests reach their own handlers',async()=>{
 const app=express();app.use('/api/assignments',createLateSubmissionRouter({},{}));
 app.get('/api/assignments/:id/student-submission',(_req,res)=>res.json({submission:null}));
 app.get('/api/assignments/:id/student-attachments',(_req,res)=>res.json({attachments:[]}));
 app.post('/api/assignments/:id/student-submit',(_req,res)=>res.status(403).json({code:'PAST_DUE'}));
 app.post('/api/assignments/:id/student-attachments',(_req,res)=>res.status(403).json({code:'PAST_DUE'}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/assignments/5`;
 const headers={Authorization:`Bearer ${jwt.sign({id:10,role:'student'},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`};
 try{
  for(const path of ['student-submission','student-attachments'])assert.equal((await fetch(`${base}/${path}`,{headers})).status,200);
  for(const path of ['student-submit','student-attachments']){
   const response=await fetch(`${base}/${path}`,{method:'POST',headers});
   assert.equal(response.status,403);assert.equal((await response.json()).code,'PAST_DUE');
  }
 }finally{server.close();await once(server,'close');}
});
test('notice listing requires teacher/admin and scopes database reads to the teacher',async()=>{
 let readArgs;const pool={async query(sql,args){readArgs=args;assert.match(sql,/a.teacher_id=\$2/);assert.match(sql,/c.school_id IS NOT DISTINCT FROM/);return {rows:[{assignment_id:5,student_id:10}]};}};
 const app=express();app.use('/a',createLateSubmissionRouter(pool,{ensure:async()=>{}}));const server=app.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}/a/late-submission-alerts`;
 const headers=role=>({Authorization:`Bearer ${jwt.sign({id:3,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`});
 try{assert.equal((await fetch(url,{headers:headers('student')})).status,403);assert.equal(readArgs,undefined);const r=await fetch(url,{headers:headers('teacher')});assert.equal(r.status,200);assert.equal((await r.json()).alerts.length,1);assert.deepEqual(readArgs,['teacher',3]);}finally{server.close();await once(server,'close');}
});
