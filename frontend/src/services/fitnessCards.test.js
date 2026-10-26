import test from 'node:test';import assert from 'node:assert/strict';import{fitnessCardsHtml}from'./fitnessCards.js';
const unit={title:'Fitness',start_date:'2026-10-26',end_date:'2026-11-26',weekdays:[1,2,3,4],stations:['Back + Chest','Arms','Shoulders','Legs'].map(name=>({name,instructions:'Teacher plan <safe>'}))};
test('print cards preserve each student, multilingual names, their own rotation and safe instructions',()=>{
 const html=fitnessCardsHtml({unit,course:{title:'PE'},students:[{name:'李明 <script>',group_index:1},{name:'Alex',group_index:null}]});
 assert.equal((html.match(/<article>/g)||[]).length,2);assert.ok(html.includes('李明 &lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Monday — Arms'));assert.ok(html.includes('Thursday — Back + Chest'));assert.ok(html.includes('Teacher plan &lt;safe&gt;'));assert.ok(html.includes('Group not selected'));assert.ok(html.includes('2026-10-26'));
});
test('empty roster cannot produce a misleading empty printout',()=>assert.throws(()=>fitnessCardsHtml({unit,students:[]})));
