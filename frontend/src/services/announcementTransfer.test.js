import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../pages/AnnouncementsPage.jsx',import.meta.url),'utf8');
function handlers(){
 const added=[],errors=[];
 const scope={File,Date,Array,isImage:file=>/\.(png|jpe?g)$/i.test(file.name||''),addFiles:files=>added.push(...files),setError:error=>errors.push(error)};
 vm.createContext(scope);
 vm.runInContext(source.slice(source.indexOf('  function transferImages('),source.indexOf('  async function save(event)')),scope);
 return {scope,added,errors};
}
test('pasted clipboard image items and dropped files both attach screenshots without replacing message text',()=>{
 const {scope,added,errors}=handlers();let prevented=0;
 scope.pasteScreenshot({clipboardData:{files:[],items:[{kind:'file',getAsFile:()=>new File(['png'],'image.png',{type:'image/png'})}]},preventDefault:()=>prevented++});
 scope.dropScreenshot({dataTransfer:{files:[new File(['jpg'],'schedule.jpg',{type:''})]},preventDefault:()=>prevented++});
 assert.equal(prevented,2);assert.deepEqual(added.map(file=>[file.name,file.type]),[['image.png','image/png'],['schedule.jpg','image/jpeg']]);assert.equal(errors.length,0);
 scope.pasteScreenshot({clipboardData:{files:[],items:[]},preventDefault:()=>prevented++});assert.equal(prevented,2);
});
test('unsupported drops are intercepted without attaching or navigating away',()=>{
 const {scope,added,errors}=handlers();let prevented=false;
 scope.dropScreenshot({dataTransfer:{files:[new File(['svg'],'image.svg',{type:'image/svg+xml'})]},preventDefault:()=>prevented=true});
 assert.equal(prevented,true);assert.equal(added.length,0);assert.match(errors[0],/PNG or JPEG/);
});
