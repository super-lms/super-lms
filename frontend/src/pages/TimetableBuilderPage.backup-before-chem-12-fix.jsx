import { useMemo, useState } from "react"

const BLOCKS = [
  { id: "block1", label: "Block 1", time: "8:30–9:45" },
  { id: "block2", label: "Block 2", time: "9:50–11:05" },
  { id: "block3", label: "Block 3", time: "11:40–12:55" },
  { id: "block4", label: "Block 4", time: "1:00–2:15" },
]

const SEMESTER_1_TEACHERS = [
  {
    id: 1,
    name: "Dr. Carrie",
    courses: ["English 10 A", "English 10 B", "English 10 C", "CTS 10 A", "CTS 10 B", "CTS 10 C"],
    assignments: {
      block1: { course: "English 10 A", subject: "English 10", locked: false },
      block2: { course: "English 10 B", subject: "English 10", locked: false },
      block3: { course: "English 10 C", subject: "English 10", locked: false },
      block4: { course: "Prep", subject: "Prep", locked: false },
    },
  },
  {
    id: 2,
    name: "Mr. Feng",
    courses: ["Physics 11A", "Physics 11B", "Physics 11C", "Pre-calc 11A", "Pre-calc 11B", "Pre-calc 11C"],
    assignments: {
      block1: { course: "Physics 11A", subject: "Physics 11", locked: false },
      block2: { course: "Physics 11B", subject: "Physics 11", locked: false },
      block3: { course: "Prep", subject: "Prep", locked: false },
      block4: { course: "Pre-calc 11A", subject: "Pre-calc 11", locked: false },
    },
  },
  {
    id: 3,
    name: "Mr. Robinson",
    courses: ["Physics 12A", "Physics 12B", "OPysics 12C", "Pre-calc 12A", "Pre-calc 12B", "Pre-calc 12C"],
    assignments: {
      block1: { course: "Physics 12A", subject: "Physics 12", locked: false },
      block2: { course: "Prep", subject: "Prep", locked: false },
      block3: { course: "Physics 12B", subject: "Physics 12", locked: false },
      block4: { course: "Pre-calc 12A", subject: "Pre-calc 12", locked: false },
    },
  },
  {
    id: 4,
    name: "Ms. Moses",
    courses: ["ELSI 11A", "ELSI 11B", "ELSI 11C", "EFP 12A", "EFP 12 B", "EFP 12C"],
    assignments: {
      block1: { course: "Prep", subject: "Prep", locked: false },
      block2: { course: "ELSI 11A", subject: "ELSI 11", locked: false },
      block3: { course: "ELSI 11B", subject: "ELSI 11", locked: false },
      block4: { course: "EFP 12A", subject: "EFP 12", locked: false },
    },
  },
  {
    id: 5,
    name: "Ms. Van der watt",
    courses: [
      "Social studies 10A",
      "Social studies 10B",
      "Social studies 10C",
      "Physical Geography 11A",
      "Physical Geography 11B",
      "Physical Geography",
    ],
    assignments: {
      block1: { course: "Social studies 10A", subject: "Social Studies 10", locked: false },
      block2: { course: "Social studies 10B", subject: "Social Studies 10", locked: false },
      block3: { course: "Physical Geography 11A", subject: "Physical Geography 11", locked: false },
      block4: { course: "Prep", subject: "Prep", locked: false },
    },
  },
  {
    id: 6,
    name: "Mr. Cheng",
    courses: ["FMP 10A", "FMP 10B", "FMP 10C", "Science 10A", "Science 10B", "Science 10C"],
    assignments: {
      block1: { course: "FMP 10A", subject: "FMP 10", locked: false },
      block2: { course: "Science 10A", subject: "Science 10", locked: false },
      block3: { course: "Prep", subject: "Prep", locked: false },
      block4: { course: "Science 10B", subject: "Science 10", locked: false },
    },
  },
  {
    id: 7,
    name: "Ms. Boys",
    courses: ["Comp 11A", "Comp 11B", "Comp 11C", "FNST 12A", "FNST 12 B", "FNST 12C"],
    assignments: {
      block1: { course: "Comp 11A", subject: "Comp 11", locked: false },
      block2: { course: "Prep", subject: "Prep", locked: false },
      block3: { course: "Comp 11B", subject: "Comp 11", locked: false },
      block4: { course: "FNST 12A", subject: "FNST 12", locked: false },
    },
  },
  {
    id: 8,
    name: "Mr. Clemens",
    courses: ["ESL 10A", "ESL 10B", "ESL 10C", "PE 10A", "PE 10B", "PE 10C"],
    assignments: {
      block1: { course: "Prep", subject: "Prep", locked: false },
      block2: { course: "ESL 10A", subject: "ESL 10", locked: false },
      block3: { course: "ESL 10B", subject: "ESL 10", locked: false },
      block4: { course: "PE 10A", subject: "PE 10", locked: false },
    },
  },
  {
    id: 9,
    name: "MYSTERY X",
    courses: ["Chem 11A", "Chem 11B", "Chem11C", "Chem 11A", "Chem 11B", "Chem 11C"],
    assignments: {
      block1: { course: "Chem 11A", subject: "Chem 11", locked: false },
      block2: { course: "Chem 11B", subject: "Chem 11", locked: false },
      block3: { course: "Prep", subject: "Prep", locked: false },
      block4: { course: "Chem11C", subject: "Chem 11", locked: false },
    },
  },
  {
    id: 10,
    name: "New teacher",
    courses: ["Accounting 11 A", "Accounting 11 B", "Accounting 11 C", "Accounting 12 A", "Accounting 12 B", "Accounting 12 V"],
    assignments: {
      block1: { course: "Accounting 11 A", subject: "Accounting 11", locked: false },
      block2: { course: "Prep", subject: "Prep", locked: false },
      block3: { course: "Accounting 11 B", subject: "Accounting 11", locked: false },
      block4: { course: "Accounting 12 A", subject: "Accounting 12", locked: false },
    },
  },
]

