const {courseMark} = require('./reportCards');
function calculateCourseRisk(courses, students, assignments, submissions) {
  const rows=[];
  for(const course of courses) {
    const contentId=Number(course.master_course_id || course.id);
    const work=assignments.filter(a=>Number(a.class_id)===contentId).map(a=>({...a,reporting_date:'2000-01-01'}));
    const evidence=submissions.filter(s=>Number(s.class_id)===contentId);
    for(const student of students.filter(s=>Number(s.class_id)===Number(course.id))) {
      const result=courseMark(work,evidence,{student_user_id:student.id,student_email:student.email},{gradeBasis:'cumulative',end:'9999-12-31'});
      if(result.calculated_mark===null || result.calculated_mark>=67) continue;
      rows.push({student_id:student.id,studentName:student.name || student.email,courseTitle:course.title,class_id:course.id,value:result.calculated_mark,label:result.calculated_mark<50?'Failing':result.calculated_mark<60?'At risk':'Watch closely'});
    }
  }
  return {students:rows.sort((a,b)=>a.value-b.value),student_count:new Set(rows.map(r=>String(r.student_id))).size};
}
async function loadCourseRisk(pool,courses,students) {
  const ids=[...new Set(courses.map(c=>Number(c.master_course_id || c.id)))];
  if(!ids.length)return {students:[],student_count:0};
  const assignments=await pool.query(`SELECT a.id,a.class_id,a.subcategory_id,((cc.weight_percent*cs.weight_percent_of_parent)/100.0) AS course_weight_percent FROM assignments a LEFT JOIN category_subcategories cs ON cs.id=a.subcategory_id LEFT JOIN course_categories cc ON cc.id=cs.course_category_id WHERE a.class_id=ANY($1::int[]) ORDER BY a.id`,[ids]);
  const submissions=await pool.query(`SELECT s.assignment_id,s.student_id,s.student_email,s.score,a.class_id FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.class_id=ANY($1::int[]) ORDER BY s.id`,[ids]);
  return calculateCourseRisk(courses,students,assignments.rows,submissions.rows);
}
module.exports={calculateCourseRisk,loadCourseRisk};
