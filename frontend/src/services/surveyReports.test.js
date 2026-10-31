import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSurveyReportRows, normalizeSurveyResponse, surveyAnswerLines, buildSurveyPrintHtml } from './surveyReports.js';
const response = (id, email, created = '2026-10-30T01:00:00Z') => ({ id, created,
  student: JSON.stringify({ name: 'Student <One>', email, grade: '10', class: '10A' }),
  questions: JSON.stringify([{ id: 'q1', title: 'My <reflection>', type: 'Essay' }]), answers: JSON.stringify({ q1: 'Line 1\n<script>alert(1)</script>' }) });
test('roster completion uses normalized email, preserves repeats and never matches by name', () => {
  const responses = [response('old', ' student@example.com '), response('new', 'STUDENT@example.com', '2026-10-31T01:00:00Z'), response('other', 'other@example.com')];
  const rows = buildSurveyReportRows(responses, [{student_user_id:1,student_name:'Student <One>',student_email:'Student@example.com'}, {student_user_id:2,student_name:'Student <One>',student_email:'pending@example.com'}, {student_user_id:3,student_name:'No email',student_email:''}]);
  assert.equal(rows.length,3);assert.equal(rows.find(r=>r.email==='student@example.com').latest.id,'new');
  assert.equal(rows.find(r=>r.email==='student@example.com').responses.length,2);
  assert.equal(rows.find(r=>r.email==='pending@example.com').status,'pending');
  assert.equal(rows.find(r=>r.email==='').status,'pending');assert.equal(buildSurveyReportRows(responses).length,2);
});
test('print uses saved snapshots, escapes response HTML and starts each student on a new page', () => {
  const html=buildSurveyPrintHtml({title:'Competencies <script>'},[normalizeSurveyResponse(response('one','student@example.com')),normalizeSurveyResponse(response('two','other@example.com'))]);
  assert.equal((html.match(/<article>/g)||[]).length,2);assert.match(html,/article\+article\{break-before:page/);
  assert.match(html,/My &lt;reflection&gt;/);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>/);assert.match(html,/China time/);
});
test('answers support rating labels, matching, ranking, optional omissions and zero', () => {
  assert.deepEqual(surveyAnswerLines({type:'Rating',ratingLabels:['Sometimes','Usually']},'2'),['Usually (2)']);
  assert.deepEqual(surveyAnswerLines({type:'Matching',options:['Communication','Thinking']},['Listen','Reflect']),['Communication: Listen','Thinking: Reflect']);
  assert.deepEqual(surveyAnswerLines({type:'Ranking'},['Listen','Reflect']),['1. Listen','2. Reflect']);
  assert.deepEqual(surveyAnswerLines({type:'Essay'},''),['No response']);assert.deepEqual(surveyAnswerLines({type:'Scoring'},'0'),['0']);
});
test('bad stored JSON is flagged instead of silently printing missing answers', () => {
  const broken=normalizeSurveyResponse({...response('one','a@example.com'),questions:'broken JSON'});
  assert.equal(broken.readable,false);assert.throws(()=>buildSurveyPrintHtml({title:'Survey'},[broken]),/could not be read/);
  assert.throws(()=>buildSurveyPrintHtml({title:'Survey'},[]),/at least one/);
  assert.equal(normalizeSurveyResponse({...response('one','a@example.com'),questions:'[null]'}).readable,false);
});
