const {findHomeroomOwner,loadHomeroomRoster}=require('./homeroomDirectory');
const grades={'bobliang@cbcschools.ca':10,'miawang@cbcschools.ca':10,'sparrowzhao@cbcschools.ca':11,'venchiwu@cbcschools.ca':11,'richiexu@cbcschools.ca':12,'garfieldchen@cbcschools.ca':12};
function assignedGrade(email){return grades[String(email||'').trim().toLowerCase()]||null;}
function createHomeroomGradebook({pool,readGradebook}) {
 async function scope(req){
  const email=String(req.user.email||'').trim().toLowerCase(),grade=assignedGrade(email);
  const owner=grade?await findHomeroomOwner(pool,email):null;
  if(!owner)throw Object.assign(Error('Course gradebooks are available only to designated homeroom teachers.'),{status:403});
  const roster=(await loadHomeroomRoster(pool,owner)).filter(s=>Number(String(s.current_grade||'').replace(/\D/g,''))===grade&&s.student_user_id);
  const ids=roster.map(s=>s.student_user_id);
  const courses=ids.length?(await pool.query(`SELECT DISTINCT c.id,c.title FROM courses c JOIN class_enrollments ce ON ce.class_id=c.id
   WHERE ce.student_user_id=ANY($1::int[]) AND c.is_live=TRUE
   AND NULLIF(to_jsonb(c)->>'school_id','')::integer IS NOT DISTINCT FROM $2 ORDER BY c.title`,[ids,owner.school_id])).rows:[];
  return {grade,ids,courses};
 }
 function fail(res,e){return res.status(e.status||500).json({error:e.status?e.message:'Unable to load course gradebook.'});}
 return {
  courses:async(req,res)=>{try{const s=await scope(req);return res.json({grade:s.grade,courses:s.courses});}catch(e){return fail(res,e);}},
  gradebook:async(req,res)=>{try{
   const s=await scope(req),id=Number(req.params.classId);
   if(!s.courses.some(c=>Number(c.id)===id))return res.status(403).json({error:'This course is outside your assigned grade.'});
   const response={status:code=>{res.status(code);return response;},json:data=>res.json(data.students?{...data,students:data.students.filter(student=>s.ids.includes(Number(student.student_user_id))),read_only:true,grade:s.grade}:data)};
   return readGradebook(req,response);
  }catch(e){return fail(res,e);}}
 };
}
module.exports={assignedGrade,createHomeroomGradebook};
