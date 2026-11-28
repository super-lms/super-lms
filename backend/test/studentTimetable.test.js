const test=require('node:test'),assert=require('node:assert/strict');
const {matchCourse,blocksFor,createStudentTimetable}=require('../server/studentTimetable');
const schedule=require('../server/semesterTimetable.json');
test('schedule aliases match actual LMS course names',()=>{
 for(const [course,text] of [['PGEO 11B','Physical GeoG 11B'],['Pre-Calculus 11C','Pre-Cal 11C'],['Chemistry 12C','Chem 12C'],['Accounting 11 for Grade 12s','Accounting 11 for 12s'],['New Media 10D','Spoken Language / New Media 10D']])assert.ok(matchCourse(course,{course:text}),course);
 assert.equal(matchCourse('Physics 11A',{course:'Physics 12A'}),false);
});
test('returns four ordered blocks with rooms from supplied schedule',()=>{
 const blocks=blocksFor([{title:'CTS 10C'},{title:'PE 10C'}]);assert.equal(blocks.length,4);assert.equal(blocks[2].courses[0].room,'506');assert.equal(blocks[1].courses[0].room,'Gym');assert.equal(blocks[0].courses.length,0);
});
test('unassigned observer cannot query timetable data',async()=>{
 const handler=createStudentTimetable({pool:{query:()=>{throw Error('must not query')}}});const res={status(c){this.code=c;return this},json(x){this.data=x}};await handler({query:{q:'Howard'},user:{role:'observer',email:'unassigned@cbcschools.ca'}},res);assert.equal(res.code,403);
});
