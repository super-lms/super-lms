import test from 'node:test';
import assert from 'node:assert/strict';
import { ieRows, iePrintHtml } from './ieReport.js';
test('IE preserves a submitted zero score and ungraded submitted work',()=>{
 const rows=ieRows([{assignment_id:1,submitted:false,score:''},{assignment_id:2,submitted:true,score:0},{assignment_id:3,submitted:true,score:''}]);
 assert.equal(rows[1].score,'0%'); assert.equal(rows[2].score,'');
});
test('IE print contains only selected work, safely escapes text and includes four signatures',()=>{
 const html=iePrintHtml({name:'<script>',course:'English',date:'2026-10-07',grade:'10',className:'10A'},[{included:true,title:'Reading & Writing',submitted:false,score:'',directions:'Finish <all>',originalDate:'2026-09-01',finalDate:'2026-10-10'},{included:false,title:'Excluded'}]);
 assert.ok(html.includes('Reading &amp; Writing'));assert.ok(!html.includes('Excluded'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Finish &lt;all&gt;'));
 for(const role of ['Student','Parent','Homeroom Teacher','BC Teacher'])assert.ok(html.includes(`${role} Signature`));
 assert.ok(html.includes('A4 landscape'));
});

test('IE selects missing work and strictly below 50%, excluding ungraded submitted work',()=>{
 const rows=ieRows([{submitted:false,score:''},{submitted:true,score:0},{submitted:true,score:49.9},{submitted:true,score:50},{submitted:true,score:80},{submitted:true,score:''},{submitted:true,score:null}]);
 assert.deepEqual(rows.map(r=>r.included),[true,true,true,false,false,false,false]);
});
