const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const {once}=require('node:events');
const {createAnnouncementsRouter}=require('../server/routes/announcements');
test('announcement access, publishing, attachments, and school isolation',async()=>{
  const calls=[];
  const pool={async query(sql,params=[]){
    calls.push({sql,params});
    if(sql.startsWith('SELECT school_id'))return {rows:[{school_id:7}]};
    if(sql.startsWith('INSERT INTO school_announcements'))return {rows:[{id:42}]};
    if(sql.startsWith('SELECT COUNT'))return {rows:[{count:0}]};
    if(sql.startsWith('SELECT f.*'))return {rows:params[0]==='1'?[{filename:'instructions.txt',mime_type:'text/plain',file_data:Buffer.from('Orange Shirt Day')}]:[]};
    return {rows:[]};
  },async connect(){return {...this,release(){}};}};
  const app=express();app.use('/api/announcements',createAnnouncementsRouter(pool));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/announcements`;
  const headers=role=>({Authorization:`Bearer ${jwt.sign({id:3,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`});
  try{
    assert.equal((await fetch(base)).status,401);
    assert.equal((await fetch(base,{headers:headers('student')})).status,200);
    assert.deepEqual(calls.find(c=>c.sql.includes('FROM school_announcements a JOIN')).params,[7]);
    assert.equal((await fetch(base,{method:'POST',headers:headers('student')})).status,403);
    const form=new FormData();form.append('title','Orange Shirt Day');form.append('body','Read the attached instructions.');form.append('files',new Blob(['School instructions']), 'instructions.txt');
    const published=await fetch(base,{method:'POST',headers:headers('teacher'),body:form});assert.equal(published.status,200);assert.equal((await published.json()).id,42);
    assert.ok(calls.some(c=>c.sql.startsWith('INSERT INTO school_announcement_files')&&c.params[0]===42));
    assert.ok(calls.some(c=>c.sql==='COMMIT'));
    const unsupported=new FormData();unsupported.append('title','Test');unsupported.append('body','Test');unsupported.append('files',new Blob(['<script>']), 'bad.html');
    assert.equal((await fetch(base,{method:'POST',headers:headers('teacher'),body:unsupported})).status,400);
    assert.equal((await fetch(base,{method:'POST',headers:headers('teacher'),body:new FormData()})).status,400);
    const preview=await fetch(`${base}/files/1?preview=true`,{headers:headers('student')});assert.equal((await preview.json()).text,'Orange Shirt Day');
    const file=await fetch(`${base}/files/1`,{headers:headers('student')});assert.match(file.headers.get('content-disposition'),/attachment/);assert.equal(await file.text(),'Orange Shirt Day');
    assert.deepEqual(calls.find(c=>c.sql.startsWith('SELECT f.*')).params,['1',7]);
    assert.equal((await fetch(`${base}/files/2`,{headers:headers('student')})).status,404);
    assert.equal((await fetch(`${base}/42`,{method:'DELETE',headers:headers('student')})).status,403);
    assert.equal((await fetch(`${base}/42`,{method:'DELETE',headers:headers('teacher')})).status,404);
    const deletion=calls.find(c=>c.sql.startsWith('DELETE FROM school_announcements'));
    assert.deepEqual(deletion.params,['42',7,3,false]);
  }finally{server.close();await once(server,'close');}
});
