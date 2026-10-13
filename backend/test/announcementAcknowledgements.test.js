const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const {once}=require('node:events');
const {createAnnouncementsRouter}=require('../server/routes/announcements');

test('student announcement alerts persist acknowledgement and enforce account, audience and version checks',async()=>{
  const version='2026-10-14T02:00:00.123Z';
  const calls=[], acknowledgements=new Set();
  const pool={async query(sql,params=[]){
    calls.push({sql,params});
    if(sql.includes('AS school_id FROM users u'))return {rows:[{school_id:7}]};
    if(sql.startsWith('SELECT a.id,a.title'))return {rows:acknowledgements.has(params[2])?[]:[{id:42,title:'School notice',body:'Read this',updated_at:version,files:[]}]};
    if(sql.startsWith('INSERT INTO school_announcement_acknowledgements')){
      if(params[3]!==42 || params[4]!==version)return {rows:[]};
      acknowledgements.add(params[2]);return {rows:[{announcement_id:42}]};
    }
    return {rows:[]};
  }};
  const app=express();app.use('/api/announcements',createAnnouncementsRouter(pool));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/announcements`;
  const headers=(role='student',id=3)=>({Authorization:`Bearer ${jwt.sign({id,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`,'Content-Type':'application/json'});
  const acknowledge=(id,body,role='student',userId=3)=>fetch(`${base}/${id}/acknowledge`,{method:'POST',headers:headers(role,userId),body:JSON.stringify(body)});
  try {
    assert.equal((await fetch(`${base}/pending`)).status,401);
    for(const role of ['admin','teacher']){
      assert.equal((await fetch(`${base}/pending`,{headers:headers(role)})).status,403);
      assert.equal((await acknowledge(42,{version},role)).status,403);
    }
    const first=await fetch(`${base}/pending`,{headers:headers()});
    assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/no-store/);
    assert.equal((await first.json()).length,1);
    for(const [id,body] of [['bad',{version}],[42,{}],[42,{version:'bad'}]])assert.equal((await acknowledge(id,body)).status,400);
    assert.equal((await acknowledge(42,{version:'2026-10-13T02:00:00Z'})).status,409);
    assert.equal((await acknowledge(999,{version})).status,409);
    assert.equal((await acknowledge(42,{version,student_user_id:99})).status,200);
    assert.equal((await acknowledge(42,{version})).status,200,'repeat acknowledgement is idempotent');
    assert.deepEqual(await (await fetch(`${base}/pending`,{headers:headers()})).json(),[]);
    assert.equal((await (await fetch(`${base}/pending`,{headers:headers('student',4)})).json()).length,1,'another student still has unread announcement');
    const pending=calls.find(c=>c.sql.startsWith('SELECT a.id,a.title'));
    assert.deepEqual(pending.params,[7,'student',3]);
    assert.match(pending.sql,/ack.student_user_id=\$3/);assert.match(pending.sql,/ack.announcement_version=date_trunc\('milliseconds',a.updated_at\)/);
    const write=calls.find(c=>c.sql.startsWith('INSERT INTO school_announcement_acknowledgements'));
    for(const sql of [pending.sql,write.sql]){
      assert.match(sql,/school_id IS NOT DISTINCT FROM \$1/);
      assert.match(sql,/class_enrollments/);assert.match(sql,/is_published=true/);
      assert.match(sql,/publish_at <= NOW\(\)/);assert.match(sql,/expires_at > NOW\(\)/);
    }
    assert.match(write.sql,/date_trunc\('milliseconds',a.updated_at\)=\$5::TIMESTAMPTZ/);
    assert.match(write.sql,/ON CONFLICT \(announcement_id,student_user_id\) DO UPDATE/);
    assert.ok(calls.some(c=>c.sql===write.sql&&c.params[3]===42&&c.params[2]===3&&c.params[4]===version));
  }finally{server.close();await once(server,'close');}
});
