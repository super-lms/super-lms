const {validatePeriod,courseMark}=require('./reportCards');
function validateExport(body={}) {
  if(!Array.isArray(body.courseIds))throw Error('Select the classes to export.');
  const ids=[...new Set(body.courseIds)].map(Number);
  if(!ids.length||ids.length>250||ids.some(id=>!Number.isInteger(id)||id<1))throw Error('Select between 1 and 250 classes.');
  if(!/^\d{4}-\d{4}$/.test(body.schoolYear)||Number(body.schoolYear.slice(5))!==Number(body.schoolYear.slice(0,4))+1)throw Error('Choose a valid school year.');
  if(!Array.isArray(body.periods)||!body.periods.length||body.periods.length>2)throw Error('Choose one or both semesters.');
  const periods=body.periods.map(p=>({...validatePeriod({type:'Semester',gradeBasis:'period',start:p.start,end:p.end}),label:p.label}));
  if(periods.some(p=>!['Semester 1','Semester 2'].includes(p.label)||p.start<`${body.schoolYear.slice(0,4)}-07-01`||p.end>`${body.schoolYear.slice(5)}-08-31`))throw Error('Semester dates must match the selected school year.');
  if(new Set(periods.map(p=>p.label)).size!==periods.length)throw Error('Choose distinct semesters.');
  if(periods.length===2&&periods[0].start<=periods[1].end&&periods[1].start<=periods[0].end)throw Error('Semester date ranges must not overlap.');
  return {courseIds:ids,schoolYear:body.schoolYear,periods};
}
function buildGradeSnapshot(courses,roster,assignments,submissions,config) {
  const byContent=new Map(),byClass=new Map(),byId=new Map(),byEmail=new Map();
  const add=(map,key,value)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(value)};
  for(const a of assignments)add(byContent,Number(a.class_id),a);
  for(const student of roster)add(byClass,Number(student.class_id),student);
  for(const submission of submissions){
    if(submission.student_id)add(byId,Number(submission.student_id),submission);
    if(submission.student_email)add(byEmail,String(submission.student_email).toLowerCase(),submission);
  }
  return courses.flatMap(course=>config.periods.map(period=>{
    const contentId=Number(course.master_course_id||course.id);
    const work=(byContent.get(contentId)||[]).filter(a=>(!a.cohort_id||Number(a.cohort_id)===Number(course.id))&&(!a.reporting_date||(a.reporting_date>=period.start&&a.reporting_date<=period.end)));
    const workIds=new Set(work.map(a=>Number(a.id)));
    const students=(byClass.get(Number(course.id))||[]).map(student=>{
      const evidence=[...(byId.get(Number(student.student_user_id))||[]),...(byEmail.get(String(student.student_email||'').toLowerCase())||[])].filter(s=>workIds.has(Number(s.assignment_id))).sort((a,b)=>Number(a.id)-Number(b.id));
      const latest=new Map();for(const s of evidence)latest.set(Number(s.assignment_id),s);
      const marks=work.map(a=>{
        const s=latest.get(Number(a.id));const raw=s?.score;
        const score=raw===null||raw===undefined||raw===''||!Number.isFinite(Number(raw))?null:Number(raw);
        let rubric=s?.rubric_selection||{};if(typeof rubric==='string'){try{rubric=JSON.parse(rubric)}catch{rubric={}}}
        const points=Number(a.points_possible)>0?Number(a.points_possible):100;
        const earned=score===null?null:rubric.pointsEarned!==null&&rubric.pointsEarned!==undefined&&rubric.pointsEarned!==''&&Number.isFinite(Number(rubric.pointsEarned))?Number(rubric.pointsEarned):Number((score*points/100).toFixed(4));
        return {assignment_id:a.id,score,points_earned:earned,points_possible:points,feedback:s?.feedback||''};
      });
      return {...student,...courseMark(work,evidence,student,period),marks};
    });
    return {course,period,assignments:work,students,undated_assignments:work.filter(a=>!a.reporting_date).length};
  }));
}
function createSchoolGradeExportRouter(pool) {
 const express=require('express');const {authenticateJWT,requireRole}=require('../middleware/auth');const router=express.Router();
 router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next()},authenticateJWT,requireRole('admin'));
 router.get('/courses',async(req,res)=>{try{
   const result=await pool.query(`SELECT c.id,c.title,c.master_course_id,c.master_title,c.section_code,c.is_live FROM courses c JOIN users actor ON actor.id=$1 WHERE c.school_id IS NOT DISTINCT FROM NULLIF(to_jsonb(actor)->>'school_id','')::integer ORDER BY c.title,c.id`,[req.user.id]);
   res.json({courses:result.rows});
 }catch(error){console.error('Grade export courses:',error.message);res.status(500).json({error:'Could not load school courses.'})}});
 router.post('/',createGradeExportHandler(pool));return router;
}
function createGradeExportHandler(pool){return async(req,res)=>{
   let config;try{config=validateExport(req.body)}catch(error){return res.status(400).json({error:error.message})}
   let client;try{
     client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
     const courses=await client.query(`SELECT c.id,c.title,c.master_course_id,c.master_title,c.section_code FROM courses c JOIN users actor ON actor.id=$2 WHERE c.id=ANY($1::int[]) AND c.school_id IS NOT DISTINCT FROM NULLIF(to_jsonb(actor)->>'school_id','')::integer AND EXISTS(SELECT 1 FROM courses content WHERE content.id=COALESCE(c.master_course_id,c.id) AND content.school_id IS NOT DISTINCT FROM c.school_id) ORDER BY c.title,c.id`,[config.courseIds,req.user.id]);
     if(courses.rows.length!==config.courseIds.length){await client.query('ROLLBACK');return res.status(403).json({error:'One or more selected classes are not available in your school.'})}
     const roster=await client.query(`SELECT DISTINCT ce.class_id,u.id AS student_user_id,COALESCE(NULLIF(TRIM(to_jsonb(u)->>'name'),''),NULLIF(TRIM(CONCAT_WS(' ',u.first_name,u.last_name)),''),u.email) AS student_name,u.email AS student_email,COALESCE(to_jsonb(u)->>'student_id','') AS student_id FROM class_enrollments ce JOIN users u ON u.id=ce.student_user_id WHERE ce.class_id=ANY($1::int[]) AND LOWER(u.role)='student' ORDER BY student_name,student_email`,[config.courseIds]);
     const contentIds=[...new Set(courses.rows.map(c=>Number(c.master_course_id||c.id)))];
     const assignments=await client.query(`SELECT a.id,a.class_id,a.cohort_id,a.title,a.due_date,a.points_possible,a.subcategory_id,cs.name AS subcategory_name,cc.name AS category_name,((cc.weight_percent*cs.weight_percent_of_parent)/100.0) AS course_weight_percent,TO_CHAR(COALESCE(a.due_date,(to_jsonb(a)->>'available_from')::timestamptz,(to_jsonb(a)->>'created_at')::timestamptz) AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS reporting_date FROM assignments a LEFT JOIN category_subcategories cs ON cs.id=a.subcategory_id LEFT JOIN course_categories cc ON cc.id=cs.course_category_id WHERE a.class_id=ANY($1::int[]) ORDER BY a.due_date NULLS LAST,a.id`,[contentIds]);
     const submissions=await client.query(`SELECT s.id,s.assignment_id,s.student_id,s.student_email,s.score,s.feedback,s.rubric_selection FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.class_id=ANY($1::int[]) AND (s.student_id=ANY($2::int[]) OR LOWER(s.student_email)=ANY($3::text[])) ORDER BY s.id`,[contentIds,[...new Set(roster.rows.map(s=>s.student_user_id))],[...new Set(roster.rows.map(s=>String(s.student_email||'').toLowerCase()))]]);
     const sheets=buildGradeSnapshot(courses.rows,roster.rows,assignments.rows,submissions.rows,config);
     await client.query('COMMIT');res.json({schoolYear:config.schoolYear,generatedAt:new Date().toISOString(),periods:config.periods,sheets});
   }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('School grade export:',error.message);res.status(500).json({error:'The complete grade report could not be generated. No partial export was created. Please retry.'})}finally{client?.release()}

};}

module.exports={validateExport,buildGradeSnapshot,createSchoolGradeExportRouter,createGradeExportHandler};
