const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../server/app'),'utf8');const start=source.indexOf('/* UPLOAD STUDENT ATTACHMENT FOR ASSIGNMENT */');const code=source.slice(start,source.indexOf('/* TEACHER IMPORT OF ASSIGNMENT',start));
test('late attachment route retains bytes for approval without creating a gradeable submission',async()=>{
 let handlers,heldInput,deleted,response;
 const state={late:true,pending:true,due:'2020-01-01'};
 const pool={async query(sql){if(sql.includes('FROM assignments'))return {rows:[{id:5,class_id:1,teacher_id:3}]};if(sql.includes('FROM users'))return {rows:[{id:10,name:'Student'}]};throw Error('Unexpected query: '+sql);},connect(){throw Error('Must not write gradeable submissions');}};
 vm.runInNewContext(code,{app:{post(_path,...h){handlers=h}},authenticateJWT:(_q,_s,next)=>next(),requireRole:()=>((_q,_s,next)=>next()),
  submissionDeadlines:{holdMiddleware:(_q,_s,next)=>next(),check:async()=>state},pool,
  heldSubmissions:{async hold(input){heldInput=input;return {success:true,pending_approval:true,submission_status:'awaiting_approval'};}},
  fs:{readFileSync:()=>Buffer.from('saved bytes'),unlink(file,callback){deleted=file;callback();}},console,
  ensureSubmissionAttachmentsTable:async()=>{},handleStudentAttachmentUpload:(_q,_s,next)=>next(),
  assignmentIsAvailableToStudents:()=>true,studentHasLiveCourseAccess:async()=>true});
 const req={params:{assignmentId:5},user:{id:10,role:'student',email:'student@test'},body:{},file:{path:'/temporary-upload',size:11,filename:'stored.txt',originalname:'work.txt',mimetype:'text/plain'}};
 const res={status(n){throw Error('Unexpected status '+n)},json(b){response=b;}};
 for(const handler of handlers){let next=false;await handler(req,res,()=>{next=true});if(!next)break;}
 assert.equal(response.pending_approval,true);assert.equal(heldInput.file.data.toString(),'saved bytes');assert.equal(heldInput.studentId,10);assert.equal(heldInput.studentEmail,'student@test');assert.equal(deleted,'/temporary-upload');
});
