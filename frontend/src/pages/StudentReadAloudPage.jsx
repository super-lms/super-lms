import {useEffect,useMemo,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import authFetch from '../services/authFetch.js';
import API_BASE from '../apiBase.js';
import {MAX_READER_BYTES,MAX_READER_TEXT,readingParagraphs,extractReaderFile,createDocumentSpeaker,safeCourseDocumentPath} from '../services/documentReader.js';
import './StudentReadAloudPage.css';

export function DocumentReader({courseDocument=null}){
 const[text,setText]=useState(''),[name,setName]=useState('Pasted text'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[warning,setWarning]=useState('');
 const[voices,setVoices]=useState([]),[voiceId,setVoiceId]=useState(''),[rate,setRate]=useState(0.85),[position,setPosition]=useState(0),[playback,setPlayback]=useState({status:'stopped',index:0,error:''});
 const speaker=useRef(null),operation=useRef(0),paragraphs=useMemo(()=>readingParagraphs(text),[text]);
 const supported=typeof window!=='undefined'&&Boolean(window.speechSynthesis&&window.SpeechSynthesisUtterance);
 const selectedVoice=voices.find(v=>v.voiceURI===voiceId);
 const index=Math.min(position,Math.max(0,paragraphs.length-1));
 function stop(){speaker.current?.stop();setPosition(0);}
 useEffect(()=>{
  if(!supported)return()=>{operation.current++;};
  const synth=window.speechSynthesis;
  speaker.current=createDocumentSpeaker(synth,window.SpeechSynthesisUtterance,next=>{setPlayback(next);setPosition(next.index);});
  function loadVoices(){const list=synth.getVoices().filter(v=>v.localService===true).sort((a,b)=>Number(!/^en\b/i.test(a.lang))-Number(!/^en\b/i.test(b.lang))||a.name.localeCompare(b.name));setVoices(list);setVoiceId(old=>list.some(v=>v.voiceURI===old)?old:list[0]?.voiceURI||'');}
  const leavePage=()=>speaker.current?.destroy();
  loadVoices();synth.addEventListener('voiceschanged',loadVoices);window.addEventListener('pagehide',leavePage);
  return()=>{operation.current++;synth.removeEventListener('voiceschanged',loadVoices);window.removeEventListener('pagehide',leavePage);speaker.current?.destroy();};
 },[supported]);
 async function loadFile(file){
  if(!file)return;stop();const token=++operation.current;setBusy(true);setMessage('');setWarning('');
  try{const result=await extractReaderFile(file);if(token!==operation.current)return;setText(result.text);setName(file.name);setWarning(result.warning);setMessage('Document ready. Check the text order, then press Play.');}
  catch(error){if(token===operation.current)setMessage(error.message||'Could not read this document. Try pasting its text instead.');}
  finally{if(token===operation.current)setBusy(false);}
 }
 useEffect(()=>{
  if(!courseDocument)return;
  let cancelled=false;const token=++operation.current;setBusy(true);setMessage('Opening course document…');
  (async()=>{try{
   const path=safeCourseDocumentPath(courseDocument.file_path,window.location.origin);
   const response=await authFetch(`${API_BASE}${path}`);if(!response.ok)throw Error('This course document could not be opened. Download it from your course, then select the file here.');
   const length=Number(response.headers.get('Content-Length'));if(length>MAX_READER_BYTES)throw Error('Choose a document smaller than 20 MB.');
   const blob=await response.blob();if(cancelled||token!==operation.current)return;
   await loadFile(new File([blob],courseDocument.original_name||'document.txt',{type:blob.type}));
  }catch(error){if(!cancelled&&token===operation.current){setMessage(error.message);setBusy(false);}}})();
  return()=>{cancelled=true;operation.current++;};
 },[courseDocument]);
 function play(at=index,repeat=false){setMessage('');if(!selectedVoice||!paragraphs.length)return;speaker.current?.play(paragraphs,at,{voice:selectedVoice,rate:Number(rate)},repeat);}
 function move(delta){const at=Math.max(0,Math.min(index+delta,paragraphs.length-1)),playing=playback.status==='playing';speaker.current?.stop();setPosition(at);if(playing)play(at);}
 function edit(value){if(value.length>MAX_READER_TEXT){setMessage('Use up to 200,000 characters. Paste a shorter section.');return;}operation.current++;stop();setText(value);setName('Pasted text');setMessage('');setWarning('');}
 const ready=supported&&Boolean(selectedVoice)&&paragraphs.length>0&&!busy;
 return <div className="document-reader">
  <div className="reader-import"><label>Open a document<input type="file" accept=".txt,.docx,.pdf" disabled={busy} onChange={event=>{loadFile(event.target.files?.[0]);event.target.value='';}}/></label><span>Word (.docx), text or text-based PDF. Up to 20 MB.</span></div>
  <p className="reader-privacy">Files are processed in this page and are not uploaded or saved by this tool. Playback uses on-device voices.</p>
  {message&&<p role="status">{message}</p>}{warning&&<p role="status">{warning}</p>}{busy&&<p role="status">Reading document…</p>}
  {!supported&&<p role="alert">This browser does not support read aloud. Try Safari, Chrome or Edge on your device.</p>}
  {supported&&!voices.length&&<p role="status">No on-device voice is available yet. Install an English text-to-speech voice in your device settings, then reload this page.</p>}
  <div className="reader-options"><label>Voice<select aria-label="Reading voice" value={voiceId} onChange={e=>{stop();setVoiceId(e.target.value);}}><option value="" disabled>Choose an on-device voice</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label><label>Reading speed<select aria-label="Reading speed" value={rate} onChange={e=>{stop();setRate(Number(e.target.value));}}>{[0.5,0.65,0.85,1,1.15,1.3].map(value=><option key={value} value={value}>{value}×{value===1?' (normal)':''}</option>)}</select></label></div>
  <div className="reader-controls" role="group" aria-label="Reading controls">
   <button type="button" disabled={!ready} onClick={()=>playback.status==='paused'?speaker.current?.resume():play(playback.status==='finished'?0:index)}>Play</button>
   <button type="button" disabled={playback.status!=='playing'} onClick={()=>speaker.current?.pause()}>Pause</button>
   <button type="button" disabled={!paragraphs.length} onClick={stop}>Stop</button>
   <button type="button" disabled={!ready} onClick={()=>play(index,true)}>Repeat paragraph</button>
  </div>
  <div className="reader-navigation"><button type="button" disabled={!paragraphs.length||index===0||busy} onClick={()=>move(-1)}>Previous paragraph</button><span aria-live="polite">{paragraphs.length?`Paragraph ${index+1} of ${paragraphs.length}`:'No text loaded'} · {playback.status==='finished'?'Finished':playback.status}</span><button type="button" disabled={!paragraphs.length||index>=paragraphs.length-1||busy} onClick={()=>move(1)}>Next paragraph</button></div>
  {playback.error&&<p role="alert">{playback.error}</p>}
  {paragraphs.length>0&&<section className="reader-passage" aria-label="Current reading paragraph"><p>{paragraphs[index]}</p></section>}
  <label className="reader-text-label">Paste or edit the text<textarea aria-label="Text to read aloud" rows={10} disabled={busy} value={text} placeholder="Paste the text you want to listen to, or open a document above." onChange={e=>edit(e.target.value)}/></label>
  <div className="reader-navigation"><span>{name} · {text.length.toLocaleString()} characters</span><button type="button" disabled={busy||!text} onClick={()=>edit('')}>Clear text</button></div>
  <p className="reader-privacy">Scanned pages need text recognition first. Tables, equations and multi-column documents may read out of order. Text is cleared when you leave this page.</p>
 </div>;
}
export default function StudentReadAloudPage(){const location=useLocation(),navigate=useNavigate();return <main className="reader-page"><header><div><h1>Read aloud</h1><p>Listen to a document and follow the text at your own pace.</p></div><button type="button" onClick={()=>navigate('/student')}>Back to My Learning</button></header><DocumentReader courseDocument={location.state?.readerDocument||null}/></main>;}
