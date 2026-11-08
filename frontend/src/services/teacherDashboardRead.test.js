import test from 'node:test'
import assert from 'node:assert/strict'
import { createTeacherDashboardReader } from './teacherDashboardRead.js'

const ok = data => ({ok:true,json:async()=>data})

test('navigation and dashboard share a concurrent read, but the next refresh is fresh', async () => {
  let calls=0, release
  const data={courses:[{id:10}],grades:[{score:0},{score:null}]}
  const read=createTeacherDashboardReader(async url=>{calls++;assert.equal(url,'/api/teachers/7/dashboard');await new Promise(resolve=>{release=resolve});return ok(data)})
  const first=read(7,'session-a'), second=read(7,'session-a')
  assert.equal(first,second)
  await Promise.resolve();assert.equal(calls,1);release()
  assert.deepEqual(await first,data);assert.deepEqual(await second,data)
  const refreshed=read(7,'session-a');await Promise.resolve();assert.equal(calls,2);release();await refreshed
})

test('teacher IDs and authentication/workspace scopes do not share reads', async () => {
  let calls=0
  const read=createTeacherDashboardReader(async()=>ok({request:++calls}))
  const result=await Promise.all([read(7,'token-a:teacher'),read(8,'token-a:teacher'),read(7,'token-b:teacher'),read(7,'token-a:admin')])
  assert.equal(calls,4);assert.equal(new Set(result.map(x=>x.request)).size,4)
})

for (const failure of ['http','network','json']) {
  test(`${failure} failure releases the shared request so Retry works`,async()=>{
    let calls=0
    const read=createTeacherDashboardReader(async()=>{
      if(++calls>1)return ok({courses:[]})
      if(failure==='network')throw Error('Offline')
      if(failure==='http')return {ok:false,status:503}
      return {ok:true,json:async()=>{throw Error('Invalid JSON')}}
    })
    const first=read(7),second=read(7)
    assert.equal(first,second)
    const outcomes=await Promise.allSettled([first,second])
    assert.ok(outcomes.every(x=>x.status==='rejected'))
    assert.deepEqual(await read(7),{courses:[]});assert.equal(calls,2)
  })
}
