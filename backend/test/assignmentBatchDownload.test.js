const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const JSZip=require('jszip');
const {once}=require('node:events');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createAssignmentBatchDownloadRouter,safeName,attachmentName,csvCell}=require('../server/routes/assignmentBatchDownload');

test('batch ZIP preserves written work and binary files, separates students, lists missing work and enforces class access',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'lms-batch-test-'));
 await fs.writeFile(path.join(directory,'legacy-file'),Buffer.from([0,255,22]));
 const calls=[],text='A letter\n\n你好，老师。\nFarewell.';
 let denied=false,foreign=false,oversized=false;
 const pool={async query(sql,params=[]){
  calls.push({sql,params});
  if(sql.startsWith('SELECT a.id,a.title'))return {rows:foreign?[]:[{id:7,title:'A letter / from class',class_id:100}]};
  if(sql.startsWith('SELECT c.id,c.title'))return {rows:[{id:101,title:'Class 10B',allowed:!denied&&!(params[2]==='teacher'&&params[3]===null)}]};
  if(sql.startsWith('SELECT id, title'))return {rows:[{id:101,title:'Class 10B'}]};
  if(sql.includes('STRING_AGG(DISTINCT c.title'))return {rows:[{student_user_id:1,section_title:'Class 10B'},{student_user_id:2,section_title:'Class 10B'}]};
  if(sql.startsWith('SELECT u.id AS student_user_id'))return {rows:[{student_user_id:1,student_name:'王同学',content:text},{student_user_id:2,student_name:'王同学',content:null}]};
  if(sql.startsWith('SELECT sa.id,sa.original_name'))return {rows:[{id:10,student_user_id:1,original_name:'../report.docx',stored_name:'database-file',size_bytes:oversized?99999:3},{id:11,student_user_id:2,original_name:'report.docx',stored_name:'missing-file',size_bytes:3},{id:12,student_user_id:2,original_name:'report.docx',stored_name:'legacy-file',size_bytes:3}]};
  if(sql.startsWith('SELECT file_data'))return {rows:[{file_data:params[0]===10?Buffer.from([1,2,254]):null}]};
  throw Error('Unexpected query');
 }};
 const app=express();app.use('/api/assignments',createAssignmentBatchDownloadRouter(pool,{uploadDir:directory,maxBytes:4096}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/assignments/7/batch-download`;
 const headers=role=>({Authorization:`Bearer ${jwt.sign({id:9,role},process.env.JWT_SECRET||'super-lms-development-secret-change-before-production')}`});
 async function download(query,role='teacher'){const params=new URLSearchParams(query);if(!params.has('sectionId'))params.set('sectionId','101');const res=await fetch(`${base}?${params}`,{headers:headers(role)});assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);return JSZip.loadAsync(await res.arrayBuffer());}
 try{
  assert.equal((await fetch(base)).status,401);
  assert.equal((await fetch(base,{headers:headers('student')})).status,403);
  assert.equal((await fetch(`${base}?kind=bad`,{headers:headers('teacher')})).status,400);
  assert.equal((await fetch(`${base}?sectionId=bad`,{headers:headers('teacher')})).status,400);
  denied=true;const count=calls.length;assert.equal((await fetch(`${base}?sectionId=101`,{headers:headers('teacher')})).status,403);assert.ok(!calls.slice(count).some(c=>c.sql.startsWith('SELECT u.id')));denied=false;
  assert.equal((await fetch(`${base}?sectionId=all`,{headers:headers('teacher')})).status,403);
  foreign=true;assert.equal((await fetch(base,{headers:headers('admin')})).status,404);foreign=false;
  const zip=await download('kind=all'),paths=Object.keys(zip.files).filter(n=>!zip.files[n].dir);
  assert.ok(paths.every(n=>!n.split('/').includes('..')));
  const written=paths.find(n=>n.endsWith('/王同学_1/Written response.txt'));
  assert.ok(written);assert.ok((await zip.file(written).async('string')).endsWith(text));
  assert.ok(!paths.some(n=>n.includes('王同学_2/Written response')));
  const binary=paths.find(n=>n.endsWith('/王同学_1/Attachments/10_report.docx'));
  assert.deepEqual(await zip.file(binary).async('nodebuffer'),Buffer.from([1,2,254]));
  const legacy=paths.find(n=>n.endsWith('/王同学_2/Attachments/12_report.docx'));
  assert.deepEqual(await zip.file(legacy).async('nodebuffer'),Buffer.from([0,255,22]));
  assert.ok(!paths.some(n=>n.endsWith('11_report.docx')));
  const manifest=await zip.file(paths.find(n=>n.endsWith('Submission list.csv'))).async('string');assert.match(manifest,/No written response/);assert.match(manifest,/report.docx/);
  const writtenOnly=await download('kind=written');assert.ok(!Object.keys(writtenOnly.files).some(n=>n.includes('/Attachments/')));
  const filesOnly=await download('kind=attachments');assert.ok(!Object.keys(filesOnly.files).some(n=>n.endsWith('Written response.txt')));
  await download('kind=all&sectionId=all','admin');
  oversized=true;assert.equal((await fetch(`${base}?kind=attachments&sectionId=101`,{headers:headers('teacher')})).status,413);oversized=false;
  const contentQuery=calls.find(c=>c.sql.startsWith('SELECT u.id AS student_user_id'));assert.deepEqual(contentQuery.params,[7,[1,2]]);assert.match(contentQuery.sql,/sub.student_id IS NULL AND LOWER/);assert.match(contentQuery.sql,/sub.id DESC LIMIT 1/);
  const fileQuery=calls.find(c=>c.sql.startsWith('SELECT sa.id'));assert.deepEqual(fileQuery.params,[7,[1,2]]);assert.match(fileQuery.sql,/u.id=ANY/);
  const rosterQuery=calls.find(c=>c.sql.includes('STRING_AGG(DISTINCT c.title'));assert.deepEqual(rosterQuery.params,[[101]],'only authorized selected section IDs feed the roster');
  assert.match(calls[0].sql,/school_id/);
 }finally{server.close();await once(server,'close');await fs.rm(directory,{recursive:true,force:true});}
});

test('ZIP filenames and CSV cells cannot introduce path traversal, overwrite duplicates or spreadsheet formulas',()=>{
 assert.equal(safeName('../Bad\u0000/Name'),'_Bad__Name');
 assert.ok(Buffer.byteLength(safeName('学生'.repeat(100)),'utf8')<=80);
 assert.equal(attachmentName({id:1,original_name:'..\\same.pdf'}),'1_same.pdf');
 assert.notEqual(attachmentName({id:1,original_name:'same.pdf'}),attachmentName({id:2,original_name:'same.pdf'}));
 assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');
});
