import test from 'node:test';
import assert from 'node:assert/strict';
import {findAnnouncementGroups} from './announcementGroups.js';
const rows=[{chineseName:'王明',englishName:'Alex Li',groupName:'A'},{chineseName:'',englishName:'Alex',groupName:'B'},{chineseName:'陈芳',englishName:'Cici',groupName:'C'}];
test('name search supports Chinese, partial English, case and spacing',()=>{
 assert.equal(findAnnouncementGroups(rows,' 王 明 ')[0].groupName,'A');
 assert.equal(findAnnouncementGroups(rows,'ＡＬＥＸ').length,2);
 assert.equal(findAnnouncementGroups(rows,'alexli')[0].groupName,'A');
 assert.equal(findAnnouncementGroups(rows,'CiCi')[0].groupName,'C');
});
test('empty searches and missing names do not return misleading matches',()=>{
 assert.deepEqual(findAnnouncementGroups(rows,' '),[]);
 assert.deepEqual(findAnnouncementGroups(rows,'no such name'),[]);
 assert.equal(findAnnouncementGroups(rows,'Alex').length,2);
});
