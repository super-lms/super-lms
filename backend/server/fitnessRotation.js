const DAY_MS = 86400000;
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
}
function chinaToday() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function validateUnit(body) {
  const title = String(body.title || '').trim();
  const {start_date:start,end_date:end,weekdays,stations} = body;
  if (!title || title.length > 120) throw Error('Enter a unit name of up to 120 characters.');
  if (!validDate(start) || !validDate(end) || start > end || (Date.parse(end)-Date.parse(start))/DAY_MS > 366) throw Error('Choose a start and end date, no more than one year apart.');
  if (!Array.isArray(weekdays) || weekdays.length !== 4 || new Set(weekdays).size !== 4 || weekdays.some(d=>!Number.isInteger(d)||d<1||d>7)) throw Error('Select exactly four teaching days.');
  if (!Array.isArray(stations) || stations.length !== 4 || stations.some(s=>!String(s?.name||'').trim()||String(s.name).length>80||String(s.instructions||'').length>1000)) throw Error('Enter four station names and instructions of up to 1,000 characters each.');
  const result = {title,start_date:start,end_date:end,weekdays:[...weekdays].sort((a,b)=>a-b),stations:stations.map(s=>({name:String(s.name).trim(),instructions:String(s.instructions||'').trim()}))};
  if (new Set(result.stations.map(s=>s.name.toLowerCase())).size!==4) throw Error('Give each station a different name.');
  if (!calendar(result).length) throw Error('The unit dates must include at least one selected teaching day.');
  return result;
}
function calendar(unit) {
  const result=[];
  for(let time=Date.parse(`${unit.start_date}T00:00:00Z`),end=Date.parse(`${unit.end_date}T00:00:00Z`);time<=end;time+=DAY_MS){
    const date=new Date(time),weekday=date.getUTCDay()||7,dayIndex=unit.weekdays.indexOf(weekday);
    if(dayIndex>=0) result.push({date:date.toISOString().slice(0,10),weekday,stations:[0,1,2,3].map(group=>(group+dayIndex)%4)});
  }
  return result;
}
module.exports={validDate,chinaToday,validateUnit,calendar};
