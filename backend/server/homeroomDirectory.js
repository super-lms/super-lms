// Shared source for viewing students and selecting a homeroom. Reads never create accounts or links.
async function findHomeroomOwner(pool,email) {
 return (await pool.query(`SELECT u.id,u.name,u.email,u.role,u.observer_relationship,
   NULLIF(to_jsonb(u)->>'school_id','')::integer AS school_id
   FROM users u WHERE LOWER(TRIM(u.email))=$1 AND LOWER(TRIM(u.role))='observer'
   AND (LOWER(TRIM(u.observer_relationship))='chinese_homeroom_teacher' OR EXISTS(
     SELECT 1 FROM observer_student_links l WHERE l.observer_user_id=u.id AND l.relationship='chinese_homeroom_teacher')) LIMIT 1`,[email])).rows[0] || null;
}
async function loadHomeroomRoster(pool,owner) {
 return (await pool.query(`WITH accounts AS (
   SELECT u.id AS student_user_id,m.id AS master_student_id,
     COALESCE(NULLIF(TRIM(m.display_name),''),NULLIF(TRIM(u.name),''),NULLIF(TRIM(CONCAT_WS(' ',u.first_name,u.last_name)),''),u.email,'Student') AS display_name,
     LOWER(TRIM(u.email)) AS student_email,COALESCE(NULLIF(TRIM(u.student_id),''),m.student_id) AS student_id,
     to_jsonb(m)->>'pen' AS pen,
     COALESCE(to_jsonb(m)->>'current_grade',to_jsonb(u)->>'current_grade',to_jsonb(u)->>'grade') AS current_grade,
     COALESCE(to_jsonb(m)->>'current_homeform',to_jsonb(u)->>'current_homeform',to_jsonb(u)->>'homeform') AS current_homeform,
     COALESCE(m.status,'active') AS status
   FROM users u LEFT JOIN LATERAL (
     SELECT ms.* FROM master_students ms
     WHERE NULLIF(to_jsonb(ms)->>'school_id','')::integer IS NOT DISTINCT FROM $2
       AND ((NULLIF(TRIM(ms.student_email),'') IS NOT NULL AND LOWER(TRIM(ms.student_email))=LOWER(TRIM(u.email)))
         OR (NULLIF(TRIM(ms.student_id),'') IS NOT NULL AND TRIM(ms.student_id)=TRIM(u.student_id)))
     ORDER BY CASE WHEN LOWER(TRIM(ms.student_email))=LOWER(TRIM(u.email)) THEN 0 ELSE 1 END,ms.id LIMIT 1
   ) m ON TRUE
   WHERE LOWER(TRIM(u.role))='student'
     AND NULLIF(to_jsonb(u)->>'school_id','')::integer IS NOT DISTINCT FROM $2
     AND COALESCE(to_jsonb(u)->>'is_active','true') NOT IN ('false','0')
 ), directory AS (
   SELECT * FROM accounts
   UNION ALL
   SELECT NULL::integer,ms.id,ms.display_name,LOWER(TRIM(COALESCE(ms.student_email,''))),ms.student_id,
     to_jsonb(ms)->>'pen',to_jsonb(ms)->>'current_grade',to_jsonb(ms)->>'current_homeform',ms.status
   FROM master_students ms
   WHERE LOWER(TRIM(COALESCE(ms.status,'active')))='active'
     AND NULLIF(to_jsonb(ms)->>'school_id','')::integer IS NOT DISTINCT FROM $2
     AND NOT EXISTS(SELECT 1 FROM accounts a WHERE a.master_student_id=ms.id
       OR (NULLIF(TRIM(ms.student_email),'') IS NOT NULL AND a.student_email=LOWER(TRIM(ms.student_email)))
       OR (NULLIF(TRIM(ms.student_id),'') IS NOT NULL AND a.student_id=TRIM(ms.student_id)))
 ) SELECT d.*,
   CASE WHEN d.student_user_id IS NOT NULL THEN 'user:'||d.student_user_id ELSE 'master:'||d.master_student_id END AS selection_key,
   EXISTS(SELECT 1 FROM observer_student_links l WHERE l.observer_user_id=$1 AND l.student_user_id=d.student_user_id
     AND l.relationship='chinese_homeroom_teacher') AS already_linked
 FROM directory d WHERE LOWER(TRIM(COALESCE(d.status,'active'))) NOT IN ('inactive','withdrawn','graduated','deleted')
 ORDER BY d.current_grade,d.current_homeform,d.display_name,d.student_user_id,d.master_student_id`,[owner.id,owner.school_id])).rows;
}
async function loadHomeroomDirectory(pool,email) {
 const owner=await findHomeroomOwner(pool,email);if(!owner)return null;
 const students=await loadHomeroomRoster(pool,owner);
 const ids=students.map(student=>student.student_user_id).filter(Boolean);
 const courses=ids.length?(await pool.query(`SELECT ce.student_user_id,c.id AS class_id,c.title AS class_name,
   t.id AS teacher_user_id,t.email AS teacher_email,
   COALESCE(NULLIF(TRIM(CONCAT_WS(' ',t.first_name,t.last_name)),''),t.name,t.email,'') AS teacher_name
   FROM class_enrollments ce JOIN courses c ON c.id=ce.class_id AND c.is_live=TRUE
   LEFT JOIN users t ON t.id=c.teacher_id WHERE ce.student_user_id=ANY($1::int[])
   AND NULLIF(to_jsonb(c)->>'school_id','')::integer IS NOT DISTINCT FROM $2 ORDER BY c.title`,[ids,owner.school_id])).rows:[];
 const byStudent=new Map();for(const course of courses){if(!byStudent.has(course.student_user_id))byStudent.set(course.student_user_id,[]);byStudent.get(course.student_user_id).push(course);}
 const rows=students.flatMap(student=>(byStudent.get(student.student_user_id)||[{class_id:null,class_name:null}]).map(course=>({...student,student_name:student.display_name,in_homeroom:student.already_linked,...course})));
 return {source:'homeroom_directory',rows,studentUserIds:[...new Set(students.filter(row=>row.already_linked).map(row=>row.student_user_id).filter(Boolean))]};
}
module.exports={findHomeroomOwner,loadHomeroomRoster,loadHomeroomDirectory};
