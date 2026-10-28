const text = (value) => String(value ?? "").trim();

export function buildRosterPrintChoices(courses) {
  const safeCourses = Array.isArray(courses) ? courses : [];
  const childCountByMaster = new Map();

  safeCourses.forEach((course) => {
    const masterId = text(course?.master_course_id);
    if (!masterId) return;
    childCountByMaster.set(masterId, (childCountByMaster.get(masterId) || 0) + 1);
  });

  return safeCourses.flatMap((course) => {
    const courseId = text(course?.id);
    if (!courseId) return [];

    if (text(course?.master_course_id)) {
      return [{
        key: `section:${courseId}`,
        courseId,
        scope: "section",
        course,
        label: course.title,
        typeLabel: "Cohort",
      }];
    }

    const hasLinkedCohorts = (childCountByMaster.get(courseId) || 0) > 0;
    const isExplicitMaster = /\bmaster\s*(class|course)?\b/i.test(text(course?.title));

    if (!hasLinkedCohorts) {
      return [{
        key: `section:${courseId}`,
        courseId,
        scope: "section",
        course,
        label: course.title,
        typeLabel: "Class",
      }];
    }

    const masterChoice = {
      key: `master:${courseId}`,
      courseId,
      scope: "master",
      course,
      label: course.title,
      typeLabel: "Master Class — all cohorts",
    };

    // Some older course groups use the A cohort as both the content root and
    // the course's first section. Keep that exact A roster available, while
    // offering the combined master roster as a separate explicit choice.
    if (!isExplicitMaster) {
      return [
        {
          key: `section:${courseId}`,
          courseId,
          scope: "section",
          course,
          label: course.title,
          typeLabel: "Cohort",
        },
        masterChoice,
      ];
    }

    return [masterChoice];
  });
}

export function rosterPrintEndpoint(choice) {
  const courseId = encodeURIComponent(text(choice?.courseId));
  return choice?.scope === "section"
    ? `/api/class-roster/${courseId}?scope=section`
    : `/api/class-roster/${courseId}`;
}
