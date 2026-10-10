import {forwardRef,useImperativeHandle,useState} from 'react';
import authFetch from '../services/authFetch';
import {reportPeriods,reportCardHtml,beijingToday} from '../services/reportCards.js';
const input={width:'100%',padding:10,boxSizing:'border-box',border:'1px solid #cbd5e1',borderRadius:6};
export default forwardRef(function ReportCardBuilder({courseId,courses,studentEmail,onMessage},ref){
 const [config,setConfig]=useState({type:'Interim',start:reportPeriods[0][1],end:reportPeriods[0][2],gradeBasis:'period'});
 const [selectedCourses,setSelectedCourses]=useState([String(courseId)].filter(Boolean));
 const [schoolName,setSchoolName]=useState('');const [reportDate,setReportDate]=useState(beijingToday());
 const [data,setData]=useState(null);const [selected,setSelected]=useState([]);const [saved,setSaved]=useState([]);const [busy,setBusy]=useState(false);const [dirty,setDirty]=useState(false);
 const settings={config,report_date:reportDate,school_name:schoolName,class_title:data?.class_title||''};
 function changeConfig(next){if(dirty&&!window.confirm('Discard unsaved report card changes?'))return;setConfig(next);setData(null);setDirty(false);}
 async function generate(){
  if(!courseId||!selectedCourses.length)return onMessage('Select a class and at least one report course.');
  if(dirty&&!window.confirm('Replace unsaved changes with current LMS data?'))return;
  setBusy(true);onMessage('Preparing report cards…');
  try{const response=await authFetch(`/api/classes/${courseId}/report-cards?${new URLSearchParams({...config,courseIds:selectedCourses.join(',')})}`);const result=await response.json();if(!response.ok)throw new Error(result.error);
   const cards=result.cards.filter(c=>(!studentEmail||c.student_email.toLowerCase()===studentEmail.toLowerCase())&&c.courses.length);
   setData({...result,cards});setSelected(cards.map(c=>c.student_user_id));setDirty(false);onMessage(cards.length?`${cards.length} report cards ready below. Review details, marks, attendance and comments before saving or printing.`:'No students are enrolled in the selected report courses.');
  }catch(error){onMessage(error.message);}finally{setBusy(false);}
 }
 function update(id,field,value,index){setData(current=>({...current,cards:current.cards.map(c=>c.student_user_id!==id?c:index==null?{...c,[field]:value}:{...c,courses:c.courses.map((x,i)=>i===index?{...x,[field]:value}:x)})}));setDirty(true);}
 const chosen=data?.cards.filter(c=>selected.includes(c.student_user_id))||[];
 async function save(){if(!chosen.length)return onMessage('Select at least one report card.');setBusy(true);try{
  const response=await authFetch(`/api/classes/${courseId}/report-cards`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...settings,cards:chosen})});const result=await response.json();if(!response.ok)throw new Error(result.error);setDirty(false);onMessage(`${result.saved} report cards saved. Saving again for the same student, type and dates updates your saved copy.`);
 }catch(error){onMessage(error.message);}finally{setBusy(false);}}
 function print(){if(!chosen.length)return onMessage('Generate or load report cards and select at least one student.');if(chosen.some(card=>card.courses.some(c=>c.mark_override!==''&&c.mark_override!=null&&(!Number.isFinite(Number(c.mark_override))||Number(c.mark_override)<0||Number(c.mark_override)>100))))return onMessage('Report marks must be between 0 and 100.');const popup=window.open('','_blank');if(!popup)return onMessage('Allow pop-ups to print report cards.');popup.document.write(reportCardHtml(chosen.map(card=>({...card,...settings})),settings));popup.document.close();popup.focus();}
 async function loadSaved(){setBusy(true);try{const response=await authFetch(`/api/classes/${courseId}/report-cards/saved`);const result=await response.json();if(!response.ok)throw new Error(result.error);setSaved(result);onMessage(result.length?'Choose a saved reporting period below.':'No saved report cards for this class yet.');}catch(error){onMessage(error.message);}finally{setBusy(false);}}
 function openSaved(key){if(dirty&&!window.confirm('Discard unsaved changes and open saved report cards?'))return;const rows=saved.filter(r=>`${r.card.config.type}|${r.card.config.start}|${r.card.config.end}|${r.card.config.gradeBasis}`===key&&(!studentEmail||r.card.student_email.toLowerCase()===studentEmail.toLowerCase()));const unique=new Map();for(const r of rows)if(!unique.has(r.card.student_user_id))unique.set(r.card.student_user_id,r.card);const cards=[...unique.values()];if(!cards.length)return onMessage('No saved cards match this student.');setConfig(cards[0].config);setSchoolName(cards[0].school_name||'');setReportDate(cards[0].report_date||beijingToday());setData({cards,class_title:cards[0].class_title});setSelected(cards.map(c=>c.student_user_id));setDirty(false);onMessage('Saved report cards loaded. These are saved copies; Generate Report refreshes them from current LMS records.');}
 useImperativeHandle(ref,()=>({generate,print}));
 return <section style={{marginTop:20}}>
  <h3>Report card setup</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16}}>
   <label>Card type<select style={input} value={config.type} onChange={e=>{const type=e.target.value,p=reportPeriods[type==='Interim'?0:type==='Semester'?4:6];changeConfig({...config,type,start:p[1],end:p[2]});}}>{['Interim','Semester','Year Final'].map(t=><option key={t}>{t}</option>)}</select></label>
   <label>School calendar preset<select style={input} value="" onChange={e=>{const p=reportPeriods.find(p=>p[0]===e.target.value);if(p)changeConfig({...config,start:p[1],end:p[2]});}}><option value="">Choose a preset</option>{reportPeriods.filter(p=>config.type==='Interim'?p[0].startsWith('Term'):config.type==='Semester'?p[0].startsWith('Semester'):p[0]==='Full year').map(p=><option key={p[0]}>{p[0]}</option>)}</select></label>
   {['start','end'].map(k=><label key={k}>{k==='start'?'Start date':'End date'}<input style={input} type="date" value={config[k]} onChange={e=>changeConfig({...config,[k]:e.target.value})}/></label>)}
   <label>Grade basis<select style={input} value={config.gradeBasis} onChange={e=>changeConfig({...config,gradeBasis:e.target.value})}><option value="period">Reporting period only</option><option value="cumulative">Cumulative through end date</option></select></label>
   <label>Report date Beijing<input style={input} type="date" value={reportDate} onChange={e=>{setReportDate(e.target.value);setDirty(true);}}/></label>
   <label>School name for printing<input style={input} value={schoolName} onChange={e=>{setSchoolName(e.target.value);setDirty(true);}} placeholder="Enter your school name"/></label>
  </div>
  <fieldset style={{marginTop:16}}><legend>Courses to include</legend><p>The selected class supplies the student roster. Add courses below; each student's card includes only courses they are enrolled in. Only courses you can manage are available.</p><div style={{display:'flex',flexWrap:'wrap',gap:16}}>{courses.map(c=><label key={c.id}><input type="checkbox" checked={selectedCourses.includes(String(c.id))} onChange={e=>{if(dirty&&!window.confirm('Discard unsaved changes?'))return;setSelectedCourses(e.target.checked?[...selectedCourses,String(c.id)]:selectedCourses.filter(id=>id!==String(c.id)));setData(null);setDirty(false);}}/> {c.title}</label>)}</div></fieldset>
  <p>Grades average scores within each graded category subgroup, then apply its course weight. If no graded weighted groups exist, an average of recorded scores is used. Assignment due dates determine the period, falling back to available or creation dates. Undated assignments are excluded. Blank scores are not zeros.</p>
  <button disabled={busy||!courseId} onClick={loadSaved}>Load saved report cards</button>
  {!!saved.length&&<label> Saved period <select style={{...input,width:'auto'}} value="" onChange={e=>openSaved(e.target.value)}><option value="">Choose saved cards</option>{[...new Set(saved.map(r=>`${r.card.config.type}|${r.card.config.start}|${r.card.config.end}|${r.card.config.gradeBasis}`))].map(key=><option key={key} value={key}>{key.replaceAll('|',' · ')}</option>)}</select></label>}
  {busy&&<p role="status">Please wait…</p>}
  {data&&<><h3>Review report cards</h3><p>Review student details and course comments. A report mark override affects this saved report only. Attendance is read from saved class sessions and must be corrected in Attendance. General report comments are copied when generating; edits here are saved with this period's report cards.</p><button onClick={()=>setSelected(data.cards.map(c=>c.student_user_id))}>Select all</button> <button onClick={()=>setSelected([])}>Clear selection</button> <button disabled={busy} onClick={save}>Save selected report cards</button> <button onClick={print}>Print selected / Save PDF</button><p>{selected.length} selected{dirty?' · Unsaved report changes':''}</p>
   {data.cards.map(card=><article key={card.student_user_id} style={{background:'#fff',border:'1px solid #cbd5e1',padding:20,borderRadius:8,marginTop:16}}>
    <h3><label><input type="checkbox" checked={selected.includes(card.student_user_id)} onChange={e=>setSelected(e.target.checked?[...selected,card.student_user_id]:selected.filter(id=>id!==card.student_user_id))}/> {card.student_name}</label></h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>{[['student_name','Student name'],['student_id','Student ID'],['pen','PEN'],['student_email','Email'],['student_grade','Grade'],['student_class','Class']].map(([key,label])=><label key={key}>{label}<input style={input} value={card[key]||''} onChange={e=>update(card.student_user_id,key,e.target.value)}/></label>)}</div>
    {(!card.pen||!card.student_grade||!card.student_class)&&<p>Some student details are missing. Complete them above for this report or update the student directory.</p>}
    {card.courses.map((c,index)=><section key={c.course_id} style={{marginTop:18,borderTop:'1px solid #ddd',paddingTop:12}}><h4>{c.title}</h4><p>Calculated mark: {c.calculated_mark==null?'Not graded':`${c.calculated_mark}%`} · {c.graded_count} of {c.assignment_count} assignments graded</p>{c.unlinked_graded_count>0&&<p>{c.unlinked_graded_count} graded assignments have no positive category weight. They are excluded when weighted groups exist. Review gradebook category links before finalizing.</p>}
     <label>Report mark override optional<input type="number" min="0" max="100" step="0.01" style={{...input,maxWidth:180,display:'block'}} value={c.mark_override??''} onChange={e=>update(card.student_user_id,'mark_override',e.target.value,index)}/></label>
     {['com1','com2'].map((k,i)=><label key={k} style={{display:'block',marginTop:10}}>Comment {i+1}<textarea style={input} rows={3} value={c[k]||''} onChange={e=>update(card.student_user_id,k,e.target.value,index)}/></label>)}
     <p>Attendance {c.sessions} saved sessions: {Object.entries(c.attendance).map(([k,v])=>`${k} ${v}`).join(' · ')}</p>
    </section>)}
   </article>)}
  </>}
 </section>;
});
