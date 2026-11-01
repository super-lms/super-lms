export function noticeClassSection(notice, classId, masterView) {
  // In a class workspace the selected class is authoritative. In a master
  // workspace require a single known cohort, never expand to all cohorts.
  const value = masterView ? notice?.section_id : classId;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