const SEMESTER_2_TEACHERS = SEMESTER_1_TEACHERS.map((teacher, index) => ({
  ...teacher,
  assignments: {
    block1: { course: teacher.courses[3] || "Prep", subject: getSubjectFromCourse(teacher.courses[3]), locked: false },
    block2: { course: teacher.courses[4] || "Prep", subject: getSubjectFromCourse(teacher.courses[4]), locked: false },
    block3: { course: teacher.courses[5] || "Prep", subject: getSubjectFromCourse(teacher.courses[5]), locked: false },
    block4: { course: "Prep", subject: "Prep", locked: false },
  },
}))

function getSubjectFromCourse(course) {
  const value = String(course || "").trim()

  if (!value) return "Prep"
  if (value.startsWith("English 10")) return "English 10"
  if (value.startsWith("CTS 10")) return "CTS 10"
  if (value.startsWith("Physics 11")) return "Physics 11"
  if (value.startsWith("Pre-calc 11")) return "Pre-calc 11"
  if (value.startsWith("Physics 12") || value.startsWith("OPysics 12")) return "Physics 12"
  if (value.startsWith("Pre-calc 12")) return "Pre-calc 12"
  if (value.startsWith("ELSI 11")) return "ELSI 11"
  if (value.startsWith("EFP 12")) return "EFP 12"
  if (value.startsWith("Social studies 10")) return "Social Studies 10"
  if (value.startsWith("Physical Geography")) return "Physical Geography 11"
  if (value.startsWith("FMP 10")) return "FMP 10"
  if (value.startsWith("Science 10")) return "Science 10"
  if (value.startsWith("Comp 11")) return "Comp 11"
  if (value.startsWith("FNST 12")) return "FNST 12"
  if (value.startsWith("ESL 10")) return "ESL 10"
  if (value.startsWith("PE 10")) return "PE 10"
  if (value.startsWith("Chem")) return "Chem 11"
  if (value.startsWith("Accounting 11")) return "Accounting 11"
  if (value.startsWith("Accounting 12")) return "Accounting 12"

  return value
}

export default function TimetableBuilderPage() {
  const [semesters, setSemesters] = useState({
    semester1: SEMESTER_1_TEACHERS,
    semester2: SEMESTER_2_TEACHERS,
  })

  function updateSemesterTeachers(semesterKey, updater) {
    setSemesters((currentSemesters) => ({
      ...currentSemesters,
      [semesterKey]: updater(currentSemesters[semesterKey]),
    }))
  }

  return (
    <div style={pageStyle}>
      <div style={headerCardStyle}>
        <div>
          <h1 style={titleStyle}>Timetable Builder</h1>
          <p style={subtitleStyle}>
            Draft the full school year at a glance: Semester 1 and Semester 2, Monday–Thursday, Block 1–4.
          </p>
        </div>
      </div>

      <div style={rulesGridStyle}>
        <RuleCard title="Full Year View" text="Semester 1 and Semester 2 now appear on the same page." />
        <RuleCard title="Same Structure" text="Each semester uses the same teacher rows, 4 blocks, prep rules, and unscheduled course list." />
        <RuleCard title="Teacher Load" text="Each teacher should teach 3 blocks and have 1 prep block per semester." />
        <RuleCard title="Next Step" text="Add click-to-swap scheduled and unscheduled courses." />
      </div>

      <TimetableSemesterSection
        title="Semester 1"
        semesterKey="semester1"
        teachers={semesters.semester1}
        updateSemesterTeachers={updateSemesterTeachers}
      />

      <TimetableSemesterSection
        title="Semester 2"
        semesterKey="semester2"
        teachers={semesters.semester2}
        updateSemesterTeachers={updateSemesterTeachers}
      />
    </div>
  )
}

