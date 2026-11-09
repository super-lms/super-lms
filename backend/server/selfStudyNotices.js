const fail = (status, message) => Object.assign(new Error(message), { status });
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
function validateNotice(body) {
  const studyDate=body.start_date || body.study_date;
  if (!dateValid(studyDate)) throw fail(400, 'Choose a valid self-study date.');
  const courseId = Number(body.course_id);
  if (!Number.isSafeInteger(courseId) || courseId < 1) throw fail(400, 'Choose a course.');
  if (!['needed', 'not_needed'].includes(body.ipad_status)) throw fail(400, 'Choose whether students need an iPad.');
  const notes = String(body.notes || '').trim();
  if (notes.length > 1000) throw fail(400, 'Keep the note to 1,000 characters.');
  return { study_date: studyDate, course_id: courseId, ipad_status: body.ipad_status, notes };
}
function validateRange(from, to) {
  if (!dateValid(from) || !dateValid(to) || from > to || (Date.parse(to)-Date.parse(from))/86400000 > 6) throw fail(400, 'Choose a day or a week of up to seven days.');
  return { from, to };
}
function createSelfStudyNotices(pool) {
  let ready;
  const ensure = () => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS self_study_ipad_notices (
    id SERIAL PRIMARY KEY, school_id INTEGER, course_id INTEGER NOT NULL REFERENCES courses(id),
    teacher_id INTEGER NOT NULL REFERENCES users(id), study_date DATE NOT NULL,
    ipad_status TEXT NOT NULL CHECK(ipad_status IN('needed','not_needed')), notes TEXT NOT NULL DEFAULT '',
    cancelled_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id,teacher_id,study_date))`).catch(error => { ready = null; throw error; }));
  async function scope(user) {
    if (!['admin','teacher','observer','parent','student'].includes(user.role)) throw fail(403, 'This calendar is not available to this account.');
    const row = (await pool.query("SELECT NULLIF(to_jsonb(u)->>'school_id','')::integer AS school_id FROM users u WHERE u.id=$1", [user.id])).rows[0];
    if (!row) throw fail(403, 'Account unavailable.');
    return row.school_id;
  }
  const courseScope = `NULLIF(to_jsonb(c)->>'school_id','')::integer IS NOT DISTINCT FROM $1`;
  const teacherAccess = `(c.teacher_id=$2 OR EXISTS(SELECT 1 FROM courses m WHERE m.id=c.master_course_id AND m.teacher_id=$2)
    OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$2))`;
  const staff = user => { if (!['admin','teacher'].includes(user.role)) throw fail(403, 'Only teachers can post self-study notices.'); };
  async function courses(user) {
    staff(user); const school = await scope(user);
    return (await pool.query(`SELECT c.id,c.title FROM courses c WHERE ${courseScope} AND ($3='admin' OR ${teacherAccess}) ORDER BY c.title,c.id`, [school,user.id,user.role])).rows;
  }
  async function authorizeCourse(user, courseId, school) {
    const allowed = await pool.query(`SELECT c.id FROM courses c WHERE c.id=$4 AND ${courseScope} AND ($3='admin' OR ${teacherAccess})`, [school,user.id,user.role,courseId]);
    if (!allowed.rows.length) throw fail(403, 'Choose a course you teach.');
  }
  async function list(user, from, to) {
    validateRange(from,to); const school = await scope(user); await ensure();
    return (await pool.query(`SELECT n.id,n.course_id,n.teacher_id,to_char(n.study_date,'YYYY-MM-DD') AS study_date,n.ipad_status,n.notes,n.updated_at,
      c.title AS course_title,COALESCE(NULLIF(TRIM(t.name),''),NULLIF(TRIM(CONCAT_WS(' ',t.first_name,t.last_name)),''),'Teacher') AS teacher_name,
      ($4='admin' OR n.teacher_id=$5) AS can_edit
      FROM self_study_ipad_notices n JOIN courses c ON c.id=n.course_id JOIN users t ON t.id=n.teacher_id
      WHERE n.school_id IS NOT DISTINCT FROM $1 AND n.study_date BETWEEN $2::date AND $3::date AND n.cancelled_at IS NULL
      ORDER BY n.study_date,c.title,teacher_name,n.id`, [school,from,to,user.role,user.id])).rows;
  }
  async function save(user, body, id = null) {
    staff(user); const notice = validateNotice(body);
    const from=notice.study_date,to=body.end_date || from;
    if(!dateValid(to) || from>to || (Date.parse(to)-Date.parse(from))/86400000>30)throw fail(400,'Choose a valid start and end date covering up to 31 days.');
    if(id !== null && from !== to)throw fail(400,'Edit one existing notice at a time. Post a new date range to update several days.');
    const school = await scope(user); await ensure();
    if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw fail(400, 'Choose a valid notice.');
    await authorizeCourse(user,notice.course_id,school);
    if (id !== null) {
      const result = await pool.query(`UPDATE self_study_ipad_notices SET course_id=$1,study_date=$2,ipad_status=$3,notes=$4,updated_at=NOW()
        WHERE id=$5 AND school_id IS NOT DISTINCT FROM $6 AND ($7='admin' OR teacher_id=$8) AND cancelled_at IS NULL RETURNING id`,
        [notice.course_id,notice.study_date,notice.ipad_status,notice.notes,id,school,user.role,user.id]);
      if (!result.rows.length) throw fail(403, 'This notice is not available to edit.');
      return result.rows[0];
    }
    if(from !== to) {
      const result=await pool.query(`INSERT INTO self_study_ipad_notices(school_id,course_id,teacher_id,study_date,ipad_status,notes)
        SELECT $1,$2,$3,day::date,$5,$6 FROM generate_series($4::date,$7::date,INTERVAL '1 day') AS day
        ON CONFLICT(course_id,teacher_id,study_date) DO UPDATE
        SET ipad_status=EXCLUDED.ipad_status,notes=EXCLUDED.notes,cancelled_at=NULL,updated_at=NOW() RETURNING id`,
        [school,notice.course_id,user.id,from,notice.ipad_status,notice.notes,to]);
      return {ids:result.rows.map(row=>row.id),count:result.rows.length};
    }
    return (await pool.query(`INSERT INTO self_study_ipad_notices(school_id,course_id,teacher_id,study_date,ipad_status,notes)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(course_id,teacher_id,study_date) DO UPDATE
      SET ipad_status=EXCLUDED.ipad_status,notes=EXCLUDED.notes,cancelled_at=NULL,updated_at=NOW() RETURNING id`,
      [school,notice.course_id,user.id,notice.study_date,notice.ipad_status,notice.notes])).rows[0];
  }
  async function cancel(user,id) {
    staff(user); if (!Number.isSafeInteger(id) || id<1) throw fail(400,'Choose a valid notice.');
    const school=await scope(user); await ensure();
    const result=await pool.query(`UPDATE self_study_ipad_notices SET cancelled_at=NOW(),updated_at=NOW()
      WHERE id=$1 AND school_id IS NOT DISTINCT FROM $2 AND ($3='admin' OR teacher_id=$4) AND cancelled_at IS NULL RETURNING id`,[id,school,user.role,user.id]);
    if (!result.rows.length) throw fail(403,'This notice is not available to cancel.');
    return result.rows[0];
  }
  return { courses,list,save,cancel };
}
module.exports={createSelfStudyNotices,validateNotice,validateRange};
