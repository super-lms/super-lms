export const ipadStatusLabel = status => status === 'needed' ? 'Need iPad for Self Study' : status === 'not_needed' ? 'Do Not Need iPad for Self Study' : 'No notice posted';
export function beijingToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = name => parts.find(part => part.type === name).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addStudyDays(date, count) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
export function studyDays(date, view) {
  if (view === 'day') return [date];
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = addStudyDays(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addStudyDays(monday, index));
}

export function studyDateRange(from, to) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!valid(from) || !valid(to) || from > to) return [];
  const count = Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  if (count > 31) return [];
  return Array.from({length:count},(_,index)=>addStudyDays(from,index));
}
export async function loadStudyDateRange(from, to, read) {
  const days=studyDateRange(from,to);
  if(!days.length)throw Error('Choose a valid start and end date, up to 31 days apart including both dates.');
  const notices=[];
  for(let index=0;index<days.length;index+=7){
    const response=await read(days[index],days[Math.min(index+6,days.length-1)]);
    notices.push(...(response.notices || []));
  }
  return notices;
}
