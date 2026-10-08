export function beijingDateTime(value) {
  if (!value) return '';
  const raw=String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00`;
  const date=new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)?raw:`${raw}Z`);
  if(Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime()+8*3600000).toISOString().slice(0,16);
}
export function assignmentInstant(value) {
  if(!value) return null;
  return new Date(`${value}:00+08:00`).toISOString();
}
export function displayAssignmentTime(value) {
  const local=beijingDateTime(value);
  return local?`${local.replace('T',' ')} Beijing time`: 'No date set';
}
