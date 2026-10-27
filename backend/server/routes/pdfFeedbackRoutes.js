const express=require('express');
const fs=require('node:fs/promises'),path=require('node:path');
const {authenticateJWT,requireRole}=require('../../middleware/auth');
const fail=(status,message)=>Object.assign(Error(message),{status});
function validateMarkup(value){
 if(!Array.isArray(value)||value.length>20000)throw fail(400,'Too many marks. Save a smaller set of annotations.');
 let count=0;
 return value.map(s=>{if(!Number.isInteger(s.page)||s.page<1||s.page>2000||!['pen','highlight'].includes(s.tool)||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.width)||s.width<0.0001||s.width>0.1||!Array.isArray(s.points)||!s.points.length)throw fail(400,'Invalid PDF marks.');count+=s.points.length;if(count>300000)throw fail(413,'Too many drawing points.');
 const points=s.points.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1))throw fail(400,'Invalid drawing coordinates.');return p});return {page:s.page,tool:s.tool,color:s.color,width:s.width,points};});
}
function createPdfFeedbackRouter(pool,{uploadDir,ensureAttachments=async()=>{}}={}){
 const router=express.Router();let ready;
 const ensure=()=>ready||(ready=pool.query(`CREATE TABLE IF NOT EXISTS teacher_pdf_feedback(id SERIAL PRIMARY KEY,attachment_id INTEGER NOT NULL REFERENCES submission_attachments(id) ON DELETE RESTRICT,version INTEGER NOT NULL,marks JSONB NOT NULL,pdf_data BYTEA NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(attachment_id,version))`).catch(e=>{ready=null;throw e}));
 router.use(authenticateJWT,requireRole('admin','teacher','student'),(req,res,next)=>{res.set('Cache-Control','private, no-store');next()});
 const wrap=fn=>async(req,res)=>{try{await ensureAttachments();await ensure();await fn(req,res)}catch(e){if(!e.status)console.error('PDF feedback:',e.message);res.status(e.status||500).json({error:e.status?e.message:'Could not load or save PDF feedback. Please retry.'})}};
 async function access(req,id,client=pool){
 if(!Number.isSafeInteger(id)||id<1)throw fail(400,'Choose a valid PDF attachment.');
 const a=(await client.query(`SELECT sa.*,s.student_id,a.class_id,a.cohort_id FROM submission_attachments sa JOIN submissions s ON s.id=sa.submission_id JOIN assignments a ON a.id=sa.assignment_id JOIN courses root ON root.id=a.class_id JOIN users actor ON actor.id=$2 WHERE sa.id=$1 AND root.school_id IS NOT DISTINCT FROM NULLIF(to_jsonb(actor)->>'school_id','')::integer`,[id,req.user.id])).rows[0];
 if(!a)throw fail(404,'PDF attachment not available.');
 if(req.user.role==='student'){if(Number(a.student_id)!==Number(req.user.id))throw fail(403,'This feedback belongs to another student.');}
 else if(req.user.role!=='admin'){
 const allowed=await client.query(`SELECT 1 FROM courses c JOIN class_enrollments ce ON ce.class_id=c.id WHERE ce.student_user_id=$2 AND COALESCE(c.master_course_id,c.id)=$1 AND ($4::integer IS NULL OR c.id=$4) AND (c.teacher_id=$3 OR EXISTS(SELECT 1 FROM courses m WHERE m.id=c.master_course_id AND m.teacher_id=$3) OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$3)) LIMIT 1`,[a.class_id,a.student_id,req.user.id,a.cohort_id]);if(!allowed.rows.length)throw fail(403,'Choose a student in a class you teach.');}
 if(a.mime_type!=='application/pdf'&&!String(a.original_name).toLowerCase().endsWith('.pdf'))throw fail(400,'Marking is available for PDF files.');return a;
 }
 const latest=async(id,client=pool)=>(await client.query('SELECT id,version,marks,created_at FROM teacher_pdf_feedback WHERE attachment_id=$1 ORDER BY version DESC LIMIT 1',[id])).rows[0];
 router.get('/attachments/:attachmentId',wrap(async(req,res)=>{const a=await access(req,Number(req.params.attachmentId));const saved=await latest(a.id);res.json({name:a.original_name,version:saved?.version||0,marks:saved?.marks||[],saved_at:saved?.created_at||null})}));
 router.get('/attachments/:attachmentId/source',requireRole('admin','teacher'),wrap(async(req,res)=>{const a=await access(req,Number(req.params.attachmentId));let bytes=a.file_data;if(!bytes?.length){try{bytes=await fs.readFile(path.join(uploadDir,path.basename(a.stored_name)))}catch{throw fail(410,'The original PDF is unavailable. Ask the student to upload it again.')}}res.type('application/pdf').send(bytes)}));
 router.get('/attachments/:attachmentId/pdf',wrap(async(req,res)=>{const a=await access(req,Number(req.params.attachmentId));const r=(await pool.query('SELECT pdf_data FROM teacher_pdf_feedback WHERE attachment_id=$1 ORDER BY version DESC LIMIT 1',[a.id])).rows[0];if(!r)throw fail(404,'No marked PDF has been saved yet.');res.set('Content-Disposition',`attachment; filename="Marked-feedback-${a.id}.pdf"`).type('application/pdf').send(r.pdf_data)}));
 router.post('/attachments/:attachmentId',requireRole('admin','teacher'),wrap(async(req,res)=>{
 const marks=validateMarkup(req.body.marks),expected=req.body.version;
 if(!Number.isInteger(expected)||expected<0||typeof req.body.pdf!=='string'||req.body.pdf.length>42*1024*1024||! /^[A-Za-z0-9+/]*={0,2}$/.test(req.body.pdf))throw fail(400,'Send a valid marked PDF, up to 30 MB.');
 const bytes=Buffer.from(req.body.pdf,'base64');if(bytes.length>30*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-2048).toString().includes('%%EOF'))throw fail(400,'The marked copy must be a complete PDF up to 30 MB.');
 const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(78233,$1::integer)',[Number(req.params.attachmentId)]);const a=await access(req,Number(req.params.attachmentId),client);const previous=await latest(a.id,client);if((previous?.version||0)!==expected)throw fail(409,'Another teacher saved feedback. Download your marked copy, then close and reopen to load the latest feedback.');
 await client.query('INSERT INTO teacher_pdf_feedback(attachment_id,version,marks,pdf_data,created_by) VALUES($1,$2,$3::jsonb,$4,$5)',[a.id,expected+1,JSON.stringify(marks),bytes,req.user.id]);await client.query('COMMIT');res.json({success:true,version:expected+1});}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 }));
 router.get('/assignments/:assignmentId',wrap(async(req,res)=>{
 const id=Number(req.params.assignmentId);if(!Number.isSafeInteger(id)||id<1)throw fail(400,'Choose an assignment.');
 // Students only receive their own attachment IDs; each file download checks access again.
 if(req.user.role!=='student')throw fail(403,'Open a student PDF from speed grading.');
 const rows=(await pool.query(`SELECT DISTINCT ON(sa.id) sa.id AS attachment_id,sa.original_name,f.version,f.created_at FROM teacher_pdf_feedback f JOIN submission_attachments sa ON sa.id=f.attachment_id JOIN submissions s ON s.id=sa.submission_id WHERE sa.assignment_id=$1 AND s.student_id=$2 ORDER BY sa.id,f.version DESC`,[id,req.user.id])).rows;res.json({files:rows});
 }));return router;
}
module.exports={createPdfFeedbackRouter,validateMarkup};
