import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import authFetch from '../services/authFetch.js';
import './AnnouncementsPage.css';
const blank = () => ({title:'',body:'',event_date:'',pinned:false,files:[]});
export default function AnnouncementsPage() {
  const {user}=useAuth();
  const canPublish=['admin','teacher'].includes(user?.role);
  const [items,setItems]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState('');
  const [query,setQuery]=useState(''), [draft,setDraft]=useState(null), [files,setFiles]=useState([]), [remove,setRemove]=useState([]);
  const [busy,setBusy]=useState(false), [notice,setNotice]=useState(''), [preview,setPreview]=useState(null);
  const previewRef=useRef(null);
  async function load() {
    setError('');
    try { const res=await authFetch('/api/announcements'); const data=await res.json(); if(!res.ok)throw Error(data.error); setItems(data); }
    catch(err){setError(err.message||'Could not load announcements.');} finally {setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  useEffect(()=>{ if(preview)previewRef.current?.showModal(); return ()=>{if(preview?.url)URL.revokeObjectURL(preview.url);}; },[preview]);
  function edit(item=blank()) {setDraft({...item,event_date:item.event_date?.slice(0,10)||''});setFiles([]);setRemove([]);setError('');}
  async function save(event) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const data=new FormData(); for(const key of ['title','body','event_date','pinned'])data.append(key,String(draft[key]??''));
      data.append('remove_files',JSON.stringify(remove));for(const file of files)data.append('files',file);
      const res=await authFetch(`/api/announcements${draft.id?`/${draft.id}`:''}`,{method:draft.id?'PUT':'POST',body:data});
      const result=await res.json();if(!res.ok)throw Error(result.error);
      setDraft(null);setNotice('Announcement published. Students can now read it.');await load();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function deleteItem(item) {
    if(!window.confirm(`Delete “${item.title}” and its attachments?`))return;
    setBusy(true);setError('');try{const res=await authFetch(`/api/announcements/${item.id}`,{method:'DELETE'});if(!res.ok)throw Error((await res.json()).error);await load();setNotice('Announcement deleted.');}catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function openFile(file,download=false) {
    setError('');setBusy(true);
    try {
      const res=await authFetch(`/api/announcements/files/${file.id}${download?'':'?preview=true'}`);
      if(!res.ok)throw Error((await res.json()).error);
      if(!download && res.headers.get('content-type')?.includes('application/json')) {setPreview({name:file.filename,...await res.json()});return;}
      const blob=await res.blob(),url=URL.createObjectURL(blob);
      if(download){const link=document.createElement('a');link.href=url;link.download=file.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
      else setPreview({name:file.filename,url,type:blob.type});
    }catch(err){setError(err.message||'Unable to open this document.');}finally{setBusy(false);}
  }
  const visible=items.filter(item=>`${item.title} ${item.body} ${item.files.map(f=>f.filename).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="announcements-page">
    <Link to={user?.role==='student'?'/student':user?.role==='admin'?'/admin':'/dashboard'}>← Back to dashboard</Link>
    <header className="announcements-header"><div><p className="announcements-eyebrow">SCHOOL COMMUNITY</p><h1>Announcements</h1><p>School news, upcoming events, and documents to read or download.</p></div>{canPublish&&!draft&&<button className="btn" onClick={()=>edit()}>New announcement</button>}</header>
    {error&&<div role="alert" className="announcement-error">{error} <button onClick={load}>Retry loading</button></div>}
    {notice&&<p role="status">{notice}</p>}
    {draft&&<form className="announcement-card announcement-editor" onSubmit={save}>
      <h2>{draft.id?'Edit announcement':'New announcement'}</h2><p>Visible to all students and staff in your school.</p>
      <label>Title<input required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
      <label>Message<textarea required rows={6} maxLength={20000} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} placeholder="What do students need to know?"/></label>
      <label>Event date (optional)<input type="date" value={draft.event_date} onChange={e=>setDraft({...draft,event_date:e.target.value})}/></label>
      <label className="announcement-check"><input type="checkbox" checked={draft.pinned} onChange={e=>setDraft({...draft,pinned:e.target.checked})}/>Pin to the top</label>
      <label>Attach documents<input type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label>
      <small>PDF, Word (.docx), Excel (.xlsx), CSV, text, or images. Up to 5 files, 15 MB each.</small>
      {draft.files.filter(f=>!remove.includes(f.id)).map(f=><div key={f.id}>{f.filename} <button type="button" onClick={()=>setRemove([...remove,f.id])}>Remove attachment</button></div>)}
      {files.map((f,i)=><div key={i}>{f.name}</div>)}
      <div className="announcement-actions"><button className="btn" disabled={busy}>{busy?'Publishing…':'Publish announcement'}</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button></div>
    </form>}
    <label className="announcement-search">Search announcements<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search titles, messages, or document names"/></label>
    {loading?<p role="status">Loading announcements…</p>:visible.length===0?<div className="announcement-card">{query?'No announcements match your search.':'No announcements yet.'}</div>:visible.map(item=><article className="announcement-card" key={item.id}>
      <div className="announcement-meta">{item.pinned&&<strong>Pinned · </strong>}{new Date(item.created_at).toLocaleDateString()} · {item.author_name||'School staff'}</div>
      <h2>{item.title}</h2>{item.event_date&&<p><strong>Event:</strong> {new Date(`${item.event_date.slice(0,10)}T12:00:00`).toLocaleDateString()}</p>}
      <p className="announcement-message">{item.body}</p>
      {!!item.files.length&&<section aria-label="Documents"><h3>Documents</h3>{item.files.map(file=><div className="announcement-file" key={file.id}><span>{file.filename}</span><div className="announcement-actions"><button disabled={busy} onClick={()=>openFile(file)}>Open / Read</button><button disabled={busy} onClick={()=>openFile(file,true)}>Download</button></div></div>)}</section>}
      {canPublish&&(user.role==='admin'||Number(item.author_id)===Number(user.id))&&<div className="announcement-actions"><button disabled={busy} onClick={()=>edit(item)}>Edit</button><button disabled={busy} onClick={()=>deleteItem(item)}>Delete</button></div>}
    </article>)}
    {preview&&<dialog ref={previewRef} className="announcement-preview" onClose={()=>setPreview(null)}><div className="announcement-actions"><h2>{preview.name}</h2><button autoFocus onClick={()=>setPreview(null)}>Close</button></div>
      {preview.text!==undefined&&<pre>{preview.text}</pre>}
      {preview.sheets&&<><p>{preview.note}</p>{preview.sheets.map(sheet=><section key={sheet.name}><h3>{sheet.name}</h3><div className="announcement-table"><table><tbody>{sheet.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>i===0?<th key={j}>{String(cell)}</th>:<td key={j}>{String(cell)}</td>)}</tr>)}</tbody></table></div></section>)}</>}
      {preview.url&&(preview.type?.startsWith('image/')?<img src={preview.url} alt={preview.name}/>:<iframe title={preview.name} src={preview.url}/>)}
    </dialog>}
  </main>;
}
