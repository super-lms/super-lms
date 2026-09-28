const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
export function findAnnouncementGroups(groups, search) {
  const term=normalize(search);
  if(!term)return [];
  return groups.filter(student=>normalize(student.chineseName).includes(term)||normalize(student.englishName).includes(term));
}
