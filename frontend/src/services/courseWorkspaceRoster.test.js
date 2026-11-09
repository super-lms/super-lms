import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {rosterPrintEndpoint} from './rosterPrintChoices.js';
const source=fs.readFileSync(new URL('../pages/CoursesPage.jsx',import.meta.url),'utf8');
test('cohort A requests its exact roster; explicit master view requests aggregate and does not reuse cohort cache',async()=>{
 const reads=[];let cache={};
 const scope={isMasterWorkspace:false,activeRosterCourseId:null,rosterByCourseId:cache,rosterPrintEndpoint,
  authFetch:async url=>{reads.push(url);return {ok:true,json:async()=>({course:{id:10},students:[{id:1}],is_master_roster:!url.includes('scope=section')})}},
  setActiveRosterCourseId:id=>scope.activeRosterCourseId=id,setRosterLoadingCourseId:()=>{},setMessage:()=>{},setError:error=>{if(error)throw Error(error)},
  setRosterByCourseId:update=>{cache=update(cache);scope.rosterByCourseId=cache},window:{setTimeout:()=>{}}};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('  async function loadRoster('),source.indexOf('  async function loadLearningPathItems(')),scope);
 await scope.loadRoster(10);assert.equal(reads[0],'/api/class-roster/10?scope=section');assert.equal(cache[10].scope,'section');
 scope.isMasterWorkspace=true;await scope.loadRoster(10);assert.equal(reads[1],'/api/class-roster/10');assert.equal(cache[10].scope,'master');
 scope.isMasterWorkspace=false;await scope.loadRoster(10);assert.equal(reads[2],'/api/class-roster/10?scope=section');assert.equal(cache[10].scope,'section');
});
