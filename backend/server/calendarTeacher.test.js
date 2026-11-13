const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const routes={};const events=[{id:1,created_by:7,title:'Original'}];
 const source=fs.readFileSync(__dirname+'/app.js','utf8');
 const block=source.slice(source.indexOf("app.post('/api/calendar/events'"),source.indexOf("app.delete('/api/calendar/events"));
 const pool={query:async(sql,p)=>{
  if(sql.includes('INSERT')){const e={id:2,created_by:p[8],title:p[0]};events.push(e);return {rows:[e]};}
  const e=events.find(e=>e.id===p[8]&&(p[9]||e.created_by===p[10]));
  if(e)e.title=p[0];return {rows:e?[e]:[]};
 }};
 vm.runInNewContext(block,{app:{post:(path,...args)=>routes.POST=args,put:(path,...args)=>routes.PUT=args},authenticateJWT(){},requireRole:(...roles)=>({roles}),ensureSchoolCalendarTables:async()=>{},normaliseCalendarAudiences:v=>Array.isArray(v)?v:[],pool,console});
 return {routes,events};
}
async function call(routes,method,id,role='teacher',dates={}){
 let status=200,result;
 await routes[method].at(-1)({user:{id,role},params:{eventId:1},body:{title:'Changed',starts_at:'2026-11-13T09:00:00+08:00',ends_at:'2026-11-13T10:00:00+08:00',audiences:['student'],...dates}},{status(n){status=n;return this},json(v){result=v;return this}});
 return {status,result};
}
test('teachers can create calendar events with server-assigned ownership',async()=>{
 const {routes}=setup();assert.deepEqual(Array.from(routes.POST[1].roles),['admin','teacher']);
 const r=await call(routes,'POST',7);assert.equal(r.status,201);assert.equal(r.result.event.created_by,7);
});
test('teachers edit their own events but cannot edit another creator’s event',async()=>{
 const {routes,events}=setup();assert.equal((await call(routes,'PUT',8)).status,404);assert.equal(events[0].title,'Original');
 assert.equal((await call(routes,'PUT',7)).status,200);assert.equal(events[0].title,'Changed');
});
test('admins retain access and invalid dates are rejected before database writes',async()=>{
 const {routes,events}=setup();assert.equal((await call(routes,'PUT',8,'admin')).status,200);
 assert.equal((await call(routes,'POST',7,'teacher',{starts_at:'invalid'})).status,400);assert.equal(events.length,1);
});
