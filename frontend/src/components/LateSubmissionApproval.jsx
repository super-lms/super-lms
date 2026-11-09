import {lateApprovalState} from '../services/lateApprovalVisibility';
import {useEffect,useState} from 'react';
import authFetch from '../services/authFetch';
import {displayAssignmentTime} from '../services/assignmentTime';
export default function LateSubmissionApproval({assignmentId,studentEmail,onApproved,workAfterActions=false}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const refresh=()=>setNow(Date.now());const timer=setInterval(refresh,1000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 const url=`/api/assignments/${assignmentId}/late-submission?student_email=${encodeURIComponent(studentEmail||'')}`;
 useEffect(()=>{let active=true;setData(null);setError('');if(studentEmail)authFetch(url).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);if(active)setData(b);}).catch(e=>{if(active)setError(e.message);});return ()=>{active=false;};},[url,studentEmail]);
 async function change(){
  setBusy(true);setError('');
  try{
   const res=await authFetch(`/api/assignments/${assignmentId}/late-submission`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({student_email:studentEmail,enabled:!data.enabled})});
   const b=await res.json();if(!res.ok)throw Error(b.error);
   const refreshed=await authFetch(url);const current=await refreshed.json();if(!refreshed.ok)throw Error(current.error);
   setData(current);if(b.enabled)await onApproved?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function decline(disposition){
  if(disposition==='delete'&&!window.confirm('Permanently delete the pending late work and notify this student that it was declined? Earlier submitted or marked work will be kept.'))return;
  setBusy(true);setError('');
  try{
   const response=await authFetch(`/api/assignments/${assignmentId}/late-submission/decline`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({student_email:studentEmail,disposition,confirm_delete:disposition==='delete'})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   const refreshed=await authFetch(url);const current=await refreshed.json();if(!refreshed.ok)throw Error(current.error);
   setData(current);await onApproved?.();
  }catch(error){setError(error.message);}finally{setBusy(false);}
 }
 async function download(item){
  setError('');
  try{
   const response=await authFetch(`/api/assignments/${assignmentId}/late-submission/files/${item.id}?student_email=${encodeURIComponent(studentEmail)}`);
   if(!response.ok)throw Error('Unable to download held file. Refresh the page and try again.');
   const objectUrl=URL.createObjectURL(await response.blob());
   const link=document.createElement('a');link.href=objectUrl;link.download=item.original_name;link.click();URL.revokeObjectURL(objectUrl);
  }catch(e){setError(e.message);}
 }
 const visibility=lateApprovalState(data,now);
 if(!data)return error?<p role="alert">{error}</p>:null;
 if(visibility==='hidden')return null;
 const heldWork = (data.held_work?.length>0 || data.retained_work?.length>0)&&<div><h4>{data.decline?'Retained declined work':'Held work'}</h4><p>Approve this work before entering marks.</p>{[...(data.held_work||[]),...(data.retained_work||[])].map(item=><div key={item.id} style={{marginBottom:12}}>
    <p>{item.method==='attachment'?item.original_name:'Written response'} · Received {displayAssignmentTime(item.received_at)}</p>
    {item.method==='text'?<div style={{whiteSpace:'pre-wrap'}}>{item.content}</div>:<button type="button" onClick={()=>download(item)}>Download held file</button>}
   </div>)}</div>;
 const permissionOnly=visibility==='permission_only';
 const Container=permissionOnly?'details':'section';
 return <Container style={{border:'1px solid #d7dce5',borderRadius:12,padding:16,margin:'12px 0',background:'#fff'}}>
  {permissionOnly?<summary style={{cursor:'pointer',fontWeight:700}}>Late-submission settings — no work awaiting approval</summary>:<h3>{visibility==='previous_work'?'Previously held submission':'Past-due submission approval'}</h3>}
  {visibility==='previous_work'&&<p>The current deadline has not passed or has been removed. New submissions do not need late approval. The saved work below was held or declined earlier and still needs review.</p>}
  {permissionOnly?<p>No saved work is awaiting late approval. Existing submitted work can still be reviewed and marked. Passing the deadline does not make an earlier submission late. These settings only control new late submissions or resubmissions.</p>:<p>Late work is saved and held until approved. Approval releases the saved work for marking; the student does not need to submit it again. The student can also resubmit after approval until you revoke it.</p>}
  {error&&<p role="alert">{error}</p>}
  {data?<>
   <p>Deadline: {data.due_date?displayAssignmentTime(data.due_date):'No deadline set'}</p>
   <p><strong>{data.decline?'Submission declined — student must see the teacher':data.enabled?'Late submission approved for this student':data.held_work?.length?'Saved work awaiting teacher approval':'New late submissions are not enabled'}</strong></p>
   {!workAfterActions&&heldWork}
   <button type="button" disabled={busy} onClick={change}>{busy?'Saving…':data.enabled?'Revoke late approval':data.held_work?.length?'Approve saved work for marking':'Approve late submission'}</button>
   {data.held_work?.length>0&&!data.enabled&&!data.decline&&<button type="button" disabled={busy} onClick={()=>decline('keep')} style={{marginLeft:12,color:'#991b1b'}}>Decline and keep saved work</button>}
   {data.held_work?.length>0&&!data.enabled&&!data.decline&&<button type="button" disabled={busy} onClick={()=>decline('delete')} style={{marginLeft:12,color:'#991b1b'}}>Decline and delete saved work</button>}
   {workAfterActions&&heldWork}
   {data.decline&&<p role="status">The student has been notified to see their teacher. {data.decline.work_deleted?'Pending late work was deleted. Approval above will allow the student to submit again after your conversation.':'Saved work is retained. Approval above will release it for marking after your conversation.'}</p>}
   {data.permissions[0]&&<p>Last action: {data.decline?'Declined':data.permissions[0].enabled?'Approved':'Revoked'} by {data.permissions[0].teacher_name || 'Teacher'} · {displayAssignmentTime(data.permissions[0].created_at)}</p>}
   {data.acceptances.length>0&&<><h4>Accepted PAST DUE</h4>{data.acceptances.map(e=><p key={e.id}>{e.method==='attachment'?'File uploaded':'Text submitted'} · {displayAssignmentTime(e.accepted_at)} · Original deadline: {displayAssignmentTime(e.due_at)} · Approved by {e.teacher_name || 'Teacher'}</p>)}</>}
  </>:!error&&<p>Loading approval…</p>}
 </Container>;
}
