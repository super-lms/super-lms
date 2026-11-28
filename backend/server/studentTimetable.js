const schedule=require('./semesterTimetable.json');
const {findHomeroomOwner,loadHomeroomRoster}=require('./homeroomDirectory');
const {assignedGrade}=require('./homeroomGradebook');
function normalize(value){return String(value||'').toLowerCase().replace(/team teach with dr\. b\.?/g,'').replace(/accounting 11 for grade 12s/g,'accounting11for12s').replace(/physical\s*geog(?:raphy)?|pgeo/g,'geography').replace(/pre[- ]?cal(?:culus)?/g,'precalculus').replace(/acct/g,'accounting').replace(/chem(?!istry)/g,'chemistry').replace(/[^a-z0-9]/g,'');}
function matchCourse(title,entry){const key=normalize(title);return normalize(entry.course)===key||(entry.course.includes('/')&&['Spoken Language','New Media'].some(prefix=>normalize(prefix+' '+entry.course.match(/10\s*[ABCD]/i)?.[0])===key));}
function blocksFor(courses){return [1,2,3,4].map(block=>({block,courses:courses.flatMap(c=>schedule.entries.filter(e=>e.block===block&&matchCourse(c.title,e)).map(e=>({course:c.title,teacher:e.teacher,room:e.room}))).filter((v,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(v))===i)}));}
function createStudentTimetable({pool}){return async(req,res)=>{try{
 const query=String(req.query.q||'').trim();if(query.length<2)return res.json({students:[],...schedule,entries:undefined});
 const role=String(req.user.role).toLowerCase();let ids=null;
 if(role==='observer'){
  const grade=assignedGrade(req.user.email),owner=grade?await findHomeroomOwner(pool,String(req.user.email).toLowerCase()):null;
  if(!owner)return res.status(403).json({error:'Timetable lookup is available to designated homeroom teachers only.'});
  ids=(await loadHomeroomRoster(pool,owner)).filter(s=>Number(String(s.current_grade||'').replace(/\D/g,''))===grade).map(s=>s.student_user_id).filter(Boolean);
 }
 const result=await pool.query(`SELECT u.id,u.name,u.email FROM users u JOIN users viewer ON viewer.id=$1
 WHERE LOWER(u.role)='student' AND NULLIF(to_jsonb(u)->>'school_id','')::integer IS NOT DISTINCT FROM NULLIF(to_jsonb(viewer)->>'school_id','')::integer
 AND ($3::int[] IS NULL OR u.id=ANY($3::int[]))
 AND (COALESCE(u.name,'') ILIKE $2 OR u.email ILIKE $2 OR CONCAT_WS(' ',u.first_name,u.last_name) ILIKE $2)
 ORDER BY u.name,u.id LIMIT 12`,[req.user.id,'%'+query.replace(/[\\%_]/g,'\\$&')+'%',ids]);
 const students=[];
 for(const student of result.rows){const courses=(await pool.query(`SELECT c.title FROM class_enrollments ce JOIN courses c ON c.id=ce.class_id WHERE ce.student_user_id=$1 AND c.is_live=TRUE`,[student.id])).rows;students.push({...student,blocks:blocksFor(courses),unmatched:courses.filter(c=>!schedule.entries.some(e=>matchCourse(c.title,e))).map(c=>c.title)});}
 return res.json({students,semester:schedule.semester,schoolYear:schedule.schoolYear});
 }catch(e){console.error('Student timetable lookup:',e.message);return res.status(500).json({error:'Unable to load student timetables.'});}};}
module.exports={normalize,matchCourse,blocksFor,createStudentTimetable};
