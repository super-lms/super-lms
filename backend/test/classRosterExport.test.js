const test=require('node:test'),assert=require('node:assert/strict'),JSZip=require('jszip');
const {classRosterDocx,rosterLayout}=require('../server/classRosterExport');
test('Word roster is an A4 document with every student once and no contact details',async()=>{
 const students=Array.from({length:60},(_,i)=>({name:`Student ${i} 林`,student_id:`ID${i}END`,email:'private@test'}));
 const zip=await JSZip.loadAsync(await classRosterDocx({title:'PE 10B'},students));
 const xml=await zip.file('word/document.xml').async('string');
 assert.match(xml,/w:w="11906" w:h="16838"/);assert.doesNotMatch(xml,/private@test/);
 for(const student of students)assert.equal(xml.split(student.student_id).length-1,1);
 assert.equal(rosterLayout(23).panels,1);assert.equal(rosterLayout(60).panels,2);
});
