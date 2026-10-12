import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import authFetch from '../services/authFetch';
import {displayAssignmentTime} from '../services/assignmentTime';
export default function LateSubmissionAlerts(){
 const [alerts,setAlerts]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;async function refresh(){try{const response=await authFetch('/api/assignments/late-submission-alerts');const data=await response.json();if(!response.ok)throw Error(data.error);if(active){setAlerts(data.alerts||[]);setError('');}}catch(e){if(active)setError(e.message);}}refresh();const interval=setInterval(refresh,60000);return()=>{active=false;clearInterval(interval);};},[]);
 if(!alerts.length&&!error)return null;
 return <section style={{border:'1px solid #c58a37',borderRadius:12,padding:18,marginBottom:18,background:'#fffaf2'}}><h2>Past-due submission notices</h2><p>These students tried to submit after the deadline. Extend the assignment deadline for everyone, or approve one student in Grade Now. Times are Beijing time. This list refreshes every minute.</p>{error&&<p role="alert">{error}</p>}{alerts.map(a=>{const extended=!a.current_due_date||Date.parse(a.current_due_date)>Date.now();return <div key={`${a.assignment_id}-${a.student_id}-${a.due_at}`} style={{padding:'12px 0',borderTop:'1px solid #ddd'}}><strong>{a.student_name?.trim()||a.student_email}</strong> · {a.course_title} · {a.title}<p>Last blocked attempt: {displayAssignmentTime(a.last_attempt_at)} · Attempts: {a.attempt_count} · Deadline at attempt: {displayAssignmentTime(a.due_at)}</p><p>{a.approved?'Late submission approved':extended?'Deadline extended or removed':'Needs teacher review'}</p><Link to={`/assignments/${a.assignment_id}/edit`}>Extend deadline</Link>{' · '}<Link to={`/assignments/${a.assignment_id}/grade?sectionId=all`}>Grade Now / approve student</Link></div>;})}</section>;
}
