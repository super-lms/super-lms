const test=require('node:test'),assert=require('node:assert/strict');
const {validDate,validateUnit,calendar}=require('../server/fitnessRotation');
const settings={title:'Fitness',start_date:'2026-10-19',end_date:'2026-10-30',weekdays:[1,2,3,4],stations:['Back + Chest','Arms','Shoulders','Legs'].map(name=>({name}))};
test('each group visits every station once Monday to Thursday, repeating next week',()=>{
 const days=calendar(validateUnit(settings));assert.equal(days.length,8);
 for(let group=0;group<4;group++){assert.equal(new Set(days.slice(0,4).map(d=>d.stations[group])).size,4);assert.deepEqual(days.slice(0,4).map(d=>d.stations[group]),days.slice(4).map(d=>d.stations[group]));}
 for(const day of days)assert.equal(new Set(day.stations).size,4);
 assert.equal(days[0].date,'2026-10-19');assert.equal(days[3].date,'2026-10-22');assert.equal(days[4].date,'2026-10-26');
});
test('partial weeks preserve weekday rotation and do not invent Friday workouts',()=>{const d=calendar({...settings,start_date:'2026-10-21'});assert.deepEqual(d[0].stations,[2,3,0,1]);assert.ok(!d.some(x=>[5,6,7].includes(x.weekday)));});
test('configuration rejects impossible dates, duplicate stations, invalid day counts and excessive ranges',()=>{
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
 for(const patch of [{weekdays:[1,1,2,3]},{weekdays:[1,2,3]},{end_date:'2026-02-30'},{end_date:'2028-01-01'},{stations:Array(4).fill({name:'Arms'})},{start_date:'2026-10-23',end_date:'2026-10-25'}])assert.throws(()=>validateUnit({...settings,...patch}));
});
