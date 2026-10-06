import test from 'node:test';
import assert from 'node:assert/strict';
import { ieRows, iePrintHtml } from './ieReport.js';
test('IE preserves a submitted zero score and removes ungraded submitted work',()=>{
 const rows=ieRows([{assignment_id:1,submitted:false,score:''},{assignment_id:2,submitted:true,score:0},{assignment_id:3,submitted:true,score:''}]);
 assert.equal(rows.length,2); assert.equal(rows[1].score,'0%');
});
test('IE print contains only selected work, safely escapes text and includes four signatures',()=>{
 const html=iePrintHtml({name:'<script>',course:'English',date:'2026-10-07',grade:'10',className:'10A'},[{included:true,title:'Reading & Writing',submitted:false,score:'',directions:'Finish <all>',originalDate:'2026-09-01',finalDate:'2026-10-10'},{included:false,title:'Excluded'}]);
 assert.ok(html.includes('Reading &amp; Writing'));assert.ok(!html.includes('Excluded'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Finish &lt;all&gt;'));
 for(const role of ['Student','Parent','Homeroom Teacher','BC Teacher'])assert.ok(html.includes(`${role} Signature`));
 assert.ok(html.includes('A4 landscape'));
});

test('IE only shows missing work and strictly below 50%, excluding all not-marked values',()=>{
 const scores=[0,49.99,50,55,60,80,'',null,'Not Marked','   '];
 const rows=ieRows([{assignment_id:'missing',submitted:false,score:''},...scores.map((score,i)=>({assignment_id:i,submitted:true,score}))]);
 assert.deepEqual(rows.map(r=>r.id),['missing',0,1]);
 assert.ok(rows.every(r=>r.included));
});
test('print cannot include passing or not marked assignments even if checked',()=>{
 const html=iePrintHtml({},[{included:true,submitted:true,score:'100%',title:'Passing'},{included:true,submitted:true,score:'',title:'Awaiting marking'},{included:true,submitted:true,score:'39%',title:'Qualifying'}]);
 assert.ok(!html.includes('Passing'));assert.ok(!html.includes('Awaiting marking'));assert.ok(html.includes('Qualifying'));
});
