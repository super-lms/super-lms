const test=require('node:test'),assert=require('node:assert/strict');
const {courseMark,validatePeriod,courseIdentity}=require('../server/reportCards');
const config={type:'Interim',start:'2026-09-01',end:'2026-11-06',gradeBasis:'period'};
const student={student_user_id:5,student_email:'Student@example.com'};
test('weighted subgroup averages match the gradebook without weighting repeated assignments twice',()=>{
 const assignments=[{id:1,subcategory_id:10,course_weight_percent:60,reporting_date:'2026-10-01'},{id:2,subcategory_id:10,course_weight_percent:60,reporting_date:'2026-10-02'},{id:3,subcategory_id:20,course_weight_percent:40,reporting_date:'2026-10-03'}];
 const submissions=[{assignment_id:1,student_id:5,score:100},{assignment_id:2,student_id:5,score:50},{assignment_id:3,student_email:'student@example.com',score:50},{assignment_id:3,student_id:99,score:100}];
 assert.equal(courseMark(assignments,submissions,student,config).calculated_mark,65);
});
test('period selection excludes future and undated work, cumulative includes earlier work, latest mark wins',()=>{
 const assignments=[{id:1,reporting_date:'2026-08-31'},{id:2,reporting_date:'2026-09-01'},{id:3,reporting_date:'2026-11-07'},{id:4,reporting_date:null}];
 const submissions=[{assignment_id:1,student_id:5,score:100},{assignment_id:2,student_id:5,score:20},{assignment_id:2,student_id:5,score:0},{assignment_id:3,student_id:5,score:90},{assignment_id:4,student_id:5,score:100}];
 assert.equal(courseMark(assignments,submissions,student,config).calculated_mark,0);
 assert.equal(courseMark(assignments,submissions,student,{...config,gradeBasis:'cumulative'}).calculated_mark,50);
});
test('ungraded work remains not graded; an actual zero remains zero',()=>{
 const assignments=[{id:1,reporting_date:'2026-10-01'}];
 assert.equal(courseMark(assignments,[{assignment_id:1,student_id:5,score:null}],student,config).calculated_mark,null);
 assert.equal(courseMark(assignments,[{assignment_id:1,student_id:5,score:0}],student,config).calculated_mark,0);
});
test('invalid and reversed dates, unknown report types and calculation choices are rejected',()=>{
 for(const patch of [{start:'2026-02-30'},{end:'2026-01-01'},{type:'anything'},{gradeBasis:'anything'},{end:'2028-01-01'}])assert.throws(()=>validatePeriod({...config,...patch}));
 assert.deepEqual(validatePeriod(config),config);
});
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function routeHarness({allowed=true,failInsert=false}={}){
 const handlers={},calls=[];let released=false;const router={use(){},get(url,handler){handlers[`GET ${url}`]=handler;},post(url,handler){handlers[`POST ${url}`]=handler;}};
 const query=async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT c.id'))return {rows:allowed?[{id:94,title:'CTS 10A',master_course_id:90}]:[]};if(sql.startsWith('SELECT class_id,student_user_id'))return {rows:[{class_id:94,student_user_id:5}]};if(sql.startsWith('SELECT DISTINCT u.id'))return {rows:[{...student,student_name:'A',pen:'012345678',student_grade:'10',student_class:'10A'}]};if(sql.startsWith('SELECT a.id'))return {rows:[{id:1,reporting_date:'2026-10-01'}]};if(sql.startsWith('SELECT s.assignment_id'))return {rows:[{assignment_id:1,student_id:5,score:75}]};if(sql.startsWith('SELECT ce.student_user_id'))return {rows:[{student_user_id:5,com1:'Good',com2:''}]};if(sql.startsWith('SELECT r.student_email'))return {rows:[{student_email:student.student_email,status:'Present',count:1}]};if(sql.startsWith('SELECT COUNT'))return {rows:[{count:2}]};if(sql.startsWith('INSERT')&&failInsert)throw new Error('Database failed');return {rows:[]};};
 const pool={query,connect:async()=>({query,release:()=>released=true})};const mod={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/routes/reportCardRoutes.js'),'utf8'),{module:mod,require:name=>name==='express'?{Router:()=>router}:{validatePeriod,courseMark,courseIdentity},console});
 mod.exports({pool,authenticateJWT(){},requireRole:()=>()=>{},ensureStudentInfoColumns:async()=>{},ensureStudentReportCommentsTable:async()=>{}});
 return {handlers,calls,get released(){return released;}};
}
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
const req={params:{classId:'94'},query:config,user:{role:'teacher',id:2}};
test('report generation uses exact class enrollment with shared assignments and period attendance',async()=>{
 const h=routeHarness(),res=response();await h.handlers['GET /:classId/report-cards'](req,res);assert.equal(res.statusCode,200);assert.equal(res.body.cards[0].pen,'012345678');assert.equal(res.body.cards[0].student_grade,'10');assert.equal(res.body.cards[0].student_class,'10A');assert.equal(res.body.cards[0].courses[0].calculated_mark,75);assert.equal(res.body.cards[0].courses[0].attendance.Unrecorded,1);
 assert.equal(h.calls.find(c=>c.sql.startsWith('SELECT a.id')).params[0],90);assert.equal(h.calls.find(c=>c.sql.startsWith('SELECT DISTINCT u.id')).params[0],94);assert.deepEqual(Array.from(h.calls.find(c=>c.sql.startsWith('SELECT r.student_email')).params),[94,config.start,config.end]);
});
test('unauthorized classes cannot generate save or load report cards',async()=>{
 for(const method of ['GET /:classId/report-cards','GET /:classId/report-cards/saved','POST /:classId/report-cards']){const h=routeHarness({allowed:false}),res=response();await h.handlers[method]({...req,body:{config,cards:[{student_user_id:5,courses:[{course_id:94}]}]}},res);assert.equal(res.statusCode,403);assert.equal(h.calls.length,1);}
});
test('saved batches verify enrollment and rollback on failure',async()=>{
 let h=routeHarness(),res=response();await h.handlers['POST /:classId/report-cards']({...req,body:{config,cards:[{student_user_id:99,courses:[{course_id:94}]}]}},res);assert.equal(res.statusCode,400);assert.ok(!h.calls.some(c=>c.sql==='BEGIN'));
 h=routeHarness({failInsert:true});res=response();await h.handlers['POST /:classId/report-cards']({...req,body:{config,cards:[{student_user_id:5,courses:[{course_id:94,mark_override:''}]}]}},res);assert.equal(res.statusCode,400);assert.ok(h.calls.some(c=>c.sql==='ROLLBACK'));assert.equal(h.released,true);
});

test('report identity comes from the selected course rather than historical directory grade and class',()=>{
 assert.deepEqual(courseIdentity({title:'Chemistry 12C',section_code:'C'}),{student_grade:'12',student_class:'12C'});
 assert.deepEqual(courseIdentity({title:'CTS 10A',section_code:'A'}),{student_grade:'10',student_class:'10A'});
 assert.deepEqual(courseIdentity({title:'Accounting 11 for Grade 12s'}),{student_grade:'12',student_class:''});
 assert.deepEqual(courseIdentity({title:'Fitness and Conditioning 11/12B'}),{student_grade:'11/12',student_class:'11/12B'});
 assert.deepEqual(courseIdentity({title:'Course without a grade'}),{student_grade:'',student_class:''});
});
