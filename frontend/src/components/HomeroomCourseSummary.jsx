import {useId} from 'react'
import {observerCourseLabel} from '../services/observerCourseView.js'

const text = {
 en: {title:'Student course summary',course:'Course',submitted:'Work submitted',average:'Score on submitted work',current:'Current weighted score',missing:'Unsubmitted assignments',tests:'Completed tests',loading:'Loading course summary…',unavailable:'Unavailable',notGraded:'Not graded yet',noWeighted:'No weighted score yet',noRequired:'No submission required',empty:'No linked courses for this student.',refresh:'Refresh summary',definitions:'How these figures are calculated',
  help:'Submission % = received work ÷ published work requiring submission; includes work awaiting approval and excludes excused work. Submitted-work score averages only marked submissions. Current course score is the existing weighted standing. Unsubmitted assignments exclude tests. Completed tests use recorded online assessment/quiz completions; repeat attempts count once.',
  scroll:'Scroll sideways for all columns. Keyboard: Tab to this table, then use Left/Right arrows.',
  missingHelp:'Returned/declined work requiring resubmission is counted as unsubmitted.'},
 zh: {title:'学生课程概览',course:'课程',submitted:'作业提交率',average:'已提交作业平均得分',current:'当前课程加权成绩',missing:'未提交作业数',tests:'已完成测试数',loading:'正在加载课程概览…',unavailable:'暂不可用',notGraded:'尚未评分',noWeighted:'暂无加权成绩',noRequired:'暂无需提交的作业',empty:'该学生暂无关联课程。',refresh:'刷新概览',definitions:'指标计算说明',
  help:'提交率＝已收到的作业÷已发布且需要提交的作业；包括等待批准的提交，不包括获准免交的作业。已提交作业平均分仅计算已评分的提交；未评分不按零分计算。当前课程成绩沿用现有加权成绩。未提交作业数不包括测试。已完成测试数依据系统中的在线测试及测验完成记录；重复尝试不重复计数。',
  scroll:'左右滚动查看所有列。键盘操作：按 Tab 聚焦此表格，再用左右方向键滚动。',
  missingHelp:'已退回或已拒绝、需要重新提交的作业计入未提交作业。'},
}

export default function HomeroomCourseSummary({studentName,rows,loading,language='en',onRefresh,onOpenCourse}) {
 const t=text[language]||text.en
 const id=useId()
 const percent=value=>`${Number(value).toFixed(1)}%`
 return <section className="homeroom-course-summary" aria-labelledby={`${id}-title`} style={{background:'#fff',border:'1px solid #94a3b8',borderRadius:12,padding:16,marginBottom:20,minWidth:0}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
   <h2 id={`${id}-title`} style={{margin:'0 0 8px',fontSize:'1.25rem'}}>{t.title} — {studentName}</h2>
   <button type="button" onClick={onRefresh} disabled={loading} style={buttonStyle}>{t.refresh}</button>
  </div>
  <details style={{margin:'8px 0 12px',color:'#475569',lineHeight:1.5}}>
   <summary style={{cursor:'pointer',fontWeight:700}}>{t.definitions}</summary>
   <p id={`${id}-help`}>{t.help} {t.missingHelp}</p>
  </details>
  {loading ? <p role="status">{t.loading}</p> : null}
  {!loading&&rows.length===0 ? <p>{t.empty}</p> : null}
  {rows.length>0 ? <>
   <p id={`${id}-scroll`} style={{color:'#475569',fontSize:14}}>{t.scroll}</p>
   <div className="homeroom-summary-table" role="region" aria-label={t.title} aria-describedby={`${id}-scroll`} aria-busy={loading} tabIndex={0} style={{overflowX:'auto',maxWidth:'100%'}}>
    <table style={{minWidth:900}}><caption style={{textAlign:'left',fontWeight:700,padding:'8px 0'}}>{studentName}</caption>
     <thead><tr>{[t.course,`${t.submitted} %`,`${t.average} %`,`${t.current} %`,t.missing,t.tests].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
     <tbody>{rows.map(row=>{const data=row.data;const unavailable=loading||row.error||!data;const message=loading?t.loading:t.unavailable;return <tr key={row.course.class_id}>
      <th scope="row" style={{textTransform:'none',fontSize:14,color:'#111827'}}><button type="button" onClick={()=>onOpenCourse(row.course)} style={buttonStyle}>{observerCourseLabel(row.course.class_name,language)}</button></th>
      <td>{unavailable?message:!data.submissionAvailable?t.unavailable:data.submissionPercent===null?t.noRequired:<>{percent(data.submissionPercent)} <span style={{display:'block',fontSize:13}}>({data.submittedCount}/{data.requiredCount})</span></>}</td>
      <td>{unavailable?message:!data.submissionAvailable?t.unavailable:data.submittedAverage===null?t.notGraded:percent(data.submittedAverage)}</td>
      <td>{unavailable?message:data.currentPercent===null?t.noWeighted:percent(data.currentPercent)}</td>
      <td>{unavailable?message:data.missingAssignments===null?t.unavailable:data.missingAssignments}</td>
      <td>{unavailable?message:data.completedTests===null?t.unavailable:data.completedTests}</td>
     </tr>})}</tbody>
    </table>
   </div>
  </> : null}
 </section>
}
const buttonStyle={padding:'9px 12px',border:'1px solid #64748b',borderRadius:8,background:'#fff',color:'#1e40af',font:'inherit',fontWeight:700,cursor:'pointer',textAlign:'left'}