function TimetableSemesterSection({ title, semesterKey, teachers, updateSemesterTeachers }) {
  const [selectedSwap, setSelectedSwap] = useState(null)
  const summary = useMemo(() => buildSummary(teachers), [teachers])

  function toggleLock(teacherId, blockId) {
    updateSemesterTeachers(semesterKey, (currentTeachers) =>
      currentTeachers.map((teacher) => {
        if (teacher.id !== teacherId) return teacher

        const assignment = teacher.assignments[blockId]

        return {
          ...teacher,
          assignments: {
            ...teacher.assignments,
            [blockId]: {
              ...assignment,
              locked: !assignment.locked,
            },
          },
        }
      })
    )
  }

  function selectUnscheduledCourse(teacherId, course) {
    setSelectedSwap({ teacherId, course })
  }

  function clearSelectedSwap() {
    setSelectedSwap(null)
  }

  function placeSelectedCourseIntoBlock(teacherId, blockId) {
    if (!selectedSwap) return
    if (selectedSwap.teacherId !== teacherId) return

    updateSemesterTeachers(semesterKey, (currentTeachers) =>
      currentTeachers.map((teacher) => {
        if (teacher.id !== teacherId) return teacher

        const currentAssignment = teacher.assignments[blockId]

        if (currentAssignment?.locked) {
          return teacher
        }

        return {
          ...teacher,
          assignments: {
            ...teacher.assignments,
            [blockId]: {
              course: selectedSwap.course,
              subject: getSubjectFromCourse(selectedSwap.course),
              locked: false,
            },
          },
        }
      })
    )

    setSelectedSwap(null)
  }

  function reshuffleUnlockedPreps() {
    updateSemesterTeachers(semesterKey, (currentTeachers) =>
      currentTeachers.map((teacher, index) => {
        const preferredPrepBlock = BLOCKS[index % BLOCKS.length].id
        const currentPrepBlock = BLOCKS.find(
          (block) => teacher.assignments[block.id]?.subject === "Prep"
        )?.id

        if (!currentPrepBlock || currentPrepBlock === preferredPrepBlock) {
          return teacher
        }

        const currentPrep = teacher.assignments[currentPrepBlock]
        const targetAssignment = teacher.assignments[preferredPrepBlock]

        if (currentPrep.locked || targetAssignment.locked) {
          return teacher
        }

        return {
          ...teacher,
          assignments: {
            ...teacher.assignments,
            [currentPrepBlock]: targetAssignment,
            [preferredPrepBlock]: currentPrep,
          },
        }
      })
    )
  }

  return (
    <section style={semesterSectionStyle}>
      <div style={semesterHeaderStyle}>
        <div>
          <h2 style={semesterTitleStyle}>{title}</h2>
          <p style={semesterSubtitleStyle}>Courses in each block repeat Monday through Thursday for this semester.</p>
        </div>

        <div style={semesterActionsStyle}>
          {selectedSwap ? (
            <div style={selectedSwapStyle}>
              Selected: <strong>{selectedSwap.course}</strong>
              <button type="button" onClick={clearSelectedSwap} style={smallButtonStyle}>
                Clear
              </button>
            </div>
          ) : (
            <div style={selectionHelpStyle}>Select an unscheduled course, then choose a block.</div>
          )}

          <button type="button" onClick={reshuffleUnlockedPreps} style={primaryButtonStyle}>
            Reshuffle {title} Prep Blocks
          </button>
        </div>
      </div>

      <div style={statusCardStyle}>
        <h3 style={sectionTitleStyle}>Prep Balance</h3>
        <div style={prepGridStyle}>
          {BLOCKS.map((block) => (
            <div key={block.id} style={prepBoxStyle}>
              <div style={prepLabelStyle}>{block.label}</div>
              <div style={prepValueStyle}>{summary.prepByBlock[block.id]} teacher(s) on prep</div>
            </div>
          ))}
        </div>

        {summary.warnings.length > 0 ? (
          <div style={warningBoxStyle}>
            <strong>Conflicts to fix:</strong>
            <ul style={{ marginBottom: 0 }}>
              {summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div style={successBoxStyle}>No major timetable conflicts found in this semester draft.</div>
        )}
      </div>

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={teacherHeaderStyle}>Teacher</th>
              {BLOCKS.map((block) => (
                <th key={block.id} style={headerCellStyle}>
                  <div>{block.label}</div>
                  <div style={timeStyle}>{block.time}</div>
                </th>
              ))}
              <th style={allCoursesHeaderStyle}>All 6 Courses</th>
              <th style={unscheduledHeaderStyle}>Unscheduled Courses</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td style={teacherCellStyle}>{teacher.name}</td>

                {BLOCKS.map((block) => {
                  const assignment = teacher.assignments[block.id]

                  return (
                    <td key={block.id} style={cellStyle}>
                      <div style={assignment?.subject === "Prep" ? prepCardStyle : courseCardStyle}>
                        <div style={courseTitleStyle}>{assignment.course}</div>
                        <div style={courseMetaStyle}>{assignment.subject}</div>

                        {selectedSwap?.teacherId === teacher.id && !assignment.locked && (
                          <button
                            type="button"
                            onClick={() => placeSelectedCourseIntoBlock(teacher.id, block.id)}
                            style={placeButtonStyle}
                          >
                            Place selected here
                          </button>
                        )}

                        {selectedSwap?.teacherId === teacher.id && assignment.locked && (
                          <div style={lockedNoteStyle}>Locked block cannot be replaced.</div>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleLock(teacher.id, block.id)}
                          style={assignment.locked ? lockedButtonStyle : lockButtonStyle}
                        >
                          {assignment.locked ? "Locked" : "Unlocked"}
                        </button>
                      </div>
                    </td>
                  )
                })}

                <td style={wideCellStyle}>
                  <div style={allCoursesGridStyle}>
                    {teacher.courses.map((course, courseIndex) => (
                      <div key={`${teacher.id}-${course}-${courseIndex}`} style={allCourseStyle}>
                        {course}
                      </div>
                    ))}
                  </div>
                </td>

                <td style={wideCellStyle}>
                  <div style={unscheduledListStyle}>
                    {getUnscheduledCourses(teacher).map((course, courseIndex) => {
                      const isSelected =
                        selectedSwap?.teacherId === teacher.id && selectedSwap?.course === course

                      return (
                        <button
                          key={`${teacher.id}-unscheduled-${course}-${courseIndex}`}
                          type="button"
                          onClick={() => selectUnscheduledCourse(teacher.id, course)}
                          style={isSelected ? selectedUnscheduledCourseStyle : unscheduledCourseStyle}
                        >
                          {course}
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function buildSummary(teachers) {
  const prepByBlock = {}
  const subjectCounts = {}
  const warnings = []

  for (const block of BLOCKS) {
    prepByBlock[block.id] = 0
    subjectCounts[block.id] = {}
  }

  for (const teacher of teachers) {
    let teachingBlocks = 0
    let prepBlocks = 0

    for (const block of BLOCKS) {
      const assignment = teacher.assignments[block.id]

      if (!assignment) continue

      if (assignment.subject === "Prep") {
        prepBlocks += 1
        prepByBlock[block.id] += 1
      } else {
        teachingBlocks += 1
        subjectCounts[block.id][assignment.subject] =
          (subjectCounts[block.id][assignment.subject] || 0) + 1
      }
    }

    if (teachingBlocks !== 3 || prepBlocks !== 1) {
      warnings.push(`${teacher.name} should teach 3 blocks and have 1 prep block.`)
    }
  }

  for (const block of BLOCKS) {
    for (const [subject, count] of Object.entries(subjectCounts[block.id])) {
      if (count > 3) {
        warnings.push(`${subject} is offered more than 3 times in ${block.label}.`)
      }
    }
  }

  return { prepByBlock, warnings }
}

function getUnscheduledCourses(teacher) {
  const scheduledCourses = new Set(
    Object.values(teacher.assignments)
      .map((assignment) => assignment.course)
      .filter((course) => course !== "Prep")
  )

  return teacher.courses.filter((course) => !scheduledCourses.has(course))
}

function RuleCard({ title, text }) {
  return (
    <div style={ruleCardStyle}>
      <h3 style={ruleTitleStyle}>{title}</h3>
      <p style={ruleTextStyle}>{text}</p>
    </div>
  )
}

const pageStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
}

const headerCardStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
}

const titleStyle = {
  margin: 0,
  fontSize: "28px",
  color: "#111",
}

const subtitleStyle = {
  margin: "8px 0 0",
  fontSize: "16px",
  color: "#374151",
  lineHeight: 1.5,
}

const semesterSectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "18px",
  background: "#ffffff",
}

const semesterHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
}

const semesterActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
}

const selectedSwapStyle = {
  border: "1px solid #111",
  borderRadius: "10px",
  padding: "10px 12px",
  background: "#ffffff",
  color: "#111",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
}

const selectionHelpStyle = {
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  padding: "10px 12px",
  background: "#ffffff",
  color: "#374151",
  fontSize: "14px",
}

const smallButtonStyle = {
  border: "1px solid #9ca3af",
  background: "#ffffff",
  color: "#111",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
}

const semesterTitleStyle = {
  margin: 0,
  fontSize: "24px",
  color: "#111",
}

const semesterSubtitleStyle = {
  margin: "6px 0 0",
  fontSize: "15px",
  color: "#374151",
}

const primaryButtonStyle = {
  border: "1px solid #111",
  background: "#111",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "12px 16px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
}

const rulesGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
}

const ruleCardStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "16px",
}

const ruleTitleStyle = {
  margin: "0 0 8px",
  fontSize: "16px",
  color: "#111",
}

const ruleTextStyle = {
  margin: 0,
  fontSize: "14px",
  color: "#374151",
  lineHeight: 1.45,
}

const statusCardStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: "20px",
  color: "#111",
}

const prepGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px",
}

const prepBoxStyle = {
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  padding: "12px",
  background: "#f9fafb",
}

const prepLabelStyle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#111",
  marginBottom: "4px",
}

const prepValueStyle = {
  fontSize: "14px",
  color: "#374151",
}

const warningBoxStyle = {
  marginTop: "14px",
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  color: "#111",
  fontSize: "14px",
  lineHeight: 1.5,
}

const successBoxStyle = {
  marginTop: "14px",
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  color: "#111",
  fontSize: "14px",
  fontWeight: 700,
}

const tableWrapStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  overflowX: "auto",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1650px",
}

const teacherHeaderStyle = {
  textAlign: "left",
  padding: "14px",
  borderBottom: "1px solid #d7d7d7",
  background: "#f9fafb",
  width: "170px",
}

const headerCellStyle = {
  textAlign: "left",
  padding: "14px",
  borderBottom: "1px solid #d7d7d7",
  background: "#f9fafb",
}

const timeStyle = {
  marginTop: "4px",
  fontSize: "13px",
  fontWeight: 400,
  color: "#4b5563",
}

const teacherCellStyle = {
  padding: "14px",
  borderTop: "1px solid #eeeeee",
  fontWeight: 700,
  color: "#111",
  verticalAlign: "top",
}

