const MULTI_SECTION_MASTERS = [
  "Accounting 11",
  "Chemistry 11",
  "Chemistry 12",
  "CLC 12",
  "Composition 10",
  "Composition 11",
  "Creative Writing 10",
  "CTS 10",
  "Drama 10",
  "EFP 12",
  "ELSL 11",
  "English Studies 12",
  "Fitness and Conditioning 11/12",
  "FMP 10",
  "New Media 10",
  "PE 10",
  "PGEO 11",
  "Physics 11",
  "Physics 12",
  "Pre-Calculus 11",
  "Pre-Calculus 12",
  "Science 10",
  "Social Studies 10",
  "Spoken Language 10",
]

function compactName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
}

function comparableName(value) {
  return compactName(value).toLowerCase().replace(/\s+/g, "")
}

export function getCourseSectionIdentity(course) {
  const originalTitle = compactName(course?.title || course?.class_name)
  const persistedMasterTitle = compactName(course?.master_title)
  const persistedSectionCode = String(course?.section_code || "").trim().toUpperCase()

  if (persistedMasterTitle && /^[A-D]$/.test(persistedSectionCode)) {
    return {
      isMultiSection: true,
      masterTitle: persistedMasterTitle,
      sectionCode: persistedSectionCode,
      normalizedTitle: `${persistedMasterTitle}${persistedSectionCode}`,
    }
  }

  for (const masterTitle of MULTI_SECTION_MASTERS) {
    const comparableMaster = comparableName(masterTitle)
    const comparableTitle = comparableName(originalTitle)

    if (!comparableTitle.startsWith(comparableMaster)) continue

    const suffix = comparableTitle.slice(comparableMaster.length)
    if (!/^[a-d]$/i.test(suffix)) continue

    const sectionCode = suffix.toUpperCase()
    return {
      isMultiSection: true,
      masterTitle,
      sectionCode,
      normalizedTitle: `${masterTitle}${sectionCode}`,
    }
  }

  return {
    isMultiSection: false,
    masterTitle: originalTitle,
    sectionCode: "",
    normalizedTitle: originalTitle,
  }
}

export function groupCoursesByMaster(courses) {
  const groupsByKey = new Map()

  for (const course of Array.isArray(courses) ? courses : []) {
    const identity = getCourseSectionIdentity(course)
    const key = identity.isMultiSection
      ? `multi:${identity.masterTitle.toLowerCase()}`
      : `single:${course.id}`

    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        key,
        masterTitle: identity.masterTitle,
        isMultiSection: identity.isMultiSection,
        sections: [],
      })
    }

    groupsByKey.get(key).sections.push({
      ...course,
      section_code: identity.sectionCode,
      normalized_title: identity.normalizedTitle,
      master_title: identity.masterTitle,
    })
  }

  return [...groupsByKey.values()]
    .map((group) => {
      const sections = [...group.sections].sort((a, b) => {
        const codeOrder = String(a.section_code || "").localeCompare(String(b.section_code || ""))
        return codeOrder || Number(a.id || 0) - Number(b.id || 0)
      })

      return {
        ...group,
        sections,
        // The backend persists the shared-content home; Section A is the migration fallback.
        contentCourse:
          sections.find(
            (section) => String(section.id) === String(section.content_course_id)
          ) || sections.find((section) => section.section_code === "A") || sections[0],
      }
    })
    .sort((a, b) => a.masterTitle.localeCompare(b.masterTitle))
}

export function findCourseGroup(courses, courseId) {
  return groupCoursesByMaster(courses).find((group) =>
    group.sections.some((section) => String(section.id) === String(courseId))
  )
}
