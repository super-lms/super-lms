const TYPES = new Set(['Interim', 'Semester', 'Year Final']);
function validatePeriod(config) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!TYPES.has(config.type) || !valid(config.start) || !valid(config.end) || config.start > config.end || (Date.parse(config.end)-Date.parse(config.start))/86400000 > 366) throw new Error('Choose a report type and a valid date range of up to one year.');
  if (!['period','cumulative'].includes(config.gradeBasis)) throw new Error('Choose a grade calculation period.');
  return {type:config.type,start:config.start,end:config.end,gradeBasis:config.gradeBasis};
}
function courseMark(assignments, submissions, student, config) {
  const latest = new Map();
  for (const s of submissions) {
    if (String(s.student_id) === String(student.student_user_id) || String(s.student_email || '').toLowerCase() === String(student.student_email).toLowerCase()) latest.set(String(s.assignment_id), s);
  }
  const eligible = assignments.filter(a => a.reporting_date && a.reporting_date <= config.end && (config.gradeBasis === 'cumulative' || a.reporting_date >= config.start));
  const groups = new Map(); const scores = [];
  for (const a of eligible) {
    const raw = latest.get(String(a.id))?.score;
    if (raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw))) continue;
    const score = Number(raw); scores.push(score);
    if (a.subcategory_id && Number(a.course_weight_percent) > 0) {
      const key = String(a.subcategory_id);
      if (!groups.has(key)) groups.set(key,{weight:Number(a.course_weight_percent),scores:[]});
      groups.get(key).scores.push(score);
    }
  }
  let total = 0, weight = 0;
  for (const group of groups.values()) {total += group.scores.reduce((a,b)=>a+b,0)/group.scores.length*group.weight;weight+=group.weight;}
  const mark = weight ? total/weight : scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null;
  return {calculated_mark:mark===null?null:Math.round(mark*100)/100,graded_count:scores.length,assignment_count:eligible.length,unlinked_graded_count:eligible.filter(a=>{const s=latest.get(String(a.id));return s?.score!=null && (!a.subcategory_id || !(Number(a.course_weight_percent)>0));}).length};
}
module.exports = {validatePeriod,courseMark};
