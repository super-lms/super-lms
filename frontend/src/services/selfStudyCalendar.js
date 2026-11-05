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
