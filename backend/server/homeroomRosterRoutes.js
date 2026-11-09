const {findHomeroomOwner,loadHomeroomRoster}=require('./homeroomDirectory');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function createHomeroomRosterHandlers({pool,ensureStudentInfoColumns}) {
 async function ownerFor(req,db=pool){
  const email=String(req.params.email||'').trim().toLowerCase();if(!email)throw fail(400,'Observer email is required.');
  const owner=await findHomeroomOwner(db,email);if(!owner)throw fail(403,'Homeroom selection is available to homeroom teachers only.');
  if(String(req.user.role).toLowerCase()!=='admin'&&Number(req.user.id)!==Number(owner.id))throw fail(403,'You may only manage your own homeroom.');
  return owner;
 }
 function sendError(res,error){if(!error.status)console.error('Homeroom roster:',error.message);return res.status(error.status||500).json({error:error.status?error.message:'Unable to load or save the homeroom roster.'});}
 async function list(req,res){try{
  await ensureStudentInfoColumns();const owner=await ownerFor(req);let students=await loadHomeroomRoster(pool,owner);
  const search=String(req.query?.search||'').trim().toLowerCase();if(search)students=students.filter(row=>[row.display_name,row.student_email,row.student_id,row.pen,row.current_homeform,row.current_grade].join(' ').toLowerCase().includes(search));
  return res.json({success:true,observer:owner,roster_scope:'all_school_students',students});
 }catch(error){return sendError(res,error);}}
 async function save(req,res){let client,started=false;try{
  const masterIds=req.body?.masterStudentIds??[],userIds=req.body?.studentUserIds??[];
  if(!Array.isArray(masterIds)||!Array.isArray(userIds)||[...masterIds,...userIds].some(id=>!Number.isSafeInteger(Number(id))||Number(id)<=0))throw fail(400,'A list of valid student IDs is required.');
  if(!Array.isArray(req.body?.masterStudentIds)&&!Array.isArray(req.body?.studentUserIds))throw fail(400,'A list of valid student IDs is required.');
  await ensureStudentInfoColumns();client=await pool.connect();const owner=await ownerFor(req,client);
  await client.query('BEGIN');started=true;await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[owner.id]);
  const roster=await loadHomeroomRoster(client,owner),selected=new Map();
  for(const id of [...new Set(masterIds.map(Number))]){const row=roster.find(student=>Number(student.master_student_id)===id);if(!row)throw fail(400,'A selected master student is not in the school directory.');selected.set(row.selection_key,row);}
  for(const id of [...new Set(userIds.map(Number))]){const row=roster.find(student=>Number(student.student_user_id)===id);if(!row)throw fail(400,'A selected student account is not in the school directory.');selected.set(row.selection_key,row);}
  const linked=[];
  for(const row of selected.values()){
   let id=row.student_user_id;
   if(!id){
    const email=String(row.student_email||'').trim().toLowerCase();if(!email)throw fail(400,'The selected student needs an email before linking.');
    const name=String(row.display_name||'Student').trim(),first=name.split(/\s+/)[0],last=name.split(/\s+/).slice(1).join(' ');
    const created=owner.school_id===null
      ? await client.query(`INSERT INTO users(name,first_name,last_name,email,role,student_id,password_hash)
        VALUES($1,$2,$3,$4,'student',$5,'STUDENT_PENDING_PASSWORD') ON CONFLICT(email) DO NOTHING RETURNING id`,[name,first,last,email,row.student_id||null])
      : await client.query(`INSERT INTO users(name,first_name,last_name,email,role,student_id,password_hash,school_id)
        VALUES($1,$2,$3,$4,'student',$5,'STUDENT_PENDING_PASSWORD',$6) ON CONFLICT(email) DO NOTHING RETURNING id`,[name,first,last,email,row.student_id||null,owner.school_id]);
    id=created.rows[0]?.id;
    if(!id){const existing=(await client.query("SELECT id FROM users WHERE LOWER(TRIM(email))=$1 AND role='student' AND NULLIF(to_jsonb(users)->>'school_id','')::integer IS NOT DISTINCT FROM $2",[email,owner.school_id])).rows[0];if(!existing)throw fail(400,'This email belongs to a different account. Contact an administrator.');id=existing.id;}
   }
   linked.push(id);
  }
  const ids=[...new Set(linked)];
  await client.query("UPDATE users SET observer_relationship='chinese_homeroom_teacher' WHERE id=$1",[owner.id]);
  for(const id of ids)await client.query(`INSERT INTO observer_student_links(observer_user_id,student_user_id,relationship,created_at,updated_at)
    VALUES($1,$2,'chinese_homeroom_teacher',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(observer_user_id,student_user_id) DO UPDATE SET relationship=EXCLUDED.relationship,updated_at=CURRENT_TIMESTAMP`,[owner.id,id]);
  await client.query("DELETE FROM observer_student_links WHERE observer_user_id=$1 AND relationship='chinese_homeroom_teacher' AND NOT(student_user_id=ANY($2::int[]))",[owner.id,ids]);
  await client.query('COMMIT');started=false;return res.json({success:true,linkedStudentIds:ids,linkedCount:ids.length});
 }catch(error){if(started)await client.query('ROLLBACK');return sendError(res,error);}finally{client?.release();}}
 return {list,save};
}
module.exports={createHomeroomRosterHandlers};
