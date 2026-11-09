import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync(new URL('./openRti.js',import.meta.url),'utf8').replace(/^import authFetch[^\n]*\n/,'').replace('export async function','async function').replaceAll('import.meta.env','env');
function fixture(data,{ok=true,blocked=false}={}){
 const events=[];const popup={opener:{},location:{replace:url=>events.push(['open',url])},close:()=>events.push(['close'])};
 const scope={env:{DEV:false},URL,authFetch:async path=>{events.push(['read',path]);return {ok,json:async()=>data}},window:{open:()=>blocked?null:popup,alert:message=>events.push(['alert',message]),location:{assign:path=>events.push(['return',path])}}};
 vm.createContext(scope);vm.runInContext(code,scope);return {scope,events,popup};
}
test('RTI launch obtains the existing authenticated sign-in link and preserves the LMS workspace',async()=>{
 const url='https://repository-name-cbc-rti-paper-trail-production.up.railway.app/?sso=artificial-test-token';const {scope,events,popup}=fixture({url});
 await scope.openRtiStudentSupport('/observer');assert.equal(popup.opener,null);assert.deepEqual(events.filter(e=>e[0]==='read'),[['read','/api/rti/sso']]);assert.deepEqual(events.find(e=>e[0]==='open'),['open',url]);assert.deepEqual(events.find(e=>e[0]==='return'),['return','/observer']);
});
test('missing configuration, denied access and unexpected destinations close the blank window without exposing credentials',async()=>{
 for(const [data,options] of [[{authentication:'rti_staff_login'},{}],[{error:'Access denied'},{ok:false}],[{url:'https://unexpected.example.invalid/?sso=test'},{}],[{},{}]]){
  const {scope,events}=fixture(data,options);await assert.rejects(scope.openRtiStudentSupport());assert.ok(events.some(e=>e[0]==='close'));assert.ok(!events.some(e=>['open','return'].includes(e[0])));
 }
});
test('blocked popups do not request a sign-in token',async()=>{const {scope,events}=fixture({}, {blocked:true});await scope.openRtiStudentSupport();assert.equal(events.filter(e=>e[0]==='read').length,0);});
