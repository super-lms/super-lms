import {useState} from 'react';
import authFetch from '../services/authFetch';
export default function ClassLateSubmissionApproval({assignment,sectionId,classTitle,studentCount,onApproved}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  if(!assignment || assignment.submission_required===false)return null;
  const chosen=sectionId && sectionId!=='all';
  async function save(enabled){
    setBusy(true);setError('');setNotice('');
    try{
      const response=await authFetch(`/api/assignments/${assignment.id}/late-submission/class`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sectionId:Number(sectionId),enabled})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      setNotice(`${enabled?'Late submissions approved':'Late approval revoked'} for ${result.students} students in ${classTitle}. ${result.promoted} saved items released for marking.${result.skipped_declined?` ${result.skipped_declined} students with declined work still need individual review.`:''}`);
      await onApproved?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section style={{border:'1px solid #d7dce5',borderRadius:12,padding:16,margin:'12px 0'}}>
    <h3>Whole class late-submission approval</h3>
    <p>Optional for this assignment. On-time submissions never need late approval. Approving the class releases saved late work and allows late submissions from currently enrolled students until revoked.</p>
    <p>{chosen?`${classTitle} · ${studentCount} students`:'Choose an individual class section above to use whole class approval.'} Students with declined work still need individual review.</p>
    <button type="button" disabled={!chosen||busy} onClick={()=>save(true)}>{busy?'Saving…':'Approve late submissions for whole class'}</button>{' '}
    <button type="button" disabled={!chosen||busy} onClick={()=>save(false)}>Revoke whole class late approval</button>
    <p>Revoking approval affects future late submissions. It keeps already accepted work and marks.</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}
