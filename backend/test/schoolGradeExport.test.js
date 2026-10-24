const test=require('node:test');const assert=require('node:assert/strict');
const {validateExport,buildGradeSnapshot,createGradeExportHandler}=require('../server/schoolGradeExport');
const periods=[{label:'Semester 1',start:'2026-09-01',end:'2027-01-15'},{label:'Semester 2',start:'2027-01-18',end:'2027-06-30'}];
const config=validateExport({courseIds:[1,2],schoolYear:'2026-2027',periods});
const courses=[{id:1,title:'CTS 10A'},{id:2,title:'CTS 10B',master_course_id:1}];
const roster=[{class_id:1,student_user_id:10,student_name:'甲',student_email:'a@test',student_id:'100'},{class_id:2,student_user_id:20,student_name:'乙',student_email:'b@test',student_id:'200'}];
const assignments=[{id:1,class_id:1,title:'Shared',reporting_date:'2026-10-01',points_possible:10},{id:2,class_id:1,cohort_id:2,title:'B only',reporting_date:'2026-10-02',points_possible:20},{id:3,class_id:1,title:'S2',reporting_date:'2027-02-01',points_possible:100},{id:4,class_id:1,title:'Undated',reporting_date:null,points_possible:100}];
const submissions=[{id:1,assignment_id:1,student_id:10,score:50},{id:2,assignment_id:1,student_id:10,score:0},{id:3,assignment_id:1,student_id:20,score:80,rubric_selection:{pointsEarned:8}},{id:4,assignment_id:4,student_id:20,score:100}];
test('periods reject invalid dates, overlap, mismatched years and duplicate semesters',()=>{
 assert.throws(()=>validateExport({courseIds:'1',schoolYear:'2026-2027',periods}));
 for(const bad of [[{...periods[0],start:'2026-02-30'}],[periods[0],{...periods[1],start:'2027-01-15'}],[periods[0],periods[0]],[{...periods[0],end:'2028-01-01'}]])assert.throws(()=>validateExport({courseIds:[1],schoolYear:'2026-2027',periods:bad}));
 assert.equal(config.periods.length,2);
});
test('snapshots keep cohort and semester evidence separate while preserving zero marks and ungraded roster students',()=>{
 const sheets=buildGradeSnapshot(courses,roster,assignments,submissions,config);
 assert.equal(sheets.length,4);
 const a=sheets.find(s=>s.course.id===1&&s.period.label==='Semester 1');
 assert.deepEqual(a.assignments.map(a=>a.id),[1,4]);assert.equal(a.students[0].calculated_mark,0);assert.equal(a.students[0].marks[0].points_earned,0);
 const b=sheets.find(s=>s.course.id===2&&s.period.label==='Semester 1');
 assert.deepEqual(b.assignments.map(a=>a.id),[1,2,4]);assert.equal(b.students[0].calculated_mark,80);assert.equal(b.students[0].marks[1].score,null);
 assert.equal(b.undated_assignments,1);
 const s2=sheets.find(s=>s.course.id===1&&s.period.label==='Semester 2');assert.equal(s2.students.length,1);assert.equal(s2.students[0].calculated_mark,null);
});
function res(){return {code:200,status(code){this.code=code;return this},json(body){this.body=body;return this}}}
test('school scope denial aborts before reading student grades and releases the snapshot connection',async()=>{
 const calls=[];let released=false;
 const client={query:async(sql,params)=>{calls.push({sql,params});return {rows:[]}},release(){released=true}};
 const response=res();await createGradeExportHandler({connect:async()=>client})({user:{id:99},body:{courseIds:[1],schoolYear:'2026-2027',periods:[periods[0]]}},response);
 assert.equal(response.code,403);assert.equal(released,true);assert.equal(calls.length,3);
 assert.match(calls[0].sql,/REPEATABLE READ READ ONLY/);assert.match(calls[1].sql,/c.school_id IS NOT DISTINCT FROM/);assert.match(calls[1].sql,/content.school_id IS NOT DISTINCT FROM c.school_id/);assert.deepEqual(calls[1].params,[[1],99]);assert.equal(calls[2].sql,'ROLLBACK');
});
test('successful export commits one coherent snapshot; database failure yields no partial report',async()=>{
 let n=0,released=false;const client={query:async(sql)=>{if(sql.startsWith('BEGIN')||sql==='COMMIT')return {};return {rows:[courses,roster,assignments,submissions][n++]}},release(){released=true}};
 const response=res();await createGradeExportHandler({connect:async()=>client})({user:{id:99},body:{courseIds:[1,2],schoolYear:'2026-2027',periods}},response);
 assert.equal(response.code,200);assert.equal(response.body.sheets.length,4);assert.equal(released,true);
 let rolledBack=false;const broken={query:async(sql)=>{if(sql==='ROLLBACK'){rolledBack=true;return}if(sql.startsWith('BEGIN'))return;throw Error('test unavailable')},release(){}};
 const fail=res();await createGradeExportHandler({connect:async()=>broken})({user:{id:99},body:{courseIds:[1],schoolYear:'2026-2027',periods:[periods[0]]}},fail);
 assert.equal(fail.code,500);assert.equal(fail.body.sheets,undefined);assert.equal(rolledBack,true);
});