const cellStyle = {
  padding: "12px",
  borderTop: "1px solid #eeeeee",
  verticalAlign: "top",
}

const wideCellStyle = {
  padding: "12px",
  borderTop: "1px solid #eeeeee",
  verticalAlign: "top",
  minWidth: "260px",
}

const allCoursesHeaderStyle = {
  ...headerCellStyle,
  minWidth: "300px",
}

const unscheduledHeaderStyle = {
  ...headerCellStyle,
  minWidth: "260px",
}

const courseCardStyle = {
  border: "1px solid #b5b5b5",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  minHeight: "95px",
}

const prepCardStyle = {
  border: "1px dashed #777",
  borderRadius: "12px",
  padding: "12px",
  background: "#f3f4f6",
  minHeight: "95px",
}

const courseTitleStyle = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#111",
  marginBottom: "6px",
}

const courseMetaStyle = {
  fontSize: "13px",
  color: "#374151",
  marginBottom: "4px",
}

const placeButtonStyle = {
  marginTop: "8px",
  marginRight: "8px",
  border: "1px solid #111",
  background: "#111",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
}

const lockedNoteStyle = {
  marginTop: "8px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#111",
}

const lockButtonStyle = {
  marginTop: "8px",
  border: "1px solid #9ca3af",
  background: "#ffffff",
  color: "#111",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
}

const lockedButtonStyle = {
  ...lockButtonStyle,
  border: "1px solid #111",
  background: "#111",
  color: "#ffffff",
}

const allCoursesGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
}

const allCourseStyle = {
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#f9fafb",
  fontSize: "13px",
  fontWeight: 700,
  color: "#111",
}

const unscheduledListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}

const unscheduledCourseStyle = {
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  color: "#111",
  textAlign: "left",
  cursor: "pointer",
}

const selectedUnscheduledCourseStyle = {
  ...unscheduledCourseStyle,
  border: "2px solid #111",
}
