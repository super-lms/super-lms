export default function AssignmentDateTime({value,onChange,min,style}) {
  const [date='',time='00:00']=value.split('T');
  const [hour='00',minute='00']=time.split(':');
  function updateTime(h,m){if(date)onChange(`${date}T${h}:${m}`);}
  return <div>
    <input aria-label="Date Beijing time" type="date" value={date} min={min?.slice(0,10)} onChange={e=>onChange(e.target.value?`${e.target.value}T${time}`:'')} style={style}/>
    <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
      <label>Hour <select aria-label="Hour Beijing time" value={hour} disabled={!date} onChange={e=>updateTime(e.target.value,minute)}>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Minute <select aria-label="Minute Beijing time" value={minute} disabled={!date} onChange={e=>updateTime(hour,e.target.value)}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(v=><option key={v}>{v}</option>)}</select></label>
    </div><small>Beijing time (UTC+8), 24-hour clock</small>
  </div>;
}
