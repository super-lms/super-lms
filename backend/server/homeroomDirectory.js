// School-wide read-only directory for designated homeroom staff. Does not create links or accounts.
async function loadHomeroomDirectory(pool,email) {
 const owner=(await pool.query(`SELECT u.id,NULLIF(to_jsonb(u)->>'school_id','')::integer AS school_id
   FROM users u WHERE LOWER(TRIM(u.email))=$1 AND LOWER(TRIM(u.role))='observer'
   AND (LOWER(TRIM(u.observer_relationship))='chinese_homeroom_teacher' OR EXISTS(
     SELECT 1 FROM observer_student_links l WHERE l.observer_user_id=u.id AND l.relationship='chinese_homeroom_teacher')) LIMIT 1`,[email])).rows[0];
 if(!owner)return null;
 const rows=(await pool.query(`SELECT ms.id AS master_student_id,
   COALESCE(NULLIF(TRIM(ms.display_name),''),NULLIF(TRIM(CONCAT_WS(' ',u.first_name,u.last_name)),''),'Student') AS student_name,
   LOWER(TRIM(COALESCE(ms.student_email,''))) AS student_email,ms.student_id,u.id AS student_user_id,
   EXISTS(SELECT 1 FROM observer_student_links l WHERE l.observer_user_id=$1 AND l.student_user_id=u.id
     AND l.relationship='chinese_homeroom_teacher') AS in_homeroom,
   c.id AS class_id,c.title AS class_name,t.id AS teacher_user_id,t.email AS teacher_email,
   COALESCE(NULLIF(TRIM(CONCAT_WS(' ',t.first_name,t.last_name)),''),t.name,t.email,'') AS teacher_name
   FROM master_students ms LEFT JOIN users u ON LOWER(TRIM(u.email))=LOWER(TRIM(ms.student_email)) AND LOWER(u.role)='student'
   LEFT JOIN (class_enrollments ce JOIN courses c ON c.id=ce.class_id AND c.is_live=TRUE) ON ce.student_user_id=u.id
   LEFT JOIN users t ON t.id=c.teacher_id
   WHERE LOWER(TRIM(COALESCE(ms.status,'active')))='active'
     AND COALESCE(NULLIF(to_jsonb(ms)->>'school_id','')::integer,NULLIF(to_jsonb(u)->>'school_id','')::integer) IS NOT DISTINCT FROM $2
   ORDER BY student_name,ms.id,c.title`,[owner.id,owner.school_id])).rows;
 return {source:'homeroom_directory',rows,studentUserIds:[...new Set(rows.filter(row=>row.in_homeroom).map(row=>row.student_user_id).filter(Boolean))]};
}
module.exports={loadHomeroomDirectory};
