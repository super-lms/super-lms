export const MAX_READER_BYTES=20*1024*1024;
export const MAX_READER_TEXT=200000;
export function readableFile(name){return /\.(txt|docx|pdf)$/i.test(String(name||''));}
export function readingParagraphs(text){return String(text||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);}
export function speechChunks(text,limit=320){
 const words=String(text||'').trim().split(/\s+/).filter(Boolean),out=[];let current='';
 for(const word of words){if(current&&current.length+word.length+1>limit){out.push(current);current='';}if(word.length>limit){if(current){out.push(current);current='';}for(let i=0;i<word.length;i+=limit)out.push(word.slice(i,i+limit));}else current+=(current?' ':'')+word;}
 if(current)out.push(current);return out;
}
export function checkedReaderText(text){const value=String(text||'').replace(/\u0000/g,'').trim();if(!value)throw Error('No readable text was found. Scanned PDFs and photographs need text recognition first.');if(value.length>MAX_READER_TEXT)throw Error('This document has too much text. Use a shorter section (up to 200,000 characters).');return value;}
export function safeCourseDocumentPath(path,origin){const url=new URL(String(path||''),origin);if(url.origin!==origin||!url.pathname.startsWith('/course-resources/')||url.search||url.hash)throw Error('Choose a document from your course resources.');return url.pathname;}
export async function extractReaderFile(file){
 if(!readableFile(file.name))throw Error('Choose a .docx Word document, .txt file, or text-based PDF. Older .doc files must first be saved as .docx.');
 if(file.size>MAX_READER_BYTES)throw Error('Choose a document smaller than 20 MB.');
 const ext=file.name.split('.').pop().toLowerCase();let text='',warning='';
 if(ext==='txt')text=await file.text();
 else if(ext==='docx'){
  const imported=await import('mammoth/mammoth.browser.js'),mammoth=imported.default||imported;
  text=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;
 }else{
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/legacy/build/pdf.worker.mjs',import.meta.url).href;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
  let pdf;
  try{pdf=await task.promise;if(pdf.numPages>200)throw Error('Choose a PDF with 200 pages or fewer.');const pages=[];let empty=0,total=0;
   for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();const value=content.items.map(item=>'str'in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();if(!value)empty++;pages.push(value);total+=value.length;if(total>MAX_READER_TEXT)throw Error('Use a shorter document section (up to 200,000 characters).');page.cleanup();}
   text=pages.join('\n\n');if(empty&&text.trim())warning=`${empty} of ${pdf.numPages} pages had no readable text and will be skipped.`;
  }catch(error){if(error.name==='PasswordException')throw Error('This PDF is password-protected. Use an unlocked copy.');throw error;}finally{await task.destroy();}
 }
 return {text:checkedReaderText(text),warning};
}

// Only in-memory playback state. No network, browser storage or LMS writes.
export function createDocumentSpeaker(synth,Utterance,onState){
 let version=0,current=null,paragraphs=[],index=0,part=0,repeat=false,paused=false,options={};
 const emit=(status,error='')=>onState({status,index,error});
 function cancel(){version++;synth.cancel();current=null;}
 function speak(){
  if(paused)return;
  if(index>=paragraphs.length){emit('finished');return;}
  const chunks=speechChunks(paragraphs[index]);
  if(part>=chunks.length){if(repeat){part=0;emit('stopped');return;}index++;part=0;speak();return;}
  const token=version;current=new Utterance(chunks[part]);current.voice=options.voice;current.lang=options.voice.lang;current.rate=options.rate;
  current.onend=()=>{if(token!==version)return;current=null;part++;speak();};
  current.onerror=event=>{if(token!==version)return;current=null;emit('error',`Playback stopped (${event.error||'voice unavailable'}). Try Play again or choose another voice.`);};
  emit('playing');synth.speak(current);
 }
 return {
  play(items,start,settings,repeatOnly=false){cancel();paused=false;paragraphs=items;index=Math.max(0,Math.min(start,items.length-1));part=0;repeat=repeatOnly;options=settings;if(!items.length)return;if(!settings.voice?.localService){emit('error','Choose an on-device voice before playing.');return;}speak();},
  pause(){paused=true;synth.pause();emit('paused');},resume(){paused=false;if(current){synth.resume();emit('playing');}else speak();},
  stop(){cancel();paused=false;part=0;index=0;emit('stopped');},destroy(){cancel();},
 };
}
