const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../server/app.js'), 'utf8');
function fixture({teacher = true, missing = false, failInsert = false} = {}) {
  const handlers = {}, calls = [];
  const observer = {id: 7, observer_relationship: teacher ? 'chinese_homeroom_teacher' : 'parent', has_homeroom_links: false};
  async function query(sql, args = []) {
    calls.push({sql, args});
    if (sql.includes('FROM users\n      WHERE')) return {rows: [observer]};
    if (sql.includes('FROM master_students ms')) {
      assert.doesNotMatch(sql, /TRIM\(ms.current_grade|LIMIT 300/);
      assert.doesNotMatch(sql, /COALESCE\(ms.student_email, ''\) <>/);
      return {rows: [{master_student_id: 1, current_grade: '10'}, {master_student_id: 2, current_grade: '12', already_linked: true}]};
    }
    if (sql.includes('FROM master_students\n')) {
      assert.doesNotMatch(sql, /TRIM\(current_grade/);
      return {rows: missing ? [] : args[0].map(id => ({id, current_grade: id === 1 ? '10' : '12', student_email: `student${id}@example.test`, display_name: `Student ${id}`}))};
    }
    if (sql.includes('INSERT INTO users')) {
      if (failInsert) throw new Error('simulated insert failure');
      return {rows: [{id: Number(args[3].match(/\d+/)[0]) + 100}]};
    }
    return {rows: []};
  }
  const client = {query, release() { calls.push({sql:'RELEASE'}); }};
  vm.runInNewContext(source.slice(source.indexOf('/* ACTIVE SCHOOL ROSTER CANDIDATES'), source.indexOf('app.get("/api/observers/:email/dashboard"')), {
    app: {get: (path,...fns) => handlers.get = fns.at(-1), post: (path,...fns) => handlers.post = fns.at(-1)},
    authenticateJWT(){}, requireRole:()=>()=>{}, ensureStudentInfoColumns:async()=>{},
    pool: {query, connect:async()=>client}, console: {error() {}}
  });
  return {handlers, calls};
}
function req(body = {masterStudentIds:[1,2]}, id=7) {return {params:{email:'staff@example.test'}, query:{current_grade:'11'}, body, user:{id,role:'observer'}};}
function res() {return {code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
test('roster lists all active grades even for a legacy Grade 11 request', async()=>{
 const f=fixture(), r=res();await f.handlers.get(req(),r);
 assert.equal(r.code,200);assert.deepEqual(Array.from(r.body.students,x=>x.current_grade),['10','12']);assert.equal(r.body.roster_scope,'all_active_students');
});
test('saving mixed grades replaces only this teachers homeroom links',async()=>{
 const f=fixture(),r=res();await f.handlers.post(req(),r);assert.equal(r.code,200);assert.equal(r.body.linkedCount,2);
 const removal=f.calls.find(x=>x.sql.startsWith('DELETE FROM observer_student_links'));
 assert.equal(removal.args[0],7);assert.deepEqual(Array.from(removal.args[1]),[101,102]);assert.match(removal.sql,/relationship = 'chinese_homeroom_teacher'/);assert.equal(f.calls.at(-2).sql,'COMMIT');
});
test('an explicit empty selection clears homeroom links and preserves teacher identity',async()=>{
 const f=fixture(),r=res();await f.handlers.post(req({masterStudentIds:[]}),r);assert.equal(r.code,200);assert.equal(r.body.linkedCount,0);
 assert.deepEqual(Array.from(f.calls.find(x=>x.sql.startsWith('DELETE')).args[1]),[]);assert.ok(f.calls.some(x=>x.sql.includes('UPDATE users SET observer_relationship')));
});
test('missing or malformed selection cannot accidentally clear links',async()=>{
 for (const body of [{},{masterStudentIds:['bad']},{masterStudentIds:[0]}]) {const f=fixture(),r=res();await f.handlers.post(req(body),r);assert.equal(r.code,400);assert.ok(!f.calls.some(x=>x.sql==='BEGIN'));}
});
test('parent observers cannot browse or self-link the school roster',async()=>{
 for(const method of ['get','post']){const f=fixture({teacher:false}),r=res();await f.handlers[method](req(),r);assert.equal(r.code,403);assert.ok(!f.calls.some(x=>x.sql.includes('FROM master_students')));}
});
test('homeroom teachers cannot manage another teachers selection',async()=>{
 for(const method of ['get','post']){const f=fixture(),r=res();await f.handlers[method](req(undefined,8),r);assert.equal(r.code,403);}
});
test('invalid or inactive student selection leaves existing links unchanged',async()=>{
 const f=fixture({missing:true}),r=res();await f.handlers.post(req(),r);assert.equal(r.code,400);assert.ok(!f.calls.some(x=>x.sql==='BEGIN'));
});
test('failed save rolls back and never removes existing links',async()=>{
 const f=fixture({failInsert:true}),r=res();await f.handlers.post(req(),r);assert.equal(r.code,500);assert.ok(f.calls.some(x=>x.sql==='ROLLBACK'));assert.ok(!f.calls.some(x=>x.sql.startsWith('DELETE')));assert.equal(f.calls.at(-1).sql,'RELEASE');
});
