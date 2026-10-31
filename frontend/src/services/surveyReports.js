export const COMPETENCIES_SURVEY_ID = '1cf48748-394b-41e0-b945-f4be6acc8a0c';
export const normalizeEmail = value => String(value ?? '').trim().toLowerCase();
function readJson(value, fallback) {
  try { return typeof value === 'string' ? JSON.parse(value) : value ?? fallback; }
  catch { return fallback; }
}
export function normalizeSurveyResponse(raw) {
  const student = readJson(raw.student, {}), answers = readJson(raw.answers, null), questions = readJson(raw.questions, null);
  const valid = student && !Array.isArray(student) && typeof student === 'object' &&
    answers && !Array.isArray(answers) && typeof answers === 'object' && Array.isArray(questions) &&
    questions.every(q => q && typeof q === 'object' && typeof q.id === 'string' && typeof q.title === 'string');
  return { ...raw, student: student && typeof student === 'object' ? student : {},
    answers: answers && typeof answers === 'object' ? answers : {}, questions: Array.isArray(questions) ? questions : [],
    readable: Boolean(valid) };
}
function studentKey(response) {
  // No name-only merging: different children may share a name.
  return normalizeEmail(response.student.email) || `response:${response.id}`;
}
export function buildSurveyReportRows(rawResponses, roster = null, includeUnmatchedResponses = false) {
  const grouped = new Map();
  for (const raw of rawResponses) {
    const response = normalizeSurveyResponse(raw), key = studentKey(response);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(response);
  }
  for (const responses of grouped.values()) responses.sort((a, b) =>
    (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0) || String(b.id).localeCompare(String(a.id)));
  if (roster !== null) {
    const rosterEmails = new Set(roster.map(student => normalizeEmail(student.student_email)).filter(Boolean));
    const rosterRows = roster.map(student => {
      const email = normalizeEmail(student.student_email), responses = email ? grouped.get(email) || [] : [];
      return { key: `student:${student.student_user_id}`, name: student.student_name || email || 'Unnamed student',
        email, responses, latest: responses[0] || null, status: responses.length ? 'submitted' : 'pending' };
    });
    // Whole-school reports must retain submitted responses even when the email
    // is not found in the school directory. Cohort lists remain roster-limited.
    if (includeUnmatchedResponses) {
      for (const [key, responses] of grouped) {
        if (!rosterEmails.has(key)) rosterRows.push({ key: `unmatched:${key}`,
          name: responses[0].student.name || responses[0].student.email || 'Unnamed student',
          email: normalizeEmail(responses[0].student.email), responses, latest: responses[0], status: 'submitted' });
      }
    }
    return rosterRows.sort(sortRows);
  }
  return Array.from(grouped, ([key, responses]) => ({ key,
    name: responses[0].student.name || responses[0].student.email || 'Unnamed student',
    email: normalizeEmail(responses[0].student.email), responses, latest: responses[0], status: 'submitted' })).sort(sortRows);
}
function sortRows(a, b) { return a.name.localeCompare(b.name) || a.email.localeCompare(b.email); }
export function formatSurveyDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai',
  }).format(date) + ' (China time)';
}
const textValue = value => value === undefined || value === null || value === '' ? 'No response' :
  typeof value === 'object' ? JSON.stringify(value) : String(value);
export function surveyAnswerLines(question, value) {
  if (Array.isArray(value)) {
    return value.map((answer, index) => question.type === 'Ranking'
      ? `${index + 1}. ${textValue(answer)}`
      : `${question.options?.[index] || `Item ${index + 1}`}: ${textValue(answer)}`);
  }
  if (question.type === 'Rating' && question.ratingLabels?.length && value !== '' && value != null) {
    const label = question.ratingLabels[Number(value) - 1];
    if (label) return [`${label} (${value})`];
  }
  return [textValue(value)];
}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function buildSurveyPrintHtml(survey, responses) {
  if (!responses.length) throw new Error('Select at least one submitted report to print.');
  if (responses.some(response => !response.readable)) throw new Error('A stored response could not be read. Open it for details before printing.');
  const e = escapeHtml;
  const articles = responses.map(response => {
    const student = response.student;
    return `<article><header><h1>${e(survey.title)}</h1><p>Competencies self-reflection — student responses</p>
      <h2>${e(student.name)}${student.chineseName ? ` · ${e(student.chineseName)}` : ''}</h2>
      <p>${e(student.email)}<br>Grade ${e(student.grade)} · Class ${e(student.class)}</p>
      <p>Submitted ${e(formatSurveyDate(response.created))}<br>Response ID: ${e(response.id)}</p></header>
      ${response.questions.map((question, index) => `<section><h3>${index + 1}. ${e(question.title)}</h3>
        ${surveyAnswerLines(question, response.answers[question.id]).map(line => `<p class="answer">${e(line)}</p>`).join('')}</section>`).join('')}
      <footer>Student self-reflection. Student details were supplied on the survey; roster matching uses email. Questions are from this submission’s saved snapshot.</footer></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(survey.title)} — Student reports</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:11pt Arial,sans-serif;line-height:1.5;color:#172c35;margin:0}
    article+article{break-before:page;page-break-before:always}header{break-inside:avoid}h1{font-size:20pt;margin:0 0 8pt}h2{font-size:15pt}
    h3{font-size:12pt;margin-bottom:5pt;break-after:avoid}section{border-top:1px solid #d6dce3;padding-top:6pt;margin-top:14pt}
    .answer{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}footer{margin-top:22pt;font-size:9pt;color:#52616b}
    @media screen{body{max-width:800px;margin:30px auto;padding:0 20px}article{margin-bottom:60px}}
    </style></head><body>${articles}</body></html>`;
}
