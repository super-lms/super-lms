export function gradebookPath(pathname, search, lastCourseId = "") {
  const query = new URLSearchParams(search);
  const pathCourse = pathname.match(/^\/courses\/(\d+)(?:\/|$)/)?.[1];
  const courseId = query.get("sectionId") || query.get("courseId") ||
    query.get("classId") || pathCourse || lastCourseId;
  return courseId ? `/gradebook?classId=${encodeURIComponent(courseId)}` : "/gradebook";
}
