import { useEffect, useState } from 'react';
import authFetch from '../services/authFetch';
export default function SubmissionDecisionMessages(){
 const [messages,setMessages]=useState([]),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  async function refresh(){try{const response=await authFetch('/api/assignments/submission-decisions');const data=await response.json();if(!response.ok)throw Error(data.error);if(active){setMessages(data.messages||[]);setError('');}}catch(error){if(active)setError(error.message);}}
  refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[]);
 if(!messages.length&&!error)return null;
 return <section role="status" style={{background:'#fff7ed',border:'1px solid #c58a37',borderRadius:12,padding:18,margin:18}}>
  <h2>Messages from your teacher</h2>
  {error&&<p>{error}</p>}
  {messages.map(message=><div key={message.id}><strong>{message.assignment_title} · {message.course_title}</strong><p>{message.message}</p></div>)}
 </section>;
}
