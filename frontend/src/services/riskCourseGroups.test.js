import test from 'node:test'
import assert from 'node:assert/strict'
import {riskCourseGroups} from './riskCourseGroups.js'
test('stored ELSL and CTS masters include every linked cohort and root enrollment',()=>{
 const groups=riskCourseGroups([{id:1,title:'ELSL 11 - English language support'},{id:2,title:'ELSL cohort 11B',master_course_id:1},{id:3,title:'ELSL cohort 11C',master_course_id:1},{id:4,title:'CTS 10'},{id:5,title:'CTS 10B',master_course_id:4}])
 assert.equal(groups.length,2)
 assert.deepEqual(groups.find(g=>g.masterTitle.startsWith('ELSL')).sections.map(c=>c.id).sort(),[1,2,3])
 assert.equal(groups.every(g=>g.isMaster),true)
 assert.deepEqual(groups.find(g=>g.masterTitle==='CTS 10').sections.map(c=>c.id).sort(),[4,5])
})
test('legacy master and cohort names group even without stored links',()=>{
 const groups=riskCourseGroups([{id:1,title:'CTS 10'},{id:2,title:'CTS 10A'},{id:3,title:'CTS 10B'},{id:4,title:'ELSL 11A'}])
 assert.equal(groups.length,2)
 assert.equal(groups.find(g=>g.masterTitle==='CTS 10').sections.length,3)
})
test('teacher filter can omit the master row without splitting linked cohorts',()=>{
 const groups=riskCourseGroups([{id:2,title:'Course B',master_course_id:1,risk_master_title:'ELSL 11'},{id:3,title:'Course C',master_course_id:1,risk_master_title:'ELSL 11'}])
 assert.equal(groups.length,1)
 assert.equal(groups[0].masterTitle,'ELSL 11')
 assert.deepEqual(groups[0].sections.map(c=>c.id),[2,3])
})
test('unrelated courses remain separate and empty input is supported',()=>{
 assert.equal(riskCourseGroups([{id:1,title:'Economic Theory 12'},{id:2,title:'Accounting 12'}]).length,2)
 assert.deepEqual(riskCourseGroups(null),[])
})
