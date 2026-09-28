const test=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const {readAnnouncementGroups}=require('../server/announcementGroups');
function book(rows){const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet(rows),'Groups');return b;}
test('group lists preserve labels, missing Chinese names, and duplicate English names',()=>{
 const rows=readAnnouncementGroups(book([
 ['10 A-1 • Teachers','中文名','English Name'],
 ['11 A-1 • Teachers','王明','Alex'],
 ['12 A-1 • Teachers','','Alex'],
 ['','',''],
 ['Group','中文名','English Name']
 ]));
 assert.equal(rows.length,2);assert.equal(rows[0].groupName,'10 A-1 • Teachers');assert.equal(rows[1].groupName,'10 A-1 • Teachers');assert.equal(rows[1].chineseName,'');
});
test('standard headings work in a different column order and every row is searchable',()=>{
 const rows=readAnnouncementGroups(book([['English Name','Group Name','Chinese Name'],...Array.from({length:650},(_,i)=>[`Student ${i}`,'Group A',`名字${i}`])]));
 assert.equal(rows.length,650);assert.equal(rows[649].englishName,'Student 649');assert.equal(rows[0].groupName,'Group A');
});
test('ordinary spreadsheets are not interpreted as group lists',()=>{assert.deepEqual(readAnnouncementGroups(book([['Name','Score'],['Alex',10]])),[]);});

test('a group heading applies until the next group heading, including blank and heading-only rows',()=>{
 const rows=readAnnouncementGroups(book([
 ['Group Name','Chinese Name','English Name'],
 ['10 A-1 • Teacher One','',''],
 ['', '王明','Alex'],
 ['11 A-1 • Teacher One','李明','Ben'],
 ['10 A-2 • Teacher Two','陈芳','Cici'],
 ['', '', 'Daisy'],
 ['11 A-2 • Teacher Three','',''],
 ['', '张林','Eli']
 ]));
 assert.deepEqual(rows.map(row=>row.groupName),['10 A-1 • Teacher One','10 A-1 • Teacher One','10 A-2 • Teacher Two','10 A-2 • Teacher Two','11 A-2 • Teacher Three']);
});
