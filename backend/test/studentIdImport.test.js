const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const service=require('../server/studentIdImport');
const users=[{id:1,role:'student',name:'Aeris Jin Muxi',email:'a@test',student_id:'G10B-014'},
 {id:2,role:'student',name:'Ethan Chen Liming',email:'e@test',student_id:'100247'},
 {id:3,role:'teacher',name:'Aeris Jin Muxi',email:'teacher@test',student_id:''}];
test('matches full names regardless of case/spacing; changes only placeholder IDs',()=>{
 const p=service.previewStudentIds([{name:' AERIS  Jin Muxi ',student_id:'100248'},{name:'Ethan Chen Liming',student_id:'100247'}],users);
 assert.equal(p[0].user_id,1);assert.equal(p[0].status,'Ready');assert.equal(p[1].status,'Already set');
 assert.deepEqual(service.readySnapshot(p),[{user_id:1,student_id:'100248',previous_id:'G10B-014'}]);
});
test('does not guess partial names and protects conflicting six-digit IDs',()=>{
 const p=service.previewStudentIds([{name:'Aeris',student_id:'100248'},{name:'Ethan Chen Liming',student_id:'100999'}],users);
 assert.ok(p.every(r=>r.status==='Review'));
});
test('duplicate source names/IDs, duplicate account names, nine-digit PENs and IDs owned by other accounts are rejected',()=>{
 for(const rows of [
  [{name:'Aeris Jin Muxi',student_id:'100248'},{name:'Aeris Jin Muxi',student_id:'100249'}],
  [{name:'Aeris Jin Muxi',student_id:'100248'},{name:'Ethan Chen Liming',student_id:'100248'}],
  [{name:'Aeris Jin Muxi',student_id:'199141276'}],
  [{name:'Aeris Jin Muxi',student_id:'100247'}],
 ])assert.ok(service.previewStudentIds(rows,users).every(r=>r.status==='Review'));
 assert.equal(service.previewStudentIds([{name:'Aeris Jin Muxi',student_id:'100248'}],[...users,{...users[0],id:4}])[0].status,'Review');
});
async function run(body,fail=false){
 const calls=[];let handler,roles;
 const client={async query(sql,args){calls.push({sql,args});if(sql.includes('SELECT id,role'))return {rows:users};if(fail&&sql.startsWith('UPDATE'))throw Error('write failed');return {rows:[]};},release(){calls.push({sql:'RELEASE'});}};
 const source=fs.readFileSync(require.resolve('../server/routes/adminUserRoutes'),'utf8');const start=source.indexOf("router.post('/student-id-import'");const code=source.slice(start,source.indexOf('router.put(',start));
 vm.runInNewContext(code,{router:{post(_path,_auth,roleMiddleware,h){handler=h;}},authenticateJWT(){},requireRole(role){roles=role;return ()=>{};},pool:{connect:async()=>client},require:()=>service,console:{error(){}}});
 let status=200,result;const res={status(n){status=n;return this},json(b){result=b;return this}};
 await handler({body},res);return {status,result,calls,roles};
}
const rows=[{name:'Aeris Jin Muxi',student_id:'100248'}];
test('preview is administrator-only and never updates the database',async()=>{
 const r=await run({rows});assert.equal(r.roles,'admin');assert.equal(r.status,200);assert.equal(r.result.updated,0);assert.ok(!r.calls.some(c=>c.sql.startsWith('UPDATE')));
});
test('apply revalidates preview, serializes ID changes, updates only student_id, and releases the connection',async()=>{
 const expected=service.readySnapshot(service.previewStudentIds(rows,users));const r=await run({rows,apply:true,expected});
 assert.equal(r.status,200);assert.equal(r.result.updated,1);assert.ok(r.calls.some(c=>c.sql.startsWith('LOCK TABLE users')));
 const updates=r.calls.filter(c=>c.sql.startsWith('UPDATE'));assert.equal(updates.length,1);assert.deepEqual(Array.from(updates[0].args),["100248",1]);
 assert.equal(updates[0].sql,"UPDATE users SET student_id=$1 WHERE id=$2 AND role='student'");assert.equal(r.calls.at(-1).sql,'RELEASE');
});
test('stale preview and failed writes roll back',async()=>{
 const stale=await run({rows,apply:true,expected:[]});assert.equal(stale.status,409);assert.ok(!stale.calls.some(c=>c.sql.startsWith('UPDATE')));
 const expected=service.readySnapshot(service.previewStudentIds(rows,users));const failed=await run({rows,apply:true,expected},true);
 assert.equal(failed.status,400);assert.ok(failed.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(!failed.calls.some(c=>c.sql==='COMMIT'));assert.equal(failed.calls.at(-1).sql,'RELEASE');
});
