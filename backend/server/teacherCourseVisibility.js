const TEACHER_COURSE_ASSIGNMENTS = {
  "davidbrecht@cbcschools.ca": [
    "Accounting 12",
    "Anatomy and Physiology 12A",
    "Fitness and Conditioning 11/12A",
    "CLC 12A",
    "CLC 12B",
    "CLC 12C",
    "CLC 12A / 12B / 12C",
  ],
  "carriefang@cbcschools.ca": [
    "Composition 10A", "Composition 10B", "Composition 10C",
    "Creative Writing 10A", "Creative Writing 10B", "Creative Writing 10C", "Creative Writing 10D",
    "CTS 10A", "CTS 10B", "CTS 10C", "CTS 10D",
  ],
  "alanrobinson@cbcschools.ca": [
    "Physics 12A", "Physics 12B", "Physics 12C",
    "Pre-Calculus 12A", "Pre-Calculus 12B", "Pre-Calculus 12C",
    "Pre-calc 12A", "Pre-calc 12B", "Pre-calc 12C",
  ],
  "charmainemoses@cbcschools.ca": [
    "Composition 11A", "Composition 11B", "Composition 11C",
    "EFP 12A", "EFP 12B", "EFP 12C",
    "English First Peoples 12A", "English First Peoples 12B", "English First Peoples 12C",
    "Marketing and Promotion 11", "Marketing and Promotion 11A",
  ],
  "davidcheng@cbcschools.ca": [
    "PE 10A", "PE 10B", "PE 10C", "PE 10D",
    "Science 10A", "Science 10B", "Science 10C",
  ],
  "harryfeng@cbcschools.ca": [
    "Pre-Calculus 11A", "Pre-Calculus 11B", "Pre-Calculus 11C",
    "Pre-calc 11A", "Pre-calc 11B", "Pre-calc 11C",
    "Physics 11A", "Physics 11B", "Physics 11C",
  ],
  "jenniferboyd@cbcschools.ca": [
    "ELSL 11A", "ELSL 11B", "ELSL 11C",
    "English Studies 12A", "English Studies 12B", "English Studies 12C",
    "ELSL 11 - English First Peoples' Literary Analysis and Spoken Language",
  ],
  "nicolinevanderwatt@cbcschools.ca": [
    "Social Studies 10A", "Social Studies 10B", "Social Studies 10C",
    "PGEO 11A", "PGEO 11B", "PGEO 11C",
    "Physical Geography 11A", "Physical Geography 11B", "Physical Geography 11C",
  ],
  "davidvainer@cbcschools.ca": [
    "Chemistry 11A", "Chemistry 11B", "Chemistry 11C",
    "Chem 11A", "Chem 11B", "Chem 11C",
    "Science 10D", "Science 10D - short term",
    "Chemistry 12A", "Chemistry 12B", "Chemistry 12C",
    "Chem 12A", "Chem 12B", "Chem 12C",
    "Fitness and Conditioning 11/12B",
  ],
  "peterniu@cbcschools.ca": [
    "FMP 10A", "FMP 10B", "FMP 10C",
    "Accounting 11A", "Accounting 11B", "Accounting 11C",
    "Economic Theory 12",
  ],
  "michaelsamuels@cbcschools.ca": [
    "Drama 10A", "Drama 10B", "Drama 10C", "Drama 10D",
    "Spoken Language 10A", "Spoken Language 10B", "Spoken Language 10C", "Spoken Language 10D",
    "New Media 10A", "New Media 10B", "New Media 10C", "New Media 10D",
    "Spoken Language and New Media 10A", "Spoken Language and New Media 10B",
    "Spoken Language and New Media 10C", "Spoken Language and New Media 10D",
  ],
  "nolanhansen@cbcschools.ca": [
    "Composition 10D",
    "FMP 10D",
    "Social Studies 10D",
  ],
};

function normalizeCourseTitle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

const NORMALIZED_ASSIGNMENTS = new Map(
  Object.entries(TEACHER_COURSE_ASSIGNMENTS).map(([email, titles]) => [
    email,
    new Set(titles.map(normalizeCourseTitle)),
  ])
);

function isCourseAssignedToTeacher(course, teacherId) {
  const numericTeacherId = Number(teacherId || 0);
  const sharedTeacherIds = Array.isArray(course?.shared_teacher_ids)
    ? course.shared_teacher_ids.map((id) => Number(id || 0)).filter(Boolean)
    : [];

  return Boolean(
    numericTeacherId &&
      (Number(course?.teacher_id || 0) === numericTeacherId || sharedTeacherIds.includes(numericTeacherId))
  );
}

function shouldShowCourseForTeacher({ email, teacherId, course }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedTitle = normalizeCourseTitle(course?.title || course?.class_name);

  if (!normalizedTitle) return false;
  if (normalizedTitle === normalizeCourseTitle("Summer Session Spoken Language 10 Upgrade")) return false;

  const approvedTitles = NORMALIZED_ASSIGNMENTS.get(normalizedEmail);
  if (!approvedTitles) return isCourseAssignedToTeacher(course, teacherId);

  // Academic Planning was intentionally left with its current teacher assignment.
  if (normalizedTitle.startsWith(normalizeCourseTitle("Academic Planning"))) {
    return isCourseAssignedToTeacher(course, teacherId);
  }

  return approvedTitles.has(normalizedTitle);
}

module.exports = {
  TEACHER_COURSE_ASSIGNMENTS,
  normalizeCourseTitle,
  isCourseAssignedToTeacher,
  shouldShowCourseForTeacher,
};
