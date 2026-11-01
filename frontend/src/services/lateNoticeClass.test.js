import test from 'node:test';
import assert from 'node:assert/strict';
import {noticeClassSection} from './lateNoticeClass.js';
test('class notices approve the selected cohort and never the inferred master',()=>{
 assert.equal(noticeClassSection({section_id:145},144,false),144);
 assert.equal(noticeClassSection({},'144',false),144);
});
test('master notices require a single known cohort and do not silently approve all cohorts',()=>{
 assert.equal(noticeClassSection({section_id:145},144,true),145);
 for(const section_id of [null,undefined,'all','',0,-1,1.5])assert.equal(noticeClassSection({section_id},144,true),null);
});
