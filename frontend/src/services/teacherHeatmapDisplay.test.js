import test from 'node:test'
import assert from 'node:assert/strict'
import {getKduCellLabel,getKduCellDescriptor} from './teacherHeatmapDisplay.js'

test('missing KDU evidence is not displayed as a zero or a proficiency judgement',()=>{
  for(const value of [null,undefined,'','   ']){
    assert.equal(getKduCellLabel(value),'—')
    assert.equal(getKduCellDescriptor(value),'No evidence')
  }
})

test('genuine numeric and string zero scores remain distinct from missing evidence',()=>{
  for(const value of [0,'0','0.0']){
    assert.equal(getKduCellLabel(value),'0.0')
    assert.equal(getKduCellDescriptor(value),'Emerging')
  }
})

test('finite score formatting and existing proficiency thresholds are preserved',()=>{
  for(const [value,label,descriptor] of [[2.49,'2.5','Emerging'],[2.5,'2.5','Developing'],[3.99,'4.0','Developing'],[4,'4.0','Proficient'],[5.49,'5.5','Proficient'],[5.5,'5.5','Extending'],['6','6.0','Extending']]){
    assert.equal(getKduCellLabel(value),label)
    assert.equal(getKduCellDescriptor(value),descriptor)
  }
})

test('malformed or non-finite values do not create false evidence',()=>{
  for(const value of [NaN,Infinity,-Infinity,'Infinity','bad',false,true,[],{}]){
    assert.equal(getKduCellLabel(value),'—')
    assert.equal(getKduCellDescriptor(value),'No evidence')
  }
})
