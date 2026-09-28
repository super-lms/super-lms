import test from 'node:test';
import assert from 'node:assert/strict';
import {studentWorkDocument} from './studentWorkExport.js';
test('written work keeps original multilingual text and identifies student, assignment and section',()=>{
 const content='Dear Pudding\n\n中文 response <script>literal text</script>\n  Original spacing';
 const work=studentWorkDocument({title:'Letter / WWI'}, {student_name:'Jenny 吴',section_title:'Social Studies 10B',content,feedback:'Private feedback'});
 assert.equal(work.content,content);assert.ok(work.text.endsWith(content));assert.match(work.text,/Social Studies 10B/);assert.match(work.filename,/Jenny 吴/);assert.ok(!work.filename.includes('/'));assert.ok(!work.text.includes('Private feedback'));
});
test('empty work cannot export and exports follow the selected student',()=>{
 assert.throws(()=>studentWorkDocument({}, {content:' \n '}),/no written response/);
 assert.equal(studentWorkDocument({}, {student_name:'Next student',content:'Different response'}).content,'Different response');
});
