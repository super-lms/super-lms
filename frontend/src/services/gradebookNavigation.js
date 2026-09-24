export function gradebookPath(pathname, search, lastCourseId = "") {
  const query = new URLSearchParams(search);
  const pathCourse = pathname.match(/^\/courses\/(\d+)(?:\/|$)/)?.[1];
  const allSections = query.get("sectionId") === "all" || query.get("view") === "master";
  const courseId = (allSections ? "" : query.get("sectionId")) || query.get("courseId") ||
    query.get("classId") || pathCourse || lastCourseId;
  return courseId ? `/gradebook?classId=${encodeURIComponent(courseId)}${allSections ? "&sectionId=all" : ""}` : "/gradebook";
}

export function speedGradingPath(assignmentId, sectionId) {
  const path = `/assignments/${encodeURIComponent(assignmentId)}/grade`;
  return sectionId ? `${path}?sectionId=${encodeURIComponent(sectionId)}` : path;
}

export function speedGradingSections(courses, assignmentCourseId) {
  if (!assignmentCourseId) return [];
  return courses.filter((course) =>
    String(course.master_course_id || course.id) === String(assignmentCourseId)
  ).sort((a, b) => String(a.title || a.class_name || "").localeCompare(String(b.title || b.class_name || "")));
}
