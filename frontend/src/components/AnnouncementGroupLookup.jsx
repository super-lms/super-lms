import { useState } from 'react';
import { findAnnouncementGroups } from '../services/announcementGroups.js';
export default function AnnouncementGroupLookup({groups}) {
  const [search,setSearch]=useState('');
  const results=findAnnouncementGroups(groups,search);
  return <section className="announcement-group-lookup">
    <h3>Find your group</h3>
    <label className="announcement-search">Chinese or English name<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="输入中文名 / Enter your English name"/></label>
    <p>Enter either name. If several students match, check both names before choosing your group.</p>
    {!search.trim()?<p>Search your name to see your group.</p>:<>
      <p role="status">{results.length?`${results.length} matching student${results.length===1?'':'s'}`:'No matching name found. Try part of your name or ask a teacher.'}</p>
      {results.map((student,index)=><article className="announcement-card" key={index}>
        <strong>{[student.chineseName,student.englishName].filter(Boolean).join(' · ')}</strong>
        <p><strong>Group:</strong> {student.groupName||'Group not provided — please ask a teacher.'}</p>
      </article>)}
    </>}
  </section>;
}
