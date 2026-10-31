const {test}=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');const {createSurveysRouter}=require('./surveys');
const id='1cf48748-394b-41e0-b945-f4be6acc8a0c',outside='ffffffff-ffff-ffff-ffff-ffffffffffff';
const token=role=>({Authorization:'Bearer '+jwt.sign({id:4,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')});
async function withServer(fn,fail=false){
 const calls=[];const pool={async query(sql,args){calls.push({sql,args});if(sql.startsWith('CREATE'))return {rows:[]};if(sql.startsWith('SELECT NULLIF'))return {rows:[{school_id:12}]};if(fail)throw Error('database unavailable');
 if(sql.includes('COUNT(r.id)')){assert.deepEqual(args,[12]);assert.match(sql,/school_id IS NOT DISTINCT FROM \$1/);return {rows:[{id,title:'Competencies',response_count:2,status:'closed'}]};}
 if(sql.includes('SELECT id, title, description, status FROM school_surveys')){assert.deepEqual(args,[args[0],12]);assert.match(sql,/school_id IS NOT DISTINCT FROM \$2/);return {rows:args[0]===id?[{id,title:'Competencies',status:'closed'}]:[]};}
 if(sql.includes('SELECT r.id, r.survey_id')){assert.deepEqual(args,[id,12]);assert.match(sql,/s.school_id IS NOT DISTINCT FROM \$2/);return {rows:[{id:'response',survey_id:id,student:'{"name":"Student"}',questions:'[{"id":"old","title":"Original question"}]',answers:'{"old":"Answer"}'}]};}throw Error('Unexpected SQL');}};
 const app=express();app.use(express.json());app.use('/api/surveys',createSurveysRouter(pool));
 const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.on('error',reject);});
 try{await fn(`http://127.0.0.1:${server.address().port}`,calls);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('report catalog and responses require administrators',()=>withServer(async base=>{
 for(const suffix of ['/reports','/reports/'+id]){assert.equal((await fetch(base+'/api/surveys'+suffix)).status,401);for(const role of ['student','observer','teacher'])assert.equal((await fetch(base+'/api/surveys'+suffix,{headers:token(role)})).status,403);}
}));
test('school admins can report on closed surveys with archived responses and no-store caching',()=>withServer(async base=>{
 const catalog=await fetch(base+'/api/surveys/reports',{headers:token('admin')});assert.equal(catalog.status,200);assert.equal(catalog.headers.get('cache-control'),'no-store');assert.equal((await catalog.json()).surveys[0].response_count,2);
 const report=await fetch(base+'/api/surveys/reports/'+id,{headers:token('admin')});assert.equal(report.status,200);assert.equal(report.headers.get('cache-control'),'no-store');const body=await report.json();assert.equal(body.survey.status,'closed');assert.equal(JSON.parse(body.responses[0].questions)[0].title,'Original question');
}));
test('outside-school and invalid IDs never expose response data',()=>withServer(async(base,calls)=>{
 const before=calls.length;assert.equal((await fetch(base+'/api/surveys/reports/'+outside,{headers:token('admin')})).status,404);assert.equal(calls.slice(before).filter(c=>c.sql.includes('SELECT r.id, r.survey_id')).length,0);assert.equal((await fetch(base+'/api/surveys/reports/not-a-uuid',{headers:token('admin')})).status,400);
}));
test('database failure hides internal diagnostics',()=>withServer(async base=>{
 const result=await fetch(base+'/api/surveys/reports',{headers:token('admin')});assert.equal(result.status,500);assert.doesNotMatch(JSON.stringify(await result.json()),/database unavailable/);
},true));
