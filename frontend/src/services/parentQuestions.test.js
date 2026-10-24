import test from 'node:test'
import assert from 'node:assert/strict'
import { parentQuestions, questionIntent, courseItems, missingWork, upcomingWork, lowerMarkWork } from './parentQuestions.js'
const now = Date.parse('2026-10-24T04:00:00Z')
const item = (id,status,score,due='2026-10-23T04:00:00Z') => ({assignment:{id,due_date:due},status,submission:score === null ? null : {score}})
test('Chinese and English parent questions resolve to supported record topics', () => {
  for (const q of parentQuestions) {
    assert.equal(questionIntent(q.zh),q.id)
    assert.equal(questionIntent(q.en),q.id)
  }
  assert.equal(questionIntent('我的女儿有多少作业没交？'),'missing')
  assert.equal(questionIntent('Show me a sample of their work from a low mark assignment'),'work')
  assert.equal(questionIntent('what days were they marked absent'),'attendance')
  assert.equal(questionIntent('给我看最低分作业和老师反馈'),'work')
  assert.equal(questionIntent('What should we eat tonight?'),null)
})
test('missing means overdue and unsubmitted, excluding unmarked, held, undated, future and zero-mark graded work', () => {
  const items = [item(1,'not_submitted',null),item(2,'submitted',null),item(3,'awaiting_approval',null),item(4,'not_submitted',0),item(5,'not_submitted',null,null),item(6,'not_submitted',null,'2026-11-01T00:00:00Z'),item(7,'declined',null)]
  assert.deepEqual(missingWork(items,now).map(i=>i.assignment.id),[1,7])
})
test('next seven days excludes submitted and overdue assignments', () => {
  const due='2026-10-25T04:00:00Z'
  assert.deepEqual(upcomingWork([item(1,'not_submitted',null,due),item(2,'submitted',null,due),item(3,'not_submitted',null),item(4,'not_submitted',null,'bad')],now).map(i=>i.assignment.id),[1])
})
test('lower-mark evidence includes zero and excludes missing or invalid marks without mutating source', () => {
  const items=[item(1,'submitted',80),item(2,'submitted',0),item(3,'submitted',null),item(4,'submitted',55),item(5,'submitted',''),item(6,'submitted','invalid')]
  assert.deepEqual(lowerMarkWork(items).map(i=>i.assignment.id),[2,4,1])
  assert.equal(items[0].assignment.id,1)
})
test('assignment states preserve the selected course and unsubmitted default', () => {
  const course={class_id:9}
  const result=courseItems({assignments:[{id:1},{id:2}],submissionStatesByAssignmentId:{1:{submission_status:'awaiting_approval'}}},course)
  assert.equal(result[0].status,'awaiting_approval')
  assert.equal(result[1].status,'not_submitted')
  assert.equal(result[0].course,course)
})
