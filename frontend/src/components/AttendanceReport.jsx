import {forwardRef,useImperativeHandle,useState} from 'react';
import authFetch from '../services/authFetch';
import {attendanceRange,attendanceRows,attendancePrintHtml,schoolPeriods} from '../services/attendanceReport.js';
const input={padding:10,border:'1px solid #cbd5e1',borderRadius:6,width:'100%',boxSizing:'border-box'};
const cell={padding:10,border:'1px solid #cbd5e1',textAlign:'left'};
export default forwardRef(function AttendanceReport({courseId,studentEmail,onMessage},ref){
  const [period,setPeriod]=useState('Weekly');
  const [anchor,setAnchor]=useState(new Date().toISOString().slice(0,10));
  const [range,setRange]=useState(()=>attendanceRange('Weekly',new Date().toISOString().slice(0,10)));
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  async function generate(){
    if(!courseId) return onMessage('Please select a course.');
    if(!range.start||!range.end||range.start>range.end) return onMessage('Choose a valid start and end date.');
    setLoading(true);setData(null);onMessage('Loading attendance…');
    try{
      const response=await authFetch(`/api/classes/${courseId}/attendance-report?${new URLSearchParams(range)}`);
      const result=await response.json();if(!response.ok) throw new Error(result.error||'Could not load attendance.');
      setData(result);onMessage(result.sessions.length?'Attendance report ready below.':'No saved attendance sessions in this period.');
    }catch(error){onMessage(error.message);}finally{setLoading(false);}
  }
  const rows=data?attendanceRows(data,studentEmail):[];
  function print(){
    if(!data) return onMessage('Generate an attendance report first.');
    if(!rows.length) return onMessage('No enrolled students match this selection.');
    const popup=window.open('','_blank');if(!popup)return onMessage('Allow pop-ups to print the attendance report.');
    popup.document.write(attendancePrintHtml(data,rows,period));popup.document.close();popup.focus();
  }
  useImperativeHandle(ref,()=>({generate,print}));
  function choosePeriod(value,date=anchor){setPeriod(value);setRange(attendanceRange(value,date));setData(null);}
  return <section style={{marginTop:20}}>
    <h3>Attendance period</h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16}}>
      <label>Period<select style={input} value={period} onChange={e=>choosePeriod(e.target.value)}>{['Weekly','Monthly',...schoolPeriods.map(p=>p[0])].map(p=><option key={p}>{p}</option>)}</select></label>
      {['Weekly','Monthly'].includes(period)&&<label>Date within week / month<input style={input} type="date" value={anchor} onChange={e=>{setAnchor(e.target.value);choosePeriod(period,e.target.value);}}/></label>}
      {['start','end'].map(key=><label key={key}>{key==='start'?'Start date':'End date'}<input style={input} type="date" value={range[key]} onChange={e=>{setRange({...range,[key]:e.target.value});setData(null);}}/></label>)}
    </div>
    <p>Choose a period, then click Generate Report. Leave Student set to All students for a class report. Weeks run Monday–Sunday. Only saved sessions count; unrecorded entries are shown separately.</p>
    {loading&&<p role="status">Loading attendance…</p>}
    {data&&<><h3>{data.class.title} — Attendance</h3><p>{data.start} to {data.end} · {data.sessions.length} saved sessions</p><button onClick={print}>Print attendance / Save PDF</button><div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',marginTop:16}}><thead><tr>{['Student','Email','Present','Absent','Late','Excused','Unrecorded'].map(s=><th style={cell} key={s}>{s}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.student_user_id}><td style={cell}>{r.student_name}</td><td style={cell}>{r.student_email}</td>{Object.values(r.counts).map((count,i)=><td style={cell} key={i}>{count}</td>)}</tr>)}</tbody></table></div>{rows.length===1&&<table style={{borderCollapse:'collapse',width:'100%',marginTop:16}}><thead><tr>{['Date','Status','Notes'].map(s=><th style={cell} key={s}>{s}</th>)}</tr></thead><tbody>{rows[0].entries.map(r=><tr key={r.date}><td style={cell}>{r.date}</td><td style={cell}>{r.status}</td><td style={cell}>{r.note}</td></tr>)}</tbody></table>}{!rows.length&&<p>No enrolled students match this selection.</p>}</>}
  </section>;
});
