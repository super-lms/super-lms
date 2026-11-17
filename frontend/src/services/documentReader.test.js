import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readingParagraphs,speechChunks,readableFile,checkedReaderText,safeCourseDocumentPath,createDocumentSpeaker} from './documentReader.js';
test('paragraph extraction preserves sequence and long speech is chunked without losing words',()=>{
 assert.deepEqual(readingParagraphs('First line\r\nwrap.\r\n\r\nSecond.'),['First line wrap.','Second.']);
 const text=Array(300).fill('Learning English is useful.').join(' '),chunks=speechChunks(text);
 assert.ok(chunks.every(x=>x.length<=320));assert.equal(chunks.join(' '),text);
 assert.ok(speechChunks('a'.repeat(700)).every(x=>x.length<=320));
});
test('imports accept only supported files, reject empty/oversized text and external course URLs',()=>{
 for(const name of ['notes.DOCX','reading.pdf','lesson.txt'])assert.equal(readableFile(name),true);
 assert.equal(readableFile('old.doc'),false);assert.throws(()=>checkedReaderText('   '));assert.throws(()=>checkedReaderText('a'.repeat(200001)));
 assert.equal(safeCourseDocumentPath('/course-resources/lesson.pdf','https://school.example'),'/course-resources/lesson.pdf');
 for(const path of ['https://outside.example/course-resources/a.pdf','/course-resources/../api/users','/api/users','/course-resources/a.pdf?url=outside'])assert.throws(()=>safeCourseDocumentPath(path,'https://school.example'));
});
function fixture(){const spoken=[],states=[];let pauses=0,resumes=0;
 const synth={speak:u=>spoken.push(u),cancel(){},pause(){pauses++;},resume(){resumes++;}};
 class Utterance{constructor(text){this.text=text;}}
 return {spoken,states,get pauses(){return pauses},get resumes(){return resumes},reader:createDocumentSpeaker(synth,Utterance,s=>states.push(s)),voice:{name:'English',lang:'en-CA',localService:true}};
}
test('play, pause, resume and paragraph repeat follow the selected text',()=>{
 const f=fixture();f.reader.play(['First.','Second.'],0,{voice:f.voice,rate:0.85});assert.equal(f.spoken[0].text,'First.');assert.equal(f.spoken[0].rate,0.85);
 f.reader.pause();assert.equal(f.pauses,1);f.reader.resume();assert.equal(f.resumes,1);
 f.spoken[0].onend();assert.equal(f.spoken[1].text,'Second.');f.spoken[1].onend();assert.equal(f.states.at(-1).status,'finished');
 f.reader.play(['First.','Second.'],0,{voice:f.voice,rate:1},true);const count=f.spoken.length;f.spoken.at(-1).onend();assert.equal(f.spoken.length,count);assert.equal(f.states.at(-1).status,'stopped');
});
test('cancel prevents old callbacks reading a new document and remote voices cannot start',()=>{
 const f=fixture();f.reader.play(['First.','Second.'],0,{voice:f.voice,rate:1});const old=f.spoken[0];f.reader.stop();old.onend();assert.equal(f.spoken.length,1);
 f.reader.play(['Private text'],0,{voice:{localService:false},rate:1});assert.equal(f.spoken.length,1);assert.equal(f.states.at(-1).status,'error');
 f.reader.play(['New.'],0,{voice:f.voice,rate:1});f.reader.destroy();f.spoken.at(-1).onend();assert.equal(f.spoken.length,2);
});
test('an end event while paused waits for resume before advancing',()=>{
 const f=fixture();f.reader.play(['First.','Second.'],0,{voice:f.voice,rate:1});f.reader.pause();f.spoken[0].onend();assert.equal(f.spoken.length,1);f.reader.resume();assert.equal(f.spoken[1].text,'Second.');
});
