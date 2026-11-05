import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beijingToday,addStudyDays,studyDays,ipadStatusLabel} from './selfStudyCalendar.js';
test('Beijing today uses the school date even when UTC is still the previous day',()=>{
 assert.equal(beijingToday(new Date('2026-11-05T18:30:00Z')),'2026-11-06');
 assert.equal(beijingToday(new Date('2026-11-05T15:59:00Z')),'2026-11-05');
});
test('week starts Monday and includes Sunday across month and year boundaries',()=>{
 assert.deepEqual(studyDays('2027-01-01','week'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.equal(studyDays('2026-11-08','week')[0],'2026-11-02');
 assert.deepEqual(studyDays('2026-11-06','day'),['2026-11-06']);
 assert.equal(addStudyDays('2026-12-31',1),'2027-01-01');
});
test('no notice is not presented as permission to leave an iPad behind',()=>{
 assert.equal(ipadStatusLabel(undefined),'No notice posted');
 assert.equal(ipadStatusLabel('needed'),'Need iPad for Self Study');
 assert.equal(ipadStatusLabel('not_needed'),'Do Not Need iPad for Self Study');
});
