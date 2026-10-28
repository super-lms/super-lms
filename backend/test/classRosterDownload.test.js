const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../server/app.js'),'utf8');
function fixture(allowed){let handler,calls=0;const context={
 app:{get:(paths,...handlers)=>{assert.ok(paths.includes('/api/class-roster/:courseId/export.docx'));handler=handlers.at(-1);}},
 authenticateJWT(){},requireRole:()=>()=>{},ensureStudentInfoColumns:async()=>{},
 authorizeCourseModuleAccess:async()=>({allowed,status:403}),console,
 pool:{query:async(sql,args)=>{calls++;if(calls===1)return {rows:[{id:11,title:'10 Master Class',master_course_id:null}]};if(calls===2)return {rows:[{id:12,title:'10A'}]};assert.deepEqual(Array.from(args[0]),[11,12]);return {rows:[{id:101,name:'Amy',student_id:'100200',section_title:'10A'}]};}},
 require:()=>({classRosterDocx:async(course,students)=>{assert.equal(students.length,1);return Buffer.from('PK');}}),
};vm.runInNewContext(source.slice(source.indexOf('app.get(["/api/class-roster/:courseId"'),source.indexOf('/* GET CLASS ATTENDANCE */')),context);
 return {handler,get calls(){return calls;}};}
const response=()=>({code:200,headers:{},status(n){this.code=n;return this},set(k,v){this.headers[k]=v;return this},send(b){this.body=b;return this},json(b){this.body=b;return this}});
test('Word export combines linked cohorts when the selected course is a master class',async()=>{const f=fixture(true),res=response();await f.handler({params:{courseId:'11'},query:{},path:'/api/class-roster/11/export.docx'},res);assert.equal(res.code,200);assert.match(res.headers['Content-Disposition'],/class-roster-11.docx/);assert.equal(res.body.toString(),'PK');});
test('Word export denies course access before loading student details',async()=>{const f=fixture(false),res=response();await f.handler({params:{courseId:'11'},query:{},path:'/api/class-roster/11/export.docx'},res);assert.equal(res.code,403);assert.equal(f.calls,1);});
