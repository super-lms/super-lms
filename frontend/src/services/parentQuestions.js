// Deliberately limited to record-backed questions; unknown requests never invent answers.
export const parentQuestions = [
  { id: 'missing', zh: '我的孩子有多少作业逾期未交？', en: 'How many assignments are overdue and missing?' },
  { id: 'work', zh: '给我看一份分数较低的作业和老师评语', en: 'Show a lower-mark work sample and teacher feedback' },
  { id: 'attendance', zh: '我的孩子哪些日期缺勤或迟到？', en: 'Which dates was my child absent or late?' },
  { id: 'upcoming', zh: '未来七天有哪些作业要交？', en: 'What assignments are due in the next seven days?' },
  { id: 'feedback', zh: '老师最近给了什么反馈？', en: 'What teacher feedback is available?' },
  { id: 'grades', zh: '查看各科成绩', en: 'Show course grades' },
  { id: 'lessons', zh: '在哪里看课程学习资料？', en: 'Where are the learning materials?' },
  { id: 'calendar', zh: '打开学校日历', en: 'Open the school calendar' },
]

export function questionIntent(question) {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (/缺勤|缺席|旷课|曠課|缺课|缺課|考勤|出勤|迟到|遲到|请假|請假|attendance|absen|late to class/.test(q)) return 'attendance'
  if (/低分|较低|較低|最低|不及格|样本|樣本|作品|low.*(mark|score|grade)|work sample|sample of.*work/.test(q)) return 'work'
  if (/缺交|欠交|漏交|没交|沒交|未交|未提交|missing|overdue|未完成/.test(q)) return 'missing'
  if (/未来|未來|下周|下週|这周|這週|本周|本週|截止|到期|要交|upcoming|due|next week/.test(q)) return 'upcoming'
  if (/评语|評語|反馈|反饋|老師.*说|老师.*说|feedback|comment/.test(q)) return 'feedback'
  if (/成绩|成績|分数|分數|各科|grade|score|progress|doing/.test(q)) return 'grades'
  if (/资料|資料|课件|課件|课程|課程|lesson|material|course/.test(q)) return 'lessons'
  if (/日历|日曆|校历|校曆|calendar/.test(q)) return 'calendar'
  return null
}

export function courseItems(data, course) {
  return (Array.isArray(data?.assignments) ? data.assignments : []).map(assignment => {
    const state = data.submissionStatesByAssignmentId?.[String(assignment.id)] || {}
    return { assignment, submission: state.submission || null, status: state.submission_status || 'not_submitted', course }
  })
}
export function numericScore(item) {
  const value = item.submission?.score
  return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
}
export function missingWork(items, now = Date.now()) {
  return items.filter(item => item.assignment?.submission_required !== false && numericScore(item) === null &&
    ['not_submitted', 'declined'].includes(item.status) &&
    Number.isFinite(Date.parse(item.assignment.due_date)) && Date.parse(item.assignment.due_date) < now)
}
export function upcomingWork(items, now = Date.now()) {
  return items.filter(item => item.assignment?.submission_required !== false && numericScore(item) === null && ['not_submitted', 'declined'].includes(item.status) &&
    Date.parse(item.assignment.due_date) >= now && Date.parse(item.assignment.due_date) <= now + 7 * 86400000)
    .sort((a,b) => Date.parse(a.assignment.due_date) - Date.parse(b.assignment.due_date))
}
export function lowerMarkWork(items) {
  return items.filter(item => numericScore(item) !== null).sort((a,b) => numericScore(a) - numericScore(b)).slice(0,3)
}
