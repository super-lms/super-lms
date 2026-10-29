import test from 'node:test'
import assert from 'node:assert/strict'
import {weightedCourseStanding} from './courseStanding.js'

test('student standing uses the same weighted evidence-group calculation as the teacher gradebook',()=>{
 const assignments=[
  {id:1,subcategory_id:10,category_weight_percent:40,weight_percent_of_parent:50},
  {id:2,subcategory_id:10,category_weight_percent:40,weight_percent_of_parent:50},
  {id:3,subcategory_id:20,category_weight_percent:60,weight_percent_of_parent:100,source_type:'assessment'},
 ]
 const states={'1':{submission:{score:100}},'2':{submission:{score:80}},'3':{submission:{score:50}}}
 assert.equal(weightedCourseStanding(assignments,states),60)
})

test('unmarked work is excluded and a zero remains a marked score',()=>{
 const assignments=[{id:1,subcategory_id:10,course_weight_percent:30},{id:2,subcategory_id:20,course_weight_percent:70}]
 assert.equal(weightedCourseStanding(assignments,{'1':{submission:{score:0}}}),0)
 assert.equal(weightedCourseStanding(assignments,{}),null)
})
