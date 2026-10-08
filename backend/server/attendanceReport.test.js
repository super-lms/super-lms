const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function handler(pool){
 const source=fs.readFileSync(require('node:path').join(__dirname,'app.js'),'utf8');
 const block=source.slice(source.indexOf('/* PRINTABLE ATTENDANCE RANGE REPORT */'),source.indexOf('/* SAVE CLASS ATTENDANCE */'));
 let route;
 vm.runInNewContext(block,{app:{get:(path,...args)=>{route=args.at(-1);}},authenticateJWT:()=>{},requireRole:()=>()=>{},pool,console});
 return route;
}
function response(){return {code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test('invalid or reversed date ranges fail before reading student records',async()=>{
 let queries=0;const run=handler({query:async()=>{queries++;}});
 for(const [start,end] of [['2026-02-30','2026-03-01'],['2026-11-09','2026-11-06'],['2026-01-01','2028-01-01']]){
 const res=response();await run({params:{classId:'1'},query:{start,end},user:{role:'teacher',id:5}},res);assert.equal(res.code,400);
 }assert.equal(queries,0);
});
test('unauthorized teachers never read the roster or attendance',async()=>{
 let queries=0;const run=handler({query:async(sql,params)=>{queries++;assert.ok(sql.includes('course_teachers'));assert.ok(sql.includes('c.teacher_id = $3'));assert.deepEqual(Array.from(params),[1,'teacher',5]);return {rows:[]};}});
 const res=response();await run({params:{classId:'1'},query:{start:'2026-09-01',end:'2026-11-06'},user:{role:'teacher',id:5}},res);
 assert.equal(res.code,403);assert.equal(queries,1);
});
test('authorized report queries bind class and inclusive date range',async()=>{
 let queries=0;const run=handler({query:async(sql,params)=>{queries++;if(queries===1)return {rows:[{id:1,title:'Class A'}]};if(queries===2)return {rows:[]};assert.ok(sql.includes('BETWEEN $2::date AND $3::date'));assert.deepEqual(Array.from(params),[1,'2026-09-01','2026-11-06']);return {rows:[]};}});
 const res=response();await run({params:{classId:'1'},query:{start:'2026-09-01',end:'2026-11-06'},user:{role:'teacher',id:5}},res);
 assert.equal(res.code,200);assert.equal(queries,4);assert.equal(res.body.class.title,'Class A');assert.equal(res.body.sessions.length,0);
});
