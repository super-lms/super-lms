import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeHomeroomCourse,loadHomeroomCourseSummaries} from './homeroomCourseSummary.js'

test('summary separates completion, marked submitted average, existing weighted score, and test counts',()=>{
 const assignments=Array.from({length:10},(_,i)=>({id:i+1,submission_required:i!==5,source_type:[6,7].includes(i)?'assessment':'assignment'}))
 const states={1:{submission_status:'submitted',submission:{score:0}},2:{submission_status:'submitted',submission:{score:80}},3:{submission_status:'awaiting_approval',submission:null},4:{submission_status:'not_submitted'},5:{submission_status:'declined'},6:{submission_status:'no_submission_required',submission:{score:90}},7:{submission_status:'not_submitted',submission:{score:60}},8:{submission_status:'not_submitted'},9:{submission_status:'not_submitted',submission:{rubric_selection:{excused:true}}},10:{submission_status:'not_submitted',submission:{score:100}}}
 const data={assignments,submissionStatesByAssignmentId:states,gradebook:{current_percent:54.3},test_summary:{completed_tests:3,test_assignment_ids:[7,8,10],completed_test_assignment_ids:[7,10]}}
 const before=JSON.stringify(data)
 const result=summarizeHomeroomCourse(data)
 assert.deepEqual(result,{submissionAvailable:true,submissionPercent:62.5,submittedCount:5,requiredCount:8,submittedAverage:60,markedSubmittedCount:4,currentPercent:54.3,missingAssignments:2,completedTests:3})
 assert.equal(JSON.stringify(data),before)
})

test('empty, unmarked and real-zero results remain distinct',()=>{
 const empty=summarizeHomeroomCourse({assignments:[],gradebook:{current_percent:null},test_summary:{completed_tests:0}})
 assert.equal(empty.submissionPercent,null);assert.equal(empty.submittedAverage,null);assert.equal(empty.completedTests,0)
 const zero=summarizeHomeroomCourse({assignments:[{id:1}],submissionStatesByAssignmentId:{1:{submission_status:'submitted',submission:{score:'0'}}},gradebook:{current_percent:'0'},test_summary:{completed_tests:0}})
 assert.equal(zero.submissionPercent,100);assert.equal(zero.submittedAverage,0);assert.equal(zero.currentPercent,0)
 const unmarked=summarizeHomeroomCourse({assignments:[{id:1}],submissionStatesByAssignmentId:{1:{submission_status:'submitted',submission:{score:' '}}},test_summary:{completed_tests:0}})
 assert.equal(unmarked.submittedAverage,null)
})

test('unavailable test metadata is not represented as a verified zero or complete submission result',()=>{
 for(const test_summary of [undefined,{unavailable:true,completed_tests:null}]){
  const result=summarizeHomeroomCourse({assignments:[{id:1}],gradebook:{current_percent:73},test_summary})
  assert.equal(result.completedTests,null);assert.equal(result.missingAssignments,null);assert.equal(result.submissionAvailable,false);assert.equal(result.currentPercent,73)
 }
})

test('course reads are bounded, ordered and independent when one fails',async()=>{
 let active=0,max=0
 const courses=Array.from({length:8},(_,i)=>({class_id:i+1}))
 const result=await loadHomeroomCourseSummaries(courses,async course=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;if(course.class_id===3)throw Error('Unavailable');return {assignments:[],gradebook:{current_percent:course.class_id},test_summary:{completed_tests:0}}})
 assert.equal(max,3);assert.deepEqual(result.map(r=>r.course.class_id),courses.map(c=>c.class_id));assert.equal(result[2].error,true);assert.equal(result[3].data.currentPercent,4)
})
