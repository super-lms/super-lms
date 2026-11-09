import {useId} from 'react';
import {getEarnedPoints,getPointsPossible,isExcusedMark} from '../services/gradebookMarks.js';
import {displayAssignmentTime} from '../services/assignmentTime.js';
const percent=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?'—':`${Number(value).toFixed(1)}%`;
export default function ObserverSpreadsheetGradebook({assignments=[],scores=[],student,currentPercent,language='en'}) {
 const zh=language==='zh',id=useId();
 const marks=new Map(scores.map(score=>[String(score.assignment_id),score]));
 return <section className="observer-spreadsheet">
  <h3 id={id}>{zh?'电子表格成绩册（只读）':'Spreadsheet Gradebook — Read-only'}</h3>
  <p id={`${id}-help`}>{zh?'每列是一项作业。得分、百分比和当前课程成绩来自现有成绩册；此处不能修改成绩。使用左右方向键横向滚动。':'Each column is an assignment. Points, percentages and current standing come from the existing gradebook. Marks cannot be edited here. Focus the table and use Left/Right arrows to scroll.'}</p>
  {!assignments.length?<p>{zh?'本课程暂无可查看的作业。':'No visible assignments in this course yet.'}</p>:<div className="observer-spreadsheet-scroll" role="region" aria-labelledby={id} aria-describedby={`${id}-help`} tabIndex={0}>
   <table><caption>{student?.student_name || (zh?'学生':'Student')}</caption><thead><tr>
    <th scope="col" className="observer-spreadsheet-student">{zh?'学生':'Student'}</th>
    {assignments.map(assignment=><th scope="col" key={assignment.id}>
     <div>{assignment.title || (zh?'未命名作业':'Untitled assignment')}</div>
     <small>{zh?'满分':'Out of'} {getPointsPossible(assignment)}</small>
     {(assignment.category_name||assignment.subcategory_name)&&<small>{[assignment.category_name,assignment.subcategory_name].filter(Boolean).join(' · ')}</small>}
     <small>{assignment.due_date?displayAssignmentTime(assignment.due_date):(zh?'未设置截止日期':'No due date')}</small>
    </th>)}
    <th scope="col" className="observer-spreadsheet-current">{zh?'当前课程成绩（%）':'Current Grade (%)'}</th>
   </tr></thead><tbody><tr>
    <th scope="row" className="observer-spreadsheet-student"><strong>{student?.student_name}</strong><small>{student?.student_email?.startsWith('roster:')?'':student?.student_email}</small></th>
    {assignments.map(assignment=>{const mark=marks.get(String(assignment.id));const excused=isExcusedMark(mark),points=getEarnedPoints(assignment,mark);return <td key={assignment.id}>
     <strong>{excused?(zh?'EX — 免除':'EX — Excused'):points===''?'—':`${points} / ${getPointsPossible(assignment)}`}</strong>
     <small>{excused?(zh?'不计入课程成绩':'Excluded from course grade'):points===''?(zh?'尚未评分':'Not graded'):percent(mark?.score)}</small>
     {mark?.feedback&&<details><summary>{zh?'教师反馈':'Teacher feedback'}</summary><p>{mark.feedback}</p></details>}
    </td>})}
    <td className="observer-spreadsheet-current"><strong>{percent(currentPercent)}</strong>{currentPercent==null&&<small>{zh?'尚无已评分证据':'No graded evidence yet'}</small>}</td>
   </tr></tbody></table>
  </div>}
 </section>;
}
