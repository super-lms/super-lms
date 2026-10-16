const MESSAGE='Your submission is not accepted due to being PAST DUE, speak with the teacher to get it approved.';
function pastDue(due,now=Date.now()){return !!due && Number.isFinite(Date.parse(due)) && now>Date.parse(due);}
function createSubmissionDeadline(pool){
 let ready;
 function ensure(){if(!ready)ready=pool.query(`CREATE TABLE IF NOT EXISTS assignment_late_blocked(assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,student_id INTEGER NOT NULL REFERENCES users(id),due_at TIMESTAMPTZ NOT NULL,first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),attempt_count INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(assignment_id,student_id,due_at)); CREATE TABLE IF NOT EXISTS assignment_late_permissions(id SERIAL PRIMARY KEY,assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,student_id INTEGER NOT NULL REFERENCES users(id),teacher_id INTEGER NOT NULL REFERENCES users(id),enabled BOOLEAN NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS assignment_late_permissions_lookup ON assignment_late_permissions(assignment_id,student_id,id DESC); CREATE TABLE IF NOT EXISTS assignment_late_acceptances(id SERIAL PRIMARY KEY,assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,student_id INTEGER NOT NULL REFERENCES users(id),submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,permission_id INTEGER REFERENCES assignment_late_permissions(id),due_at TIMESTAMPTZ NOT NULL,accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),method TEXT NOT NULL);`).catch(e=>{ready=null;throw e;});return ready;}
 async function check(assignmentId,studentId,{hold=false}={}){
  await ensure();
  const r=await pool.query('SELECT id,due_date FROM assignments WHERE id=$1',[assignmentId]);if(!r.rows.length)throw Object.assign(Error('Assignment not found'),{status:404});
  const due=r.rows[0].due_date;
  if(!pastDue(due))return {late:false};
  const p=await pool.query('SELECT * FROM assignment_late_permissions WHERE assignment_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 1',[assignmentId,studentId]);
  if(!p.rows[0]?.enabled && hold)return {late:true,pending:true,due};
  if(!p.rows[0]?.enabled)throw Object.assign(Error(MESSAGE),{status:403,code:'PAST_DUE'});
  return {late:true,due,permission_id:p.rows[0].id};
 }
 async function notifyBlocked(assignmentId,studentId,client=pool){
  await ensure();
  await client.query(`INSERT INTO assignment_late_blocked(assignment_id,student_id,due_at)
   SELECT a.id,$2,a.due_date FROM assignments a WHERE a.id=$1 AND a.due_date<NOW()
    AND EXISTS(SELECT 1 FROM class_enrollments ce JOIN courses c ON c.id=ce.class_id WHERE ce.student_user_id=$2 AND (ce.class_id=a.class_id OR c.master_course_id=a.class_id))
   ON CONFLICT(assignment_id,student_id,due_at) DO UPDATE SET last_attempt_at=NOW(),attempt_count=assignment_late_blocked.attempt_count+1`,[assignmentId,studentId]);
 }
 async function middleware(req,res,next,hold=false){try{if(req.user.role==='student')req.deadlineAcceptance=await check(Number(req.params.assignmentId),Number(req.user.id),{hold});next();}catch(e){if(e.code==='PAST_DUE'){try{await notifyBlocked(Number(req.params.assignmentId),Number(req.user.id));}catch(noticeError){console.error('Unable to record blocked submission notice',noticeError.message);}}res.status(e.status||500).json({error:e.status?e.message:'Unable to check the assignment deadline. Please try again.',code:e.code});}}
 async function record(state,assignmentId,studentId,submissionId,method,client=pool){if(!state?.late)return;await client.query('INSERT INTO assignment_late_acceptances(assignment_id,student_id,submission_id,permission_id,due_at,method) VALUES($1,$2,$3,$4,$5,$6)',[assignmentId,studentId,submissionId,state.permission_id,state.due,method]);}
 return {ensure,check,middleware,holdMiddleware:(req,res,next)=>middleware(req,res,next,true),record,notifyBlocked};
}
module.exports={createSubmissionDeadline,pastDue,MESSAGE};
