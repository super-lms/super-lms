export function observerWorkStatus({assignment, submission, submissionStatus}, now = Date.now()) {
  if (submission?.score !== null && submission?.score !== undefined && submission?.score !== '' && Number.isFinite(Number(submission.score))) return 'graded';
  if (submissionStatus === 'submitted') return 'awaitingMark';
  const deadline = assignment?.due_date ? Date.parse(assignment.due_date) : NaN;
  if (Number.isFinite(deadline) && deadline < now) return 'overdue';
  return 'notSubmitted';
}
export function observerAttentionItems(items, now = Date.now()) {
  return items.filter(item => observerWorkStatus(item, now) !== 'graded');
}
export const observerCourseText = {
 en: {
  student:'Student', currentStanding:'Current Standing', lessons:'Lessons', courseIntro:'Course progress, assignments, grades, feedback, and learning evidence for this student.',
  chooseCourse:'Choose a course to view progress, assignments, grades, feedback, and work needing attention.', courseEvidence:'Course progress and learning evidence.',openCourse:'Open Course →',openStudent:'Open Student →',
  openGradebook:'Open Read-only Gradebook', gradebookTitle:'Read-only Student Gradebook', gradebookHelp:'Review course grades and feedback here. Only the BC course teacher can enter or change marks.',printGradebook:'Print Gradebook',
  proficiency:'Proficiency', gradedWeight:'Graded Weight',earnedPoints:'Earned Course Points', kduSnapshot:'KDU Evidence Snapshot',KNOW:'KNOW',DO:'DO',UNDERSTAND:'UNDERSTAND', kduHelp:'Average evidence level out of 6',
  pathways:'Grading Pathways and Evidence Tiers',noPathways:'No grading pathways are available for this course.',courseWeight:'Course Weight',gradedAssignments:'Graded Assignments',tierAverage:'Tier Average',courseContribution:'Course Contribution',of:'of',
  notAvailable:'Not available',notGraded:'Not graded',due:'Due',noDueDate:'No due date',status:'Status',graded:'Graded',awaitingMark:'Submitted — awaiting teacher marking',overdue:'Overdue — not submitted',notSubmitted:'Not submitted — not yet overdue',submitted:'Submitted',submission:'Submission',score:'Score',grade:'Grade',noFeedback:'No feedback yet',
  assessmentPathway:'Assessment Pathway',evidenceTier:'Evidence Tier',notAssigned:'Not assigned',attachments:'Attachments',attachedFile:'Attached file',
  loadingCourse:'Loading the full course view…',courseLoadError:'Course records could not be loaded.',retryHelp:'Please reopen this course or contact the school if the problem continues.',waitingGradebook:'Waiting for gradebook records…',waitingGradebookHelp:'Weighted course results will appear when loading is complete.',waitingCourse:'Waiting for the student’s course records…',waitingAssignments:'Assignments will appear after course data finishes loading.',
  noAttention:'No work currently needs attention in this course.',noAttentionHelp:'There is no unsubmitted work or submitted work awaiting a mark.',attentionHelp:'Click the summary cards to view details. A missing mark does not automatically mean missing work.',attentionReason:'Reason for attention',
  noWork:'No assignments or submissions found for this course.',noWorkHelp:'Work will appear here after the teacher publishes assignments.',waitingWork:'Assignments, submissions, grades, and feedback will appear after course data finishes loading.',
  lessonMaterials:'Lessons and Learning Materials',waitingLessons:'Waiting for lessons and learning materials…',waitingLessonsHelp:'Learning materials will appear after course data finishes loading.',noLessons:'No lessons are currently visible for this course.',noLessonsHelp:'Teacher-published lessons and learning materials will appear here.',noLessonDescription:'No lesson description provided.',
  courseSummary:'Read-only Course Summary',courseSummaryHelp:'Review assignments, deadlines, submission status, results, teacher feedback, and lessons. This view does not allow submission or changes to student records.',
  contactTeacher:'Contact BC Course Teacher',courseTeacher:'Course Teacher',emailTeacher:'Email Course Teacher',copyTeacherEmail:'Copy Teacher Email',copyWechat:'Copy WeChat Message',noTeacherContact:'No BC course teacher contact is assigned to this course.',copySnapshot:'Copy Student Snapshot',copyOutlook:'Copy Email for Outlook',printSnapshot:'Print Student Snapshot',
  noStudents:'No linked students found.',noStudentsHelp:'Ask the school office to link students to this observer account.',noCourses:'No courses found for this student.',noCoursesHelp:'No course records are currently visible for this linked student.',
  Extending:'Extending',Emerging:'Emerging',Superior:'Superior',Proficient:'Proficient',Satisfactory:'Satisfactory',Developing:'Developing',Beginning:'Beginning',Insufficient:'Insufficient',
 },
 zh: {
  student:'学生',currentStanding:'当前课程成绩',lessons:'课时',courseIntro:'查看该学生的课程进度、作业、成绩、教师反馈和学习表现。',
  chooseCourse:'请选择课程，查看学习进度、作业、成绩、教师反馈及需要关注的事项。',courseEvidence:'课程进度与学习表现。',openCourse:'查看课程 →',openStudent:'查看学生 →',
  openGradebook:'查看成绩册（只读）',gradebookTitle:'学生成绩册（只读）',gradebookHelp:'在此查看课程成绩和教师反馈。只有 BC 课程教师可以录入或修改成绩。',printGradebook:'打印成绩册',
  proficiency:'能力水平',gradedWeight:'已评分部分占课程权重',earnedPoints:'已获得的课程加权分',kduSnapshot:'KDU 学习表现概览',KNOW:'知识（KNOW）',DO:'技能（DO）',UNDERSTAND:'理解（UNDERSTAND）',kduHelp:'平均表现水平，满分为 6',
  pathways:'评价领域与学习表现层级',noPathways:'本课程暂无评价领域。',courseWeight:'课程权重',gradedAssignments:'已评分作业',tierAverage:'本层级平均分',courseContribution:'课程加权贡献',of:'/',
  notAvailable:'暂无',notGraded:'尚未评分',due:'截止时间',noDueDate:'未设置截止时间',status:'状态',graded:'已评分',awaitingMark:'已提交，等待教师评分',overdue:'已逾期，尚未提交',notSubmitted:'尚未提交，暂未逾期',submitted:'已提交',submission:'提交情况',score:'得分',grade:'成绩',noFeedback:'暂无教师反馈',
  assessmentPathway:'评价领域',evidenceTier:'学习表现层级',notAssigned:'未设置',attachments:'附件',attachedFile:'附件文件',
  loadingCourse:'正在加载课程详情…',courseLoadError:'无法加载课程记录。',retryHelp:'请重新打开课程；如问题持续，请联系学校。',waitingGradebook:'正在加载成绩册…',waitingGradebookHelp:'加载完成后将显示课程加权成绩。',waitingCourse:'正在加载学生课程记录…',waitingAssignments:'课程数据加载完成后将显示作业。',
  noAttention:'本课程目前没有需要关注的作业。',noAttentionHelp:'目前没有未提交的作业，也没有等待评分的已提交作业。',attentionHelp:'点击上方统计卡片可查看详情。没有成绩不一定表示缺交作业。',attentionReason:'需要关注的原因',
  noWork:'本课程暂无作业或提交记录。',noWorkHelp:'教师发布作业后将在此显示。',waitingWork:'课程数据加载完成后将显示作业、提交记录、成绩和教师反馈。',
  lessonMaterials:'课时与学习资料',waitingLessons:'正在加载课时和学习资料…',waitingLessonsHelp:'课程数据加载完成后将显示学习资料。',noLessons:'本课程目前暂无可查看的课时。',noLessonsHelp:'教师发布的课时与学习资料将在此显示。',noLessonDescription:'暂无课时说明。',
  courseSummary:'课程信息概览（只读）',courseSummaryHelp:'可查看作业、截止时间、提交情况、成绩、教师反馈和课时。本页面仅供查看，不能提交作业或修改学生记录。',
  contactTeacher:'联系 BC 课程教师',courseTeacher:'课程教师',emailTeacher:'发送邮件给课程教师',copyTeacherEmail:'复制教师邮箱',copyWechat:'复制微信消息',noTeacherContact:'本课程尚未设置 BC 课程教师联系方式。',copySnapshot:'复制学生学习概况',copyOutlook:'复制 Outlook 邮件内容',printSnapshot:'打印学生学习概况',
  noStudents:'暂无关联学生。',noStudentsHelp:'请联系学校，将学生与此观察者账号关联。',noCourses:'该学生暂无课程记录。',noCoursesHelp:'目前没有可供此账号查看的学生课程记录。',
  Extending:'拓展水平',Emerging:'起步水平',Superior:'优秀',Proficient:'熟练',Satisfactory:'达标',Developing:'发展中',Beginning:'起步阶段',Insufficient:'表现证据不足',
 }
};
export function observerCourseLabel(title, language) {
 const original=String(title || '');if(language !== 'zh')return original;
 const subjects={'Science':'科学','Social Studies':'社会研究','Chemistry':'化学','Physics':'物理','Accounting':'会计','Pre-Calculus':'预备微积分','PGEO':'自然地理','CTS':'计算机与技术','PE':'体育','English Studies':'英语学习','Composition':'英语写作','Drama':'戏剧','Grade 10 Literacy and Numeracy and Competency Uploads':'十年级读写、数学及能力材料上传'};
 for(const [english,chinese] of Object.entries(subjects))if(original===english||original.startsWith(english+' '))return `${original.replace(english,chinese)}（${original}）`;
 return original;
}
