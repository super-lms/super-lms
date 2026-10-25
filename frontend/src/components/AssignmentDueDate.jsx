import {useState} from 'react'
import AssignmentDateTime from './AssignmentDateTime.jsx'
import authFetch from '../services/authFetch'
export default function AssignmentDueDate({value,onChange,min,style,assignmentId,onSaved}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 async function noDueDate(){
  setMessage('');setError('')
  if(!assignmentId){onChange('');setMessage('No due date selected. Save the assignment to apply.');return}
  try{setBusy(true);const response=await authFetch(`/api/assignments/${assignmentId}/no-due-date`,{method:'POST'});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not remove the due date.');onChange('');onSaved?.(data);setMessage(`No due date saved. Submissions are accepted without late approval.${data.released?` ${data.released} previously held work items released for marking.`:''}`)}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div>
  <AssignmentDateTime value={value} onChange={v=>{setMessage('');setError('');onChange(v)}} min={min} style={style}/>
  <button type="button" disabled={busy} onClick={noDueDate} style={{marginTop:10,padding:'9px 12px',border:'1px solid #cbd5e1',borderRadius:8,font:'inherit',fontWeight:700,cursor:'pointer'}}>{busy?'Saving…':'No Due Date — Accept Submissions'}</button>
  <p style={{fontSize:14,lineHeight:1.5,marginBottom:0}}>{value?'After this deadline, late work requires approval.':'No due date: new submissions are accepted without late approval once the assignment is published and available.'} {assignmentId?'This button saves the deadline change immediately and releases pending late work for this assignment.':''}</p>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert" style={{color:'#991b1b'}}>{error}</p>}
 </div>
}
