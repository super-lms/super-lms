const email = value => String(value || '').trim().toLowerCase();
const graded = row => row.score !== null && row.score !== undefined && row.score !== '' && Number.isFinite(Number(row.score));
function gradebookSubmissionIndex(rows) {
 const byStudent=new Map(), legacyByEmail=new Map();
 // A later blank duplicate must not erase an existing mark; among marked records use the latest ID.
 const sorted=[...rows].sort((a,b)=>Number(graded(b))-Number(graded(a)) || Number(b.id)-Number(a.id));
 for(const row of sorted){
  const map=row.student_id?byStudent:legacyByEmail;
  const key=`${row.student_id || email(row.student_email)}:${row.assignment_id}`;
  if(!map.has(key))map.set(key,row);
 }
 return {get(student,assignmentId){return byStudent.get(`${student.student_user_id}:${assignmentId}`) || legacyByEmail.get(`${email(student.student_email)}:${assignmentId}`);}};
}
function latestSubmissionByAssignment(rows) {
 const result={};
 const sorted=[...(rows||[])].sort((a,b)=>Number(graded(b))-Number(graded(a)) || Number(b.id)-Number(a.id));
 for(const row of sorted){const key=String(row.assignment_id);if(!result[key])result[key]=row;}
 return result;
}
module.exports={gradebookSubmissionIndex,latestSubmissionByAssignment};
