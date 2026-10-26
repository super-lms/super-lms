const days=['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function fitnessCardsHtml({unit,students,course}){
 if(!unit||!students.length)throw Error('No student workout cards are available for this unit.')
 const cards=students.map(s=>`<article><header><p>SUPER-LMS · PE · ${esc(course?.title)}</p><h1>${esc(s.name)}</h1><h2>${esc(unit.title)}</h2><p>${esc(unit.start_date)} to ${esc(unit.end_date)} · ${s.group_index==null?'Group not selected':`Group ${'ABCD'[s.group_index]}`}</p></header>${s.group_index==null?'<p>Choose a rotation group in the Student Portal or ask your teacher to record your choice.</p>':unit.weekdays.map((d,i)=>{const station=unit.stations[(s.group_index+i)%4];return `<section><h3>${esc(days[d])} — ${esc(station.name)}</h3><p class="instructions">${esc(station.instructions)}</p></section>`}).join('')}<footer>Repeat this rotation each week within the unit dates. Your teacher confirms each completed workout in SUPER-LMS.</footer></article>`).join('')
 return `<!doctype html><html><head><meta charset="utf-8"><title>Fitness Workout Cards</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#111;max-width:800px;margin:auto}article{border:1px solid #777;padding:20px;margin:16px 0;break-after:page}article:last-child{break-after:auto}header,section{break-inside:avoid}h1{font-size:24px}h2{font-size:18px}h3{font-size:15px;margin:18px 0 6px}p{line-height:1.5}.instructions{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:20px;border-top:1px solid #aaa;padding-top:12px;font-size:11px}button{font:inherit;padding:12px;margin:12px 0}@media print{button{display:none}body{max-width:none}article{margin:0;border:0;padding:0}}</style></head><body><button onclick="window.print()">Print / Save PDF</button>${cards}</body></html>`
}
export function printFitnessCards(options){
 const html=fitnessCardsHtml(options),page=window.open('','_blank')
 if(!page)throw Error('Allow pop-up windows to open the printable workout cards.')
 page.document.write(html);page.document.close();page.focus()
}
