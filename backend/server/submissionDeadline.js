const MESSAGE='Your submission is not accepted due to being PAST DUE, speak with the teacher to get it approved.';
function pastDue(due,now=Date.now()){return !!due && Number.isFinite(Date.parse(due)) && now>Date.parse(due);}
function createSubmissionDeadline(pool){
 let ready;
 function ensure(){if(!ready)ready=pool.query(`CREATE TABLE IF NOT EXISTS assignment_late_permissions(id SERIAL PRIMARY KEY,assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,student_id INTEGER NOT NULL REFERENCES users(id),teacher_id INTEGER NOT NULL REFERENCES users(id),enabled BOOLEAN NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS assignment_late_permissions_lookup ON assignment_late_permissions(assignment_id,student_id,id DESC); CREATE TABLE IF NOT EXISTS assignment_late_acceptances(id SERIAL PRIMARY KEY,assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,student_id INTEGER NOT NULL REFERENCES users(id),submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,permission_id INTEGER REFERENCES assignment_late_permissions(id),due_at TIMESTAMPTZ NOT NULL,accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),method TEXT NOT NULL);`).catch(e=>{ready=null;throw e;});return ready;}
 async function check(assignmentId,studentId){
  await ensure();
  const r=await pool.query('SELECT id,due_date FROM assignments WHERE id=$1',[assignmentId]);if(!r.rows.length)throw Object.assign(Error('Assignment not found'),{status:404});
  const due=r.rows[0].due_date;
  if(!pastDue(due))return {late:false};
  const p=await pool.query('SELECT * FROM assignment_late_permissions WHERE assignment_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 1',[assignmentId,studentId]);
  if(!p.rows[0]?.enabled)throw Object.assign(Error(MESSAGE),{status:403,code:'PAST_DUE'});
  return {late:true,due,permission_id:p.rows[0].id};
 }
 async function middleware(req,res,next){try{if(req.user.role==='student')req.deadlineAcceptance=await check(Number(req.params.assignmentId),Number(req.user.id));next();}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to check the assignment deadline. Please try again.',code:e.code});}}
 async function record(state,assignmentId,studentId,submissionId,method,client=pool){if(!state?.late)return;await client.query('INSERT INTO assignment_late_acceptances(assignment_id,student_id,submission_id,permission_id,due_at,method) VALUES($1,$2,$3,$4,$5,$6)',[assignmentId,studentId,submissionId,state.permission_id,state.due,method]);}
 return {ensure,check,middleware,record};
}
module.exports={createSubmissionDeadline,pastDue,MESSAGE};
