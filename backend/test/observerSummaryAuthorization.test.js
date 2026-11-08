const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function route(){const source=fs.readFileSync(path.join(__dirname,'../server/app.js'),'utf8');const start=source.indexOf('app.get(\n  "/api/observers/:observerEmail/students/:studentEmail/courses/:courseId/dashboard",');const end=source.indexOf('\napp.get("/api/students/',start);assert.ok(start>0&&end>start);let handler,roles;const forbidden=()=>{throw Error('Unauthorized data read')};vm.runInNewContext(source.slice(start,end),{app:{get(...args){handler=args.at(-1)}},authenticateJWT(){},requireRole(...value){roles=value;return ()=>{}},getObserverStudents:async()=>({rows:[{student_email:'linked@example.invalid',class_id:12}]}),resolveContentCourseId:forbidden,pool:{query:forbidden},loadObserverTestSummary:forbidden,console});return {handler,roles}}
function response(){return {code:200,status(value){this.code=value;return this},json(value){this.body=value;return this}}}
test('course summary remains behind observer identity and linked student/course authorization',async()=>{
 const {handler,roles}=route();assert.deepEqual(roles,['admin','observer','parent']);
 for(const params of [{observerEmail:'other@example.invalid',studentEmail:'linked@example.invalid',courseId:'12'},{observerEmail:'me@example.invalid',studentEmail:'unlinked@example.invalid',courseId:'12'},{observerEmail:'me@example.invalid',studentEmail:'linked@example.invalid',courseId:'13'}]){
  const res=response();await handler({user:{role:'observer',email:'me@example.invalid'},params},res);assert.equal(res.code,403)
 }
});
