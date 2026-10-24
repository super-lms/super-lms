import test from 'node:test'
import assert from 'node:assert/strict'
import {lookupStudents,quickLookupGradebookPath,lookupStudentMatches} from './teacherQuickLookup.js'
const courses=[{id:10,title:'English 10A'},{id:11,title:'English 10B'}]
const students=[{id:1,name:'Anna Li',email:'anna@example.test',class_id:10},{id:1,name:'Anna Li',email:'anna@example.test',class_id:11},{id:2,name:'Anna Li',email:'anna2@example.test',class_id:11},{id:3,name:'王小明',email:'wang@example.test',class_id:12,class_name:'Composition 10C',master_course_id:10}]
test('name lookup keeps each actual cohort enrollment and distinguishes duplicate names',()=>{
 const rows=lookupStudents(students,courses,' ANNA li ')
 assert.equal(rows.length,3)
 assert.deepEqual(rows.map(r=>[r.id,r.classId]),[[1,'10'],[1,'11'],[2,'11']])
 assert.equal(rows[1].courseTitle,'English 10B')
})
test('Chinese names and partial/reordered names work; empty and unknown queries do not list everyone',()=>{
 assert.equal(lookupStudents(students,courses,'小明')[0].courseTitle,'Composition 10C')
 assert.equal(lookupStudents(students,courses,'li anna').length,3)
 assert.equal(lookupStudents(students,courses,'').length,0)
 assert.equal(lookupStudents(students,courses,'missing').length,0)
 assert.equal(lookupStudents(students,courses,'anna2@')[0].id,2)
})
test('duplicate enrollment records collapse without collapsing distinct courses',()=>{
 assert.equal(lookupStudents([...students,students[0]],courses,'anna').length,3)
})
test('gradebook links use cohort identity instead of shared master and encode names safely',()=>{
 const student=lookupStudents(students,courses,'小明')[0]
 const url=new URL(quickLookupGradebookPath({...student,name:'王 & 小明'}),'https://example.test')
 assert.equal(url.pathname,'/gradebook')
 assert.equal(url.searchParams.get('classId'),'12')
 assert.equal(url.searchParams.get('studentId'),'3')
 assert.equal(url.searchParams.get('studentName'),'王 & 小明')
 assert.equal(url.searchParams.get('source'),'quick-lookup')
 assert.equal(url.searchParams.get('returnTo'),'dashboard')
 assert.equal(url.searchParams.has('sectionId'),false)
})
test('stable ID takes precedence over matching names or emails for gradebook focus',()=>{
 const row={student_user_id:3,student_email:'wang@example.test'}
 assert.equal(lookupStudentMatches(row,'4','wang@example.test'),false)
 assert.equal(lookupStudentMatches(row,'3','changed@example.test'),true)
 assert.equal(lookupStudentMatches(row,'',' WANG@example.test '),true)
 assert.equal(lookupStudentMatches(row,'',''),false)
})
