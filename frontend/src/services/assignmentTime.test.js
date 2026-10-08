import test from 'node:test';import assert from 'node:assert/strict';
import {assignmentInstant,beijingDateTime,displayAssignmentTime} from './assignmentTime.js';
test('Beijing hours and minutes map to an instant across midnight',()=>{
 assert.equal(assignmentInstant('2026-10-08T00:15'),'2026-10-07T16:15:00.000Z');
 assert.equal(beijingDateTime('2026-10-07T16:15:00.000Z'),'2026-10-08T00:15');
 assert.equal(assignmentInstant('2026-10-08T23:59'),'2026-10-08T15:59:00.000Z');
});
test('editing retains the same time irrespective of browser timezone',()=>{
 const original=process.env.TZ;
 for(const timezone of ['America/Vancouver','Asia/Shanghai','UTC']){
 process.env.TZ=timezone;
 const value='2027-01-15T08:30';assert.equal(beijingDateTime(assignmentInstant(value)),value);
 assert.equal(displayAssignmentTime(assignmentInstant(value)),'2027-01-15 08:30 Beijing time');
 }process.env.TZ=original;
});
test('blank dates and legacy UTC timestamps are supported',()=>{
 assert.equal(assignmentInstant(''),null);assert.equal(beijingDateTime(null),'');
 assert.equal(beijingDateTime('2026-10-08T00:00:00'),'2026-10-08T08:00');
});
