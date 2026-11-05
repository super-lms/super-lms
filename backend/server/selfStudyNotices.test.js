const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSelfStudyNotices,validateNotice,validateRange}=require('./selfStudyNotices');
const teacher={id:5,role:'teacher'},admin={id:1,role:'admin'};
const body={study_date:'2026-11-06',course_id:10,ipad_status:'needed',notes:'Complete the online quiz.'};
function fixture({allowed=true,school=2}={}){
 const calls=[],rows=[];
 const pool={query:async(sql,p=[])=>{
  calls.push({sql,p});
  if(sql.includes('CREATE TABLE'))return {rows:[]};
  if(sql.includes('FROM users u WHERE'))return {rows:[{school_id:school}]};
  if(sql.startsWith('SELECT c.id'))return {rows:allowed?[{id:10,title:'PE 10A'}]:[]};
  if(sql.includes('INSERT INTO self_study_ipad_notices')){
   let row=rows.find(n=>n.course_id===p[1]&&n.teacher_id===p[2]&&n.study_date===p[3]);
   if(!row){row={id:rows.length+1,school_id:p[0],course_id:p[1],teacher_id:p[2],study_date:p[3]};rows.push(row)}
   Object.assign(row,{ipad_status:p[4],notes:p[5],cancelled_at:null});return {rows:[{id:row.id}]};
  }
  if(sql.includes('SELECT n.id'))return {rows:rows.filter(n=>n.school_id===p[0]&&n.study_date>=p[1]&&n.study_date<=p[2]&&!n.cancelled_at).map(n=>({...n,can_edit:p[3]==='admin'||n.teacher_id===p[4]}))};
  if(sql.includes('SET cancelled_at')){
   const row=rows.find(n=>n.id===p[0]&&n.school_id===p[1]&&(p[2]==='admin'||n.teacher_id===p[3])&&!n.cancelled_at);
   if(!row)return {rows:[]};row.cancelled_at=true;return {rows:[{id:row.id}]};
  }
  if(sql.includes('UPDATE self_study_ipad_notices SET course_id')){
   const row=rows.find(n=>n.id===p[4]&&n.school_id===p[5]&&(p[6]==='admin'||n.teacher_id===p[7])&&!n.cancelled_at);
   if(!row)return {rows:[]};Object.assign(row,{course_id:p[0],study_date:p[1],ipad_status:p[2],notes:p[3]});return {rows:[{id:row.id}]};
  }
  throw Error('Unexpected query: '+sql);
 }};
 return {service:createSelfStudyNotices(pool),calls,rows};
}
test('validates explicit status, real calendar dates and bounded daily/weekly ranges',()=>{
 assert.deepEqual(validateNotice(body),body);
 for(const change of [{study_date:'2026-02-30'},{study_date:''},{course_id:0},{ipad_status:'yes'},{notes:'x'.repeat(1001)}])assert.throws(()=>validateNotice({...body,...change}));
 assert.deepEqual(validateRange('2026-11-02','2026-11-08'),{from:'2026-11-02',to:'2026-11-08'});
 for(const pair of [['2026-11-06','2026-11-05'],['2026-11-01','2026-11-08'],['bad','2026-11-08']])assert.throws(()=>validateRange(...pair));
});
test('all requested audiences can read school-wide notices, without gaining editing rights',async()=>{
 const {service,calls}=fixture();await service.save(teacher,body);
 for(const role of ['teacher','observer','parent','student']){
  const list=await service.list({id:9,role},'2026-11-06','2026-11-06');
  assert.equal(list.length,1);assert.equal(list[0].can_edit,false);
  await assert.rejects(service.save({id:9,role},body,1),{status:403});
 }
 const read=calls.find(c=>c.sql.includes('SELECT n.id'));assert.ok(read.sql.includes('n.school_id IS NOT DISTINCT FROM $1'));assert.equal(read.p[0],2);
});
test('teacher may only post for a course they teach; author identity comes from the account',async()=>{
 await assert.rejects(fixture({allowed:false}).service.save(teacher,body),{status:403});
 const {service,rows,calls}=fixture();await service.save(teacher,{...body,teacher_id:99,school_id:99});
 assert.equal(rows[0].teacher_id,5);assert.equal(rows[0].school_id,2);
 const access=calls.find(c=>c.sql.startsWith('SELECT c.id'));assert.ok(access.sql.includes('course_teachers'));assert.ok(access.sql.includes('c.teacher_id=$2'));
});
test('a correction replaces the same teacher/course/date notice rather than adding conflicting duplicates',async()=>{
 const {service}=fixture();await service.save(teacher,body);await service.save(teacher,{...body,ipad_status:'not_needed'});
 const result=await service.list(teacher,body.study_date,body.study_date);assert.equal(result.length,1);assert.equal(result[0].ipad_status,'not_needed');assert.equal(result[0].can_edit,true);
});
test('owners and administrators can edit and cancel, while another teacher cannot',async()=>{
 const {service}=fixture();await service.save(teacher,body);
 await assert.rejects(service.save({id:9,role:'teacher'},body,1),{status:403});
 await assert.rejects(service.cancel({id:9,role:'teacher'},1),{status:403});
 await service.save(admin,{...body,ipad_status:'not_needed'},1);
 assert.equal((await service.list(teacher,body.study_date,body.study_date))[0].ipad_status,'not_needed');
 await service.cancel(teacher,1);assert.equal((await service.list(teacher,body.study_date,body.study_date)).length,0);
 await service.save(teacher,body);assert.equal((await service.list(teacher,body.study_date,body.study_date)).length,1);
});
test('read-only roles cannot cancel or list teaching courses',async()=>{
 const {service}=fixture();for(const role of ['student','parent','observer']){
  await assert.rejects(service.courses({id:7,role}),{status:403});await assert.rejects(service.cancel({id:7,role},1),{status:403});
 }
});
