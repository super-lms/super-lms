import {useState} from 'react';
import authFetch from '../services/authFetch';

function parseRows(text){
 return text.split(/\r?\n/).filter(line=>line.trim()).map((line,index)=>{
  const match=line.trim().match(/^(\d{6})[\t ,]+(.+)$/);
  if(!match)throw Error(`Line ${index+1}: use the six-digit Student ID followed by the full student name.`);
  return {student_id:match[1],name:match[2].trim()};
 });
}
export default function StudentIdImport({onImported}){
 const [text,setText]=useState(''),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 function change(value){setText(value);setPreview(null);setMessage('');setError('');}
 async function run(apply=false){
  setBusy(true);setError('');setMessage('');
  try{
   const rows=parseRows(text);
   const response=await authFetch('/api/users/student-id-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows,apply,expected:apply?preview?.expected:undefined})});
   const data=await response.json();if(!response.ok){setPreview(null);throw Error(data.error||'Unable to import Student IDs.');}
   if(apply){setPreview(null);setMessage(`${data.updated} Student IDs updated. Unmatched or conflicting rows were skipped. Preview again to review remaining rows.`);await onImported?.();}
   else setPreview(data);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const ready=preview?.preview.filter(row=>row.status==='Ready').length||0;
 return <section className="panel">
  <h3>Match and update six-digit Student IDs</h3>
  <p>Paste one six-digit Student ID followed by the full student name on each line, or choose a prepared text file. Use Student ID, not the nine-digit PEN. Only unique full-name matches are updated; existing accounts and marks are preserved.</p>
  <label className="form-label" htmlFor="student-id-file">Import prepared ID list</label>
  <input id="student-id-file" type="file" accept=".txt,.tsv" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{change(await file.text());}catch{setError('Unable to read this file.');}}}/>
  <label className="form-label" htmlFor="student-id-pairs" style={{display:'block',marginTop:12}}>Student IDs and names</label>
  <textarea id="student-id-pairs" className="form-input" rows={6} value={text} disabled={busy} onChange={e=>change(e.target.value)} placeholder={'100248 Aeris Jin Muxi\n100255 Angelo Lu Haoxiang'} style={{width:'100%',boxSizing:'border-box'}}/>
  <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
   <button className="secondary-btn" disabled={busy||!text.trim()} onClick={()=>run(false)}>{busy?'Working…':'Preview name matches'}</button>
   {preview&&<button className="primary-btn" disabled={busy||!ready} onClick={()=>run(true)}>Apply {ready} matched Student IDs</button>}
  </div>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  {preview&&<><p>{ready} ready · {preview.preview.filter(r=>r.status==='Already set').length} already correct · {preview.preview.filter(r=>r.status==='Review').length} need review. Review rows will be skipped.</p>
   <div style={{overflowX:'auto',maxHeight:520}}><table className="data-table"><thead><tr><th>Source name</th><th>Matched account</th><th>Current ID</th><th>New Student ID</th><th>Status</th></tr></thead><tbody>
    {preview.preview.map((row,index)=><tr key={index}><td>{row.source_name}</td><td>{row.name||'No unique match'}<br/>{row.email}</td><td>{row.previous_id||'—'}</td><td>{row.student_id}</td><td>{row.status}{row.issue&&<div>{row.issue}</div>}</td></tr>)}
   </tbody></table></div></>}
 </section>;
}
