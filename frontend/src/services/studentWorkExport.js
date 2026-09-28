export function studentWorkDocument(assignment, student) {
  const content = String(student?.content ?? '');
  if (!content.trim()) throw new Error('This student has no written response to export.');
  const title = String(assignment?.title || 'Assignment');
  const name = String(student?.student_name || 'Student');
  const section = String(student?.section_title || '');
  const filename = `${name} - ${title}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0,180) + '.txt';
  return { title, name, section, content, filename,
    text: [`Assignment: ${title}`, `Student: ${name}`, ...(section ? [`Section: ${section}`] : []), '', 'Student Written Response', '', content].join('\n') };
}

export function downloadStudentWork(assignment, student) {
  const work = studentWorkDocument(assignment, student);
  const url = URL.createObjectURL(new Blob(['\uFEFF', work.text], {type: 'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = work.filename;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function printStudentWork(assignment, student) {
  const work = studentWorkDocument(assignment, student);
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Please allow pop-ups for this site, then select Print / Save as PDF again.');
  const doc = popup.document;
  doc.title = `${work.name} - ${work.title}`;
  const style = doc.createElement('style');
  style.textContent = `@page { margin: 18mm; } body { margin: 24px; font: 12pt/1.6 Arial, sans-serif; color: #111; }
    h1 { font-size: 18pt; line-height: 1.3; } h2 { font-size: 13pt; } p { margin: 6px 0; }
    article { white-space: pre-wrap; overflow-wrap: anywhere; } h1,h2 { break-after: avoid; }
    button { padding: 8px 12px; } @media print { button { display: none; } body { margin: 0; } }`;
  doc.head.append(style);
  function add(tag, text) { const element = doc.createElement(tag); element.textContent = text; doc.body.append(element); return element; }
  const button = add('button', 'Print / Save as PDF');
  button.onclick = () => popup.print();
  add('h1', work.title); add('p', `Student: ${work.name}`);
  if (work.section) add('p', `Section: ${work.section}`);
  add('h2', 'Student Written Response'); add('article', work.content);
  popup.focus();
  popup.setTimeout(() => { if (!popup.closed) popup.print(); }, 300);
}
